import { prisma } from "@/lib/prisma";
import { ReservationStatus } from "@/app/generated/prisma/client";

// 会議・週報で使う集計ロジック。すべて期間(ReportPeriod)を受け取り、
// 「その期間にどうだったか」または「期間終了時点でどうか」を返す。
// 個々の関数は単体テストしやすいよう小さく保ち、getDashboardReport() でまとめて呼び出す。

export type ReportPeriod = { start: Date; end: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

/** 離脱判定・プリカ消化ペース検出のしきい値(6週間 = 42日)。要件どおり固定値。 */
export const CHURN_THRESHOLD_DAYS = 42;

/** 初回→2回目移行を計測する追跡ウィンドウ(8週間)。 */
export const SECOND_VISIT_FOLLOWUP_DAYS = 56;

export function granularityToPeriod(
  granularity: "week" | "month",
  reference: Date = new Date()
): ReportPeriod {
  if (granularity === "week") {
    const day = reference.getDay(); // 0=日
    const mondayOffset = (day + 6) % 7;
    const start = new Date(reference);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - mondayOffset);
    const end = new Date(start.getTime() + 7 * DAY_MS - 1);
    return { start, end };
  }
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * 「期間終了時点で在籍する顧客」等の“現在の状態”を問う指標で使う基準日。
 * 進行中の期間(今月・今週)は period.end が未来日になるため、
 * そのまま使うと「まだ来ていないだけの予約」が来店実績扱いになったり
 * 未来の予約が予約なし扱いになったりする。常に「今日」を超えないようにする。
 */
function asOfNow(period: ReportPeriod): Date {
  const now = new Date();
  return period.end.getTime() < now.getTime() ? period.end : now;
}

const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHANGED,
];

/** 全クライアントの「asOf時点での」最終来院日・来院回数を1クエリで取得する。 */
async function getVisitStatsAsOf(asOf: Date) {
  const rows = await prisma.visit.groupBy({
    by: ["clientId"],
    where: { visitDate: { lte: asOf } },
    _max: { visitDate: true },
    _count: { _all: true },
  });
  return new Map(
    rows.map((r) => [r.clientId, { lastVisitDate: r._max.visitDate!, visitCount: r._count._all }])
  );
}

async function getClientsWithFutureReservation(asOf: Date) {
  const rows = await prisma.reservation.findMany({
    where: { reservedAt: { gt: asOf }, status: { in: ACTIVE_RESERVATION_STATUSES } },
    select: { clientId: true },
    distinct: ["clientId"],
  });
  return new Set(rows.map((r) => r.clientId));
}

/** 離脱扱いのクライアントID一覧(最終来院から6週間以上 かつ 未来の予約なし)。 */
export async function getChurnedClientIds(asOf: Date = new Date()): Promise<string[]> {
  const [visitStats, futureReserved] = await Promise.all([
    getVisitStatsAsOf(asOf),
    getClientsWithFutureReservation(asOf),
  ]);
  const cutoff = asOf.getTime() - CHURN_THRESHOLD_DAYS * DAY_MS;
  const result: string[] = [];
  for (const [clientId, stats] of visitStats) {
    if (stats.lastVisitDate.getTime() <= cutoff && !futureReserved.has(clientId)) {
      result.push(clientId);
    }
  }
  return result;
}

/** 1. 新規来院数: 期間内に初回来店した人数 */
export async function countNewVisits(period: ReportPeriod) {
  return prisma.client.count({
    where: { firstVisitDate: { gte: period.start, lte: period.end } },
  });
}

/** 2. 離脱数(期間終了時点) */
export async function countChurned(period: ReportPeriod) {
  const ids = await getChurnedClientIds(asOfNow(period));
  return ids.length;
}

/** 3 / 4. n回以上のリピーター人数(期間終了時点) */
export async function countRepeatersAtLeast(period: ReportPeriod, minVisits: number) {
  const stats = await getVisitStatsAsOf(asOfNow(period));
  let count = 0;
  for (const s of stats.values()) if (s.visitCount >= minVisits) count++;
  return count;
}

