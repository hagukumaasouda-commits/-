import { prisma } from "@/lib/prisma";
import { CheckType, Severity } from "@/app/generated/prisma/client";

// 事務チェック: 記入漏れの有無だけを見るルールベースのチェック。
// AIは使わない(速く・ブレない・断定して良い)。関わりの質の判断は ai-insight.ts の役割。
// 対象フィールド一覧・条件は docs/office-check-ai-insight-foundation-spec-v2.md 参照。

export type OfficeFinding = {
  category: string;
  message: string;
  severity: Severity;
};

export async function runOfficeCheck(visitId: string): Promise<OfficeFinding[]> {
  const chart = await prisma.chartRecord.findUnique({ where: { visitId } });
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { client: { select: { rank: true } } },
  });

  const findings: OfficeFinding[] = [];

  if (!chart) {
    return [
      {
        category: "記入漏れ",
        message: "この来院にはカルテがまだ作成されていません。",
        severity: Severity.IMPORTANT,
      },
    ];
  }

  if (!visit.menu) {
    findings.push({
      category: "記入漏れ",
      message: "「本日のメニュー」が未入力です。",
      severity: Severity.NOTICE,
    });
  }
  if (!chart.evaluation) {
    findings.push({
      category: "記入漏れ",
      message: "「評価(何が起きているか)」が未入力です。",
      severity: Severity.NOTICE,
    });
  }
  if (!chart.nextCheck && !chart.nextRequired) {
    findings.push({
      category: "記入漏れ",
      message: "「次回確認」「次回必須」がどちらも未入力です。次回に引き継ぐ情報がないか確認してください。",
      severity: Severity.NOTICE,
    });
  }
  if (!chart.chiefComplaintTags || chart.chiefComplaintTags.length === 0) {
    findings.push({
      category: "記入漏れ",
      message: "主訴タグが未設定です。集計(来院理由の分布)に反映されません。",
      severity: Severity.INFO,
    });
  }
  if (!chart.bodyPartTags || chart.bodyPartTags.length === 0) {
    findings.push({
      category: "記入漏れ",
      message: "施術部位タグが未設定です。集計(部位の分布)に反映されません。",
      severity: Severity.INFO,
    });
  }
  // 初回来院(visitNo === 1)は「前回」が存在しないため対象外
  if (visit.visitNo > 1 && !chart.changeFromLast) {
    findings.push({
      category: "記入漏れ",
      message: "「前回からの変化」が未入力です。",
      severity: Severity.NOTICE,
    });
  }
  if (!visit.client.rank) {
    findings.push({
      category: "記入漏れ",
      message: "「ランク」が未設定です。毎回の来院で見直す想定です。",
      severity: Severity.NOTICE,
    });
  }
  // lifestyleSupportStatus は来院記録フォームから常に全項目分のオブジェクトが送信されるため、
  // 「未入力」はnullではなく「実施項目が一つもチェックされていない」ことを指す。
  const lifestyleValues = chart.lifestyleSupportStatus
    ? Object.values(chart.lifestyleSupportStatus as Record<string, boolean>)
    : [];
  if (lifestyleValues.length === 0 || lifestyleValues.every((done) => !done)) {
    findings.push({
      category: "記入漏れ",
      message: "「生活習慣サポート実施状況」が未入力です。",
      severity: Severity.INFO,
    });
  }
  if (!chart.clientVoice) {
    findings.push({
      category: "記入漏れ",
      message: "「お客様の声(自己認識)」が未入力です。",
      severity: Severity.NOTICE,
    });
  }
  if (!chart.requiredVisitInterval) {
    findings.push({
      category: "記入漏れ",
      message: "「必要来院ペース」が未入力です。見直しを検討してください。",
      severity: Severity.NOTICE,
    });
  }

  return findings;
}

export async function saveOfficeCheck(visitId: string): Promise<number> {
  const findings = await runOfficeCheck(visitId);
  if (findings.length === 0) return 0;
  await prisma.awarenessCheck.createMany({
    data: findings.map((f) => ({
      visitId,
      checkType: CheckType.OFFICE,
      category: f.category,
      message: f.message,
      severity: f.severity,
    })),
  });
  return findings.length;
}
