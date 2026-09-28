import { prisma } from "@/lib/prisma";
import type { ReportPeriod } from "@/lib/reports";
import { TREATMENT_MODALITY_ITEMS } from "@/lib/tags";

export type TreatmentModalityCount = { item: string; count: number };
export type StaffTreatmentModalityCounts = {
  staffId: string;
  staffName: string;
  counts: Record<string, number>;
  total: number;
};

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

/** スタッフ別(実際に施術したstaffId基準)の物療チェック実施件数。docs/dashboard-staff-breakdown-spec-v2.md ② */
export async function getStaffTreatmentModalityCounts(period: ReportPeriod): Promise<StaffTreatmentModalityCounts[]> {
  const records = await prisma.chartRecord.findMany({
    where: { visit: { visitDate: { gte: period.start, lte: period.end } } },
    select: { treatmentModalities: true, visit: { select: { staffId: true, staff: { select: { name: true } } } } },
  });

  const byStaff = new Map<string, { staffName: string; counts: Map<string, number> }>();
  for (const record of records) {
    const modalities = record.treatmentModalities as Record<string, boolean> | null;
    if (!modalities) continue;
    const staffId = record.visit.staffId;
    const cur = byStaff.get(staffId) ?? {
      staffName: record.visit.staff.name,
      counts: new Map(TREATMENT_MODALITY_ITEMS.map((item) => [item, 0])),
    };
    for (const item of TREATMENT_MODALITY_ITEMS) {
      if (modalities[item]) cur.counts.set(item, (cur.counts.get(item) ?? 0) + 1);
    }
    byStaff.set(staffId, cur);
  }

  return Array.from(byStaff.entries())
    .map(([staffId, v]) => {
      const counts = Object.fromEntries(TREATMENT_MODALITY_ITEMS.map((item) => [item, v.counts.get(item) ?? 0]));
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return { staffId, staffName: v.staffName, counts, total };
    })
    .sort((a, b) => b.total - a.total);
}