/** 5. スタッフごとの担当患者数(期間終了時点の在籍顧客ベース) */
export async function getStaffCaseload(period: ReportPeriod) {
  const rows = await prisma.client.groupBy({
    by: ["primaryStaffId"],
    where: { firstVisitDate: { lte: asOfNow(period) } },
    _count: { _all: true },
  });
  const staff = await prisma.staff.findMany({ select: { id: true, name: true } });
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  return rows
    .filter((r) => r.primaryStaffId)
    .map((r) => ({
      staffId: r.primaryStaffId!,
      staffName: nameOf.get(r.primaryStaffId!) ?? "(不明)",
      clientCount: r._count._all,
    }))
    .sort((a, b) => b.clientCount - a.clientCount);
}

/** 6. 来店経路別人数(期間内の新規) */
export async function getChannelBreakdown(period: ReportPeriod) {
  const rows = await prisma.client.groupBy({
    by: ["acquisitionChannelId"],
    where: { firstVisitDate: { gte: period.start, lte: period.end } },
    _count: { _all: true },
  });
  const channels = await prisma.acquisitionChannel.findMany({ select: { id: true, name: true } });
  const nameOf = new Map(channels.map((c) => [c.id, c.name]));
  return rows
    .map((r) => ({
      channelId: r.acquisitionChannelId,
      channelName: r.acquisitionChannelId ? nameOf.get(r.acquisitionChannelId) ?? "(不明)" : "未設定",
      clientCount: r._count._all,
    }))
    .sort((a, b) => b.clientCount - a.clientCount);
}

type Cohort = { id: string; firstVisitDate: Date | null; referredById: string | null }[];

async function getNewClientCohort(period: ReportPeriod): Promise<Cohort> {
  return prisma.client.findMany({
    where: { firstVisitDate: { gte: period.start, lte: period.end } },
    select: { id: true, firstVisitDate: true, referredById: true },
  });
}

/** 7. 初回→2回目移行率(期間内新規のうち、追跡ウィンドウ内に2回目来店した割合) */
export async function getSecondVisitConversionRate(period: ReportPeriod) {
  const cohort = await getNewClientCohort(period);
  if (cohort.length === 0) return { cohortSize: 0, converted: 0, rate: null as number | null };

  const visits = await prisma.visit.findMany({
    where: { clientId: { in: cohort.map((c) => c.id) }, visitNo: 2 },
    select: { clientId: true, visitDate: true },
  });
  const secondVisitByClient = new Map(visits.map((v) => [v.clientId, v.visitDate]));

  let converted = 0;
  for (const c of cohort) {
    if (!c.firstVisitDate) continue;
    const second = secondVisitByClient.get(c.id);
    if (second && second.getTime() - c.firstVisitDate.getTime() <= SECOND_VISIT_FOLLOWUP_DAYS * DAY_MS) {
      converted++;
    }
  }
  return { cohortSize: cohort.length, converted, rate: converted / cohort.length };
}

/** 8. 紹介経由新規人数・紹介率(期間内新規のうち) */
export async function getReferralStats(period: ReportPeriod) {
  const cohort = await getNewClientCohort(period);
  const referred = cohort.filter((c) => c.referredById).length;
  return {
    cohortSize: cohort.length,
    referred,
    rate: cohort.length > 0 ? referred / cohort.length : null,
  };
}

/** 9. 平均通院回数・平均通院期間(期間終了時点で在籍する顧客ベース) */
export async function getAverageVisitStats(period: ReportPeriod) {
  const clients = await prisma.client.findMany({
    where: { firstVisitDate: { lte: asOfNow(period) } },
    select: { id: true, firstVisitDate: true },
  });
  const stats = await getVisitStatsAsOf(asOfNow(period));

  const counts: number[] = [];
  const spansDays: number[] = [];
  for (const c of clients) {
    const s = stats.get(c.id);
    if (!s || !c.firstVisitDate) continue;
    counts.push(s.visitCount);
    if (s.visitCount >= 2) {
      spansDays.push((s.lastVisitDate.getTime() - c.firstVisitDate.getTime()) / DAY_MS);
    }
  }
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  return {
    avgVisitCount: avg(counts),
    avgVisitSpanDays: avg(spansDays), // 2回目以降来店した顧客のみが対象(初回のみの顧客は期間0のため除外)
    sampleSize: counts.length,
  };
}

