import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { CheckType, Severity } from "@/app/generated/prisma/client";
import { CHURN_THRESHOLD_DAYS, VISIT_INTERVAL_DAYS, CHURN_INTERVAL_MULTIPLIER } from "@/lib/reports";

// AI気づき: 「関わりの質」「離脱兆候」について、断定せず問いかけの形で気づきを提示する。
// 設計方針(要件定義より):
//   - AIは答えを出す役ではなく、気づきを人と人の対話につなげる役
//   - スタッフを監視・評価する仕組みにはしない
//   - 出力は awareness_checks に保存されるだけで、顧客ステータスを自動変更しない
//
// ANTHROPIC_API_KEY が未設定の場合は何もせず status: "not_configured" を返す(事務チェックだけは動く)。
// docs/office-check-ai-insight-foundation-spec-v2.md: 離脱閾値の個別化・渡すデータの拡充・エラー状態の可視化。

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

const SYSTEM_PROMPT = `あなたは治療院「はぐくま」のスタッフ向けに、来院データから「気づき」を提示するアシスタントです。

重要な役割の制約:
- あなたは診断や評価を下す立場ではありません。答えを出すのではなく、スタッフや院長が話し合うきっかけになる「問いかけ」を提示してください。
- 断定的な表現(「離脱しています」「担当が悪い」等)は避け、「〜のように見えますが、心当たりはありますか」のような問いかけ調で書いてください。
- スタッフ個人を評価・非難する書き方はしないでください。
- 何も気になる点がなければ、無理に何かを作らず空配列を返してください。

見るべき観点:
1. 来院頻度に対して、声かけ・フォロー・カルテの記述が薄くなっていないか
2. 来店間隔が過去のペースから広がっていないか(churnThresholdDaysはこの顧客の必要来院ペースから計算した個別の目安)
3. プリカ残高は減っているのに来店が止まっていないか(残高が残ったまま最終来院から日数が経っている場合)
4. 施術内容(部位タグ)や主訴が急に変化していないか
5. 見立ての記述が症状名の言い換えにとどまっていないか、以下の深まりの目安を参考に見てください。
   - Lv0(浅い):症状名をそのまま言い換えただけ(例:「肩こりが辛い」)
   - Lv1:身体構造・姿勢など具体的な部位への言及がある
   - Lv2:東洋医学的な見立て(ガチガチ/ヘトヘト/ドロドロの分類、または陰陽・気血津液・臓腑弁証・五行の考え方)に接続されている
   - Lv3:さらに優先原因(筋骨格系・神経系・血流系・内臓系・栄養系・睡眠系のうち何が優先か)まで踏み込んでいる
   直近の来院記録でLv0の記述が複数回続いている場合は、問いかけ調で指摘してください。単発であれば無理に指摘しなくてよいです。

出力形式:
JSONの配列のみを出力してください。説明文やコードブロックの記号("\`\`\`")は付けないでください。
各要素は次の形式です:
{"category": string, "message": string, "severity": "INFO" | "NOTICE" | "IMPORTANT"}
気になる点がなければ [] を返してください。`;

type RawInsight = { category?: unknown; message?: unknown; severity?: unknown };

export type AiInsight = {
  category: string;
  message: string;
  severity: Severity;
};

export type AiInsightResult =
  | { status: "not_configured"; insights: AiInsight[] }
  | { status: "ok"; insights: AiInsight[] }
  | { status: "error"; insights: AiInsight[] };

function parseInsights(text: string): AiInsight[] {
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf("[");
  const jsonEnd = trimmed.lastIndexOf("]");
  if (jsonStart === -1 || jsonEnd === -1) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const validSeverities = new Set(Object.values(Severity));
  return (parsed as RawInsight[])
    .filter((r) => typeof r.category === "string" && typeof r.message === "string")
    .map((r) => ({
      category: r.category as string,
      message: r.message as string,
      severity: validSeverities.has(r.severity as Severity) ? (r.severity as Severity) : Severity.NOTICE,
    }));
}

