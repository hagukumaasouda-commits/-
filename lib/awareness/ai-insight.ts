import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { CheckType, Severity } from "@/app/generated/prisma/client";
import { CHURN_THRESHOLD_DAYS } from "@/lib/reports";

// AI気づき: 「関わりの質」「離脱兆候」について、断定せず問いかけの形で気づきを提示する。
// 設計方針(要件定義より):
//   - AIは答えを出す役ではなく、気づきを人と人の対話につなげる役
//   - スタッフを監視・評価する仕組みにはしない
//   - 出力は awareness_checks に保存されるだけで、顧客ステータスを自動変更しない
//
// ANTHROPIC_API_KEY が未設定の場合は何もせず空配列を返す(事務チェックだけは動く)。

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

const SYSTEM_PROMPT = `あなたは治療院「はぐくま」のスタッフ向けに、来院データから「気づき」を提示するアシスタントです。

重要な役割の制約:
- あなたは診断や評価を下す立場ではありません。答えを出すのではなく、スタッフや院長が話し合うきっかけになる「問いかけ」を提示してください。
- 断定的な表現(「離脱しています」「担当が悪い」等)は避け、「〜のように見えますが、心当たりはありますか」のような問いかけ調で書いてください。
- スタッフ個人を評価・非難する書き方はしないでください。
- 何も気になる点がなければ、無理に何かを作らず空配列を返してください。

見るべき観点:
1. 来院頻度に対して、声かけ・フォロー・カルテの記述が薄くなっていないか
2. 来店間隔が過去のペースから広がっていないか
3. プリカ残高は減っているのに来店が止まっていないか(残高が残ったまま最終来院から日数が経っている場合)
4. 施術内容(部位タグ)や主訴が急に変化していないか

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

  const lastVisit = visits[0];
  const daysSinceLastVisit = lastVisit
    ? Math.floor((Date.now() - lastVisit.visitDate.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  return {
    clientName: client.name,
    acquisitionChannel: client.acquisitionChannel?.name ?? null,
    firstVisitDate: client.firstVisitDate,
    daysSinceLastVisit,
    churnThresholdDays: CHURN_THRESHOLD_DAYS,
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
  };
}

export async function generateAiInsights(clientId: string): Promise<AiInsight[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const context = await buildClientContext(clientId);
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(context, null, 2) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  return parseInsights(textBlock.text);
}

export async function saveAiInsights(visitId: string, clientId: string): Promise<number> {
  let insights: AiInsight[];
  try {
    insights = await generateAiInsights(clientId);
  } catch (err) {
    console.error("AI insight generation failed:", err);
    return 0;
  }
  if (insights.length === 0) return 0;

  await prisma.awarenessCheck.createMany({
    data: insights.map((i) => ({
      visitId,
      checkType: CheckType.AI_INSIGHT,
      category: i.category,
      message: i.message,
      severity: i.severity,
    })),
  });
  return insights.length;
}
