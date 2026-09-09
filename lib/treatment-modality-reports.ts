import { prisma } from "@/lib/prisma";
import type { ReportPeriod } from "@/lib/reports";
import { TREATMENT_MODALITY_ITEMS } from "@/lib/tags";

export type TreatmentModalityCount = { item: string; count: number };

/** 期間内の来院における物療チェック(コアレ10/コアレ20/ブースター/セラゼム/鍼/灸)の実施件数。 */
export async function getMonthlyTreatmentModalityCounts(period: ReportPeriod): Promise<TreatmentModalityCount[]> {
  const records = await prisma.chartRecord.findMany({
    where: { visit: { visitDate: { gte: period.start, lte: period.end } } },
    select: { treatmentModalities: true },
  });

  const counts = new Map<string, number>(TREATMENT_MODALITY_ITEMS.map((item) => [item, 0]));
  for (const record of records) {
    const modalities = record.treatmentModalities as Record<string, boolean> | null;
    if (!modalities) continue;
    for (const item of TREATMENT_MODALITY_ITEMS) {
      if (modalities[item]) counts.set(item, (counts.get(item) ?? 0) + 1);
    }
  }

  return TREATMENT_MODALITY_ITEMS.map((item) => ({ item, count: counts.get(item) ?? 0 }));
}