async function buildClientContext(clientId: string) {
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    select: {
      name: true,
      firstVisitDate: true,
      rank: true,
      medicalHistory: true,
      familyData: true,
      personalData: true,
      acquisitionChannel: { select: { name: true } },
    },
  });

  const visits = await prisma.visit.findMany({
    where: { clientId },
    orderBy: { visitNo: "desc" },
    take: 8,
    select: {
      visitNo: true,
      visitDate: true,
      menu: true,
      chartRecord: {
        select: {
          chiefComplaintTags: true,
          bodyPartTags: true,
          evaluation: true,
          changeFromLast: true,
          clientVoice: true,
          requiredVisitInterval: true,
          healthHappinessScore: true,
          lifestyleSupportStatus: true,
        },
      },
    },
  });

  const card = await prisma.prepaidCard.findUnique({
    where: { clientId },
    include: { transactions: { orderBy: { txDate: "desc" }, take: 10 } },
  });
  const balance = card ? card.transactions.reduce((sum, t) => sum + t.amount, 0) : null;
  const lastUseDate = card?.transactions.find((t) => t.amount < 0)?.txDate ?? null;

  const reservations = await prisma.reservation.findMany({
    where: { clientId },
    orderBy: { reservedAt: "desc" },
    take: 3,
    select: { reservedAt: true, status: true },
  });

  // 離脱記録・担当変更相談の履歴は、トークン量に配慮して件数+直近1件の要約のみ渡す(仕様書2.3節)。
  const departureRecords = await prisma.departureRecord.findMany({
    where: { clientId },
    orderBy: { confirmedAt: "desc" },
    select: { confirmedAt: true, reason: true, triggeredByCancellation: true },
  });
  const reassignmentRequests = await prisma.reassignmentRequest.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: { status: true, note: true, createdAt: true },
  });

  const lastVisit = visits[0];
  const daysSinceLastVisit = lastVisit
    ? Math.floor((Date.now() - lastVisit.visitDate.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  // 離脱判定閾値は、docs/departure-followup-spec-v2.md 2.2節と同じ「必要来院ペース×3」を使う
  // (固定42日はrequiredVisitIntervalが未記録の場合のフォールバックとしてのみ使う)。
  const requiredVisitInterval = lastVisit?.chartRecord?.requiredVisitInterval ?? null;
  const churnThresholdDays = requiredVisitInterval
    ? VISIT_INTERVAL_DAYS[requiredVisitInterval] * CHURN_INTERVAL_MULTIPLIER
    : CHURN_THRESHOLD_DAYS;

  return {
    clientName: client.name,
    acquisitionChannel: client.acquisitionChannel?.name ?? null,
    firstVisitDate: client.firstVisitDate,
    rank: client.rank,
    medicalHistory: client.medicalHistory,
    familyData: client.familyData,
    personalData: client.personalData,
    daysSinceLastVisit,
    requiredVisitInterval,
    churnThresholdDays,
    recentHealthHappinessScore: lastVisit?.chartRecord?.healthHappinessScore ?? null,
    recentLifestyleSupportStatus: lastVisit?.chartRecord?.lifestyleSupportStatus ?? null,
    recentVisits: visits.map((v) => ({
      visitNo: v.visitNo,
      visitDate: v.visitDate,
      menu: v.menu,
      chiefComplaintTags: v.chartRecord?.chiefComplaintTags ?? [],
      bodyPartTags: v.chartRecord?.bodyPartTags ?? [],
      evaluation: v.chartRecord?.evaluation ?? null,
      changeFromLast: v.chartRecord?.changeFromLast ?? null,
      clientVoice: v.chartRecord?.clientVoice ?? null,
    })),
    prepaidBalance: balance,
    prepaidLastUseDate: lastUseDate,
    recentReservations: reservations,
    departureHistory: {
      count: departureRecords.length,
      mostRecent: departureRecords[0]
        ? {
            confirmedAt: departureRecords[0].confirmedAt,
            reason: departureRecords[0].reason,
            triggeredByCancellation: departureRecords[0].triggeredByCancellation,
          }
        : null,
    },
    reassignmentHistory: {
      count: reassignmentRequests.length,
      mostRecent: reassignmentRequests[0]
        ? { status: reassignmentRequests[0].status, note: reassignmentRequests[0].note }
        : null,
    },
  };
}

export async function generateAiInsights(clientId: string): Promise<AiInsightResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { status: "not_configured", insights: [] };

  try {
    const context = await buildClientContext(clientId);
    const client = new Anthropic();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(context, null, 2) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return { status: "ok", insights: [] };

    return { status: "ok", insights: parseInsights(textBlock.text) };
  } catch (err) {
    console.error("AI insight generation failed:", err);
    return { status: "error", insights: [] };
  }
}

export async function saveAiInsights(visitId: string, clientId: string): Promise<AiInsightResult> {
  const result = await generateAiInsights(clientId);
  if (result.insights.length === 0) return result;

  await prisma.awarenessCheck.createMany({
    data: result.insights.map((i) => ({
      visitId,
      checkType: CheckType.AI_INSIGHT,
      category: i.category,
      message: i.message,
      severity: i.severity,
    })),
  });
  return result;
}