/** 10. スタッフ別リピート率(担当顧客のうち2回以上来店した割合) */
export async function getStaffRepeatRate(period: ReportPeriod) {
  const clients = await prisma.client.findMany({
    where: { firstVisitDate: { lte: asOfNow(period) }, primaryStaffId: { not: null } },
    select: { id: true, primaryStaffId: true },
  });
  const stats = await getVisitStatsAsOf(asOfNow(period));
  const staff = await prisma.staff.findMany({ select: { id: true, name: true } });
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));

  const byStaff = new Map<string, { total: number; repeat: number }>();
  for (const c of clients) {
    const s = stats.get(c.id);
    if (!s) continue;
    const key = c.primaryStaffId!;
    const cur = byStaff.get(key) ?? { total: 0, repeat: 0 };
    cur.total++;
    if (s.visitCount >= 2) cur.repeat++;
    byStaff.set(key, cur);
  }

  return Array.from(byStaff.entries())
    .map(([staffId, v]) => ({
      staffId,
      staffName: nameOf.get(staffId) ?? "(不明)",
      totalClients: v.total,
      repeatClients: v.repeat,
      repeatRate: v.total > 0 ? v.repeat / v.total : null,
    }))
    .sort((a, b) => (b.repeatRate ?? 0) - (a.repeatRate ?? 0));
}

/** 11. プリカ残高消化ペース検出: 残高が残っているのに離脱扱いになっているクライアント */
export async function getPrepaidDrainWithoutVisit(period: ReportPeriod) {
  const churnedIds = await getChurnedClientIds(asOfNow(period));
  if (churnedIds.length === 0) return [];

  const cards = await prisma.prepaidCard.findMany({
    where: { clientId: { in: churnedIds } },
    include: {
      client: { select: { id: true, name: true } },
      transactions: { select: { amount: true } },
    },
  });

  return cards
    .map((card) => ({
      clientId: card.client.id,
      clientName: card.client.name,
      balance: card.transactions.reduce((sum, t) => sum + t.amount, 0),
    }))
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance);
}

/** 12. 来院理由・部位別分布(期間内の来院分) */
export async function getComplaintAndBodyPartDistribution(period: ReportPeriod) {
  const rows = await prisma.chartRecord.findMany({
    where: { visit: { visitDate: { gte: period.start, lte: period.end } } },
    select: { chiefComplaintTags: true, bodyPartTags: true },
  });
  const tally = (lists: string[][]) => {
    const counts = new Map<string, number>();
    for (const tags of lists) for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  };
  return {
    chiefComplaints: tally(rows.map((r) => r.chiefComplaintTags)),
    bodyParts: tally(rows.map((r) => r.bodyPartTags)),
  };
}

/** ダッシュボード用: 12指標をまとめて取得する。 */
export async function getDashboardReport(period: ReportPeriod) {
  const [
    newVisits,
    churned,
    repeaters6plus,
    repeaters15plus,
    staffCaseload,
    channelBreakdown,
    secondVisitConversion,
    referral,
    averageVisitStats,
    staffRepeatRate,
    prepaidDrain,
    distribution,
  ] = await Promise.all([
    countNewVisits(period),
    countChurned(period),
    countRepeatersAtLeast(period, 6),
    countRepeatersAtLeast(period, 15),
    getStaffCaseload(period),
    getChannelBreakdown(period),
    getSecondVisitConversionRate(period),
    getReferralStats(period),
    getAverageVisitStats(period),
    getStaffRepeatRate(period),
    getPrepaidDrainWithoutVisit(period),
    getComplaintAndBodyPartDistribution(period),
  ]);

  return {
    period,
    newVisits,
    churned,
    repeaters6plus,
    repeaters15plus,
    staffCaseload,
    channelBreakdown,
    secondVisitConversion,
    referral,
    averageVisitStats,
    staffRepeatRate,
    prepaidDrain,
    distribution,
  };
}

export type DashboardReport = Awaited<ReturnType<typeof getDashboardReport>>;
