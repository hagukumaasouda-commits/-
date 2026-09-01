import { prisma } from "@/lib/prisma";
import { CheckType, Severity } from "@/app/generated/prisma/client";

// 事務チェック: 記入漏れの有無だけを見るルールベースのチェック。
// AIは使わない(速く・ブレない・断定して良い)。関わりの質の判断は ai-insight.ts の役割。

export type OfficeFinding = {
  category: string;
  message: string;
  severity: Severity;
};

export async function runOfficeCheck(visitId: string): Promise<OfficeFinding[]> {
  const chart = await prisma.chartRecord.findUnique({ where: { visitId } });
  const visit = await prisma.visit.findUniqueOrThrow({ where: { id: visitId } });

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
  if (chart.requiredFields && typeof chart.requiredFields === "object") {
    const unfinished = Object.entries(chart.requiredFields as Record<string, string>).filter(
      ([, v]) => v === "未"
    );
    if (unfinished.length > 0) {
      findings.push({
        category: "記入漏れ",
        message: `生活習慣・体質改善サポートのチェック項目が${unfinished.length}件「未」のままです(${unfinished
          .map(([k]) => k)
          .join("、")})。`,
        severity: Severity.INFO,
      });
    }
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
