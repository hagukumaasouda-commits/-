import { prisma } from "@/lib/prisma";
import type { ReportPeriod } from "@/lib/reports";
import { MENU_PLAN_OPTIONS } from "@/lib/tags";
import type { MenuPlan } from "@/app/generated/prisma/client";

export type MenuPlanCount = { value: MenuPlan; label: string; count: number };
export type StaffMenuPlanCounts = {
  staffId: string;
  staffName: string;
  counts: Record<string, number>;
  total: number;
};

/** 期間内の来院における本日のメニュー(プラン)選択の件数。treatment-modality-reports.tsと対になる集計。 */
export async function getMonthlyMenuPlanCounts(period: ReportPeriod): Promise<MenuPlanCount[]> {
  const records = await prisma.chartRecord.findMany({
    where: { visit: { visitDate: { gte: period.start, lte: period.end } }, menuPlan: { not: null } },
    select: { menuPlan: true },
  });

  const counts = new Map<MenuPlan, number>();
  for (const record of records) {
    if (!record.menuPlan) continue;
    counts.set(record.menuPlan, (counts.get(record.menuPlan) ?? 0) + 1);
  }

  return MENU_PLAN_OPTIONS.map((o) => ({ value: o.value, label: o.label, count: counts.get(o.value) ?? 0 }));
}

/** スタッフ別(実際に施術したstaffId基準)のメニュー(プラン)選択件数。 */
export async function getStaffMenuPlanCounts(period: ReportPeriod): Promise<StaffMenuPlanCounts[]> {
  const records = await prisma.chartRecord.findMany({
    where: { visit: { visitDate: { gte: period.start, lte: period.end } }, menuPlan: { not: null } },
    select: { menuPlan: true, visit: { select: { staffId: true, staff: { select: { name: true } } } } },
  });

  const byStaff = new Map<string, { staffName: string; counts: Map<MenuPlan, number> }>();
  for (const record of records) {
    if (!record.menuPlan) continue;
    const staffId = record.visit.staffId;
    const cur = byStaff.get(staffId) ?? { staffName: record.visit.staff.name, counts: new Map<MenuPlan, number>() };
    cur.counts.set(record.menuPlan, (cur.counts.get(record.menuPlan) ?? 0) + 1);
    byStaff.set(staffId, cur);
  }

  return Array.from(byStaff.entries())
    .map(([staffId, v]) => {
      const counts = Object.fromEntries(MENU_PLAN_OPTIONS.map((o) => [o.value, v.counts.get(o.value) ?? 0]));
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return { staffId, staffName: v.staffName, counts, total };
    })
    .sort((a, b) => b.total - a.total);
}
