import { prisma } from "@/lib/prisma";
import { ReservationStatus, VisitInterval, RegistrationType } from "@/app/generated/prisma/client";

// 会議・週報で使う集計ロジック。すべて期間(ReportPeriod)を受け取り、
// 「その期間にどうだったか」または「期間終了時点でどうか」を返す。
// 個々の関数は単体テストしやすいよう小さく保ち、getDashboardReport() でまとめて呼び出す。

export type ReportPeriod = { start: Date; end: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

/** requiredVisitInterval が一度も記録されていない患者に使う離脱判定のフォールバックしきい値(6週間 = 42日)。 */
export const CHURN_THRESHOLD_DAYS = 42;

/** 必要来院ペースの日数換算(docs/departure-followup-spec-v2.md 2.1、v3で8段階に更新)。lib/awareness/ai-insight.ts でも離脱閾値の計算に使う単一の情報源。 */
export const VISIT_INTERVAL_DAYS: Record<VisitInterval, number> = {
  TWICE_OR_THRICE_WEEKLY: 3,
  WEEK1: 7,
  DAY10: 10,
  WEEK2: 14,
  WEEK3: 21,
  WEEK4: 28,
  MONTH2: 60,
  MONTH3: 90,
};

/** 離脱候補判定の倍率。「必要来院ペースの何倍」来院がなければ離脱候補とするか(docs/departure-followup-spec-v2.md 2.2)。 */
export const CHURN_INTERVAL_MULTIPLIER = 3;

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

/** 全クライアントの「asOf時点で直近に記録された」requiredVisitInterval(null は除く)。 */
async function getRequiredVisitIntervalsAsOf(asOf: Date) {
  const rows = await prisma.visit.findMany({
    where: { visitDate: { lte: asOf }, chartRecord: { requiredVisitInterval: { not: null } } },
    select: { clientId: true, chartRecord: { select: { requiredVisitInterval: true } } },
    orderBy: { visitDate: "desc" },
    distinct: ["clientId"],
  });
  return new Map(rows.map((r) => [r.clientId, r.chartRecord!.requiredVisitInterval!]));
}

/** 離脱扱いのクライアントID一覧(最終来院から「必要来院ペース×3」以上経過 かつ 未来の予約なし)。 */
export async function getChurnedClientIds(asOf: Date = new Date()): Promise<string[]> {
  const [visitStats, futureReserved, requiredIntervals] = await Promise.all([
    getVisitStatsAsOf(asOf),
    getClientsWithFutureReservation(asOf),
    getRequiredVisitIntervalsAsOf(asOf),
  ]);
  const result: string[] = [];
  for (const [clientId, stats] of visitStats) {
    if (futureReserved.has(clientId)) continue;
    const interval = requiredIntervals.get(clientId);
    const thresholdDays = interval
      ? VISIT_INTERVAL_DAYS[interval] * CHURN_INTERVAL_MULTIPLIER
      : CHURN_THRESHOLD_DAYS;
    const cutoff = asOf.getTime() - thresholdDays * DAY_MS;
    if (stats.lastVisitDate.getTime() <= cutoff) {
      result.push(clientId);
    }
  }
  return result;
}

export type NewClientRow = { clientId: string; clientName: string; firstVisitDate: Date; staffId: string | null; staffName: string };

/** 1. 新規来院数の対象顧客一覧(期間内に初回来店した、真の新患のみ)。docs/dashboard-staff-breakdown-spec-v2.md ③ */
export async function getNewClientsInPeriod(period: ReportPeriod): Promise<NewClientRow[]> {
  const [clients, staff] = await Promise.all([
    prisma.client.findMany({
      where: { firstVisitDate: { gte: period.start, lte: period.end }, registrationType: RegistrationType.NEW },
      select: { id: true, name: true, firstVisitDate: true, primaryStaffId: true },
      orderBy: { firstVisitDate: "asc" },
    }),
    prisma.staff.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  return clients.map((c) => ({
    clientId: c.id,
    clientName: c.name,
    firstVisitDate: c.firstVisitDate!,
    staffId: c.primaryStaffId,
    staffName: c.primaryStaffId ? (nameOf.get(c.primaryStaffId) ?? "(不明)") : "未設定",
  }));
}

/** 1. 新規来院数: 期間内に初回来店した人数(真の新患のみ。既存患者のデータ移行は含めない) */
export async function countNewVisits(period: ReportPeriod) {
  return (await getNewClientsInPeriod(period)).length;
}

export type ChurnedClientRow = { clientId: string; clientName: string; lastVisitDate: Date; staffId: string | null; staffName: string };

/** 2. 離脱扱いの顧客一覧(期間終了時点)。docs/dashboard-staff-breakdown-spec-v2.md ③ */
export async function getChurnedClientRows(period: ReportPeriod): Promise<ChurnedClientRow[]> {
  const asOf = asOfNow(period);
  const ids = await getChurnedClientIds(asOf);
  if (ids.length === 0) return [];
  const [clients, stats, staff] = await Promise.all([
    prisma.client.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, primaryStaffId: true } }),
    getVisitStatsAsOf(asOf),
    prisma.staff.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  return clients
    .map((c) => ({
      clientId: c.id,
      clientName: c.name,
      lastVisitDate: stats.get(c.id)!.lastVisitDate,
      staffId: c.primaryStaffId,
      staffName: c.primaryStaffId ? (nameOf.get(c.primaryStaffId) ?? "(不明)") : "未設定",
    }))
    .sort((a, b) => a.lastVisitDate.getTime() - b.lastVisitDate.getTime());
}

/** 2. 離脱数(期間終了時点) */
export async function countChurned(period: ReportPeriod) {
  return (await getChurnedClientRows(period)).length;
}

/**
 * 3 / 4. n回以上のリピーター人数(現在時点での通算来院回数。docs/dashboard-staff-breakdown-spec-v2.md ④)。
 * ダッシュボードの期間選択(週次/月次・前後移動)から独立し、常に「今」時点での累計で判定する
 * (getBirthdayClientsThisMonthと同じ考え方。過去の期間を表示しても数字が変わらない)。
 */
export async function countRepeatersAtLeast(minVisits: number) {
  const stats = await getVisitStatsAsOf(new Date());
  let count = 0;
  for (const s of stats.values()) if (s.visitCount >= minVisits) count++;
  return count;
}

/** スタッフ別のn回以上リピーター人数(現在時点での通算来院回数、担当顧客のうち)。母数はgetStaffCaseloadと同じ定義。 */
export async function getStaffRepeatersAtLeast(minVisits: number) {
  const now = new Date();
  const [clients, stats, staff] = await Promise.all([
    prisma.client.findMany({
      where: { firstVisitDate: { lte: now }, primaryStaffId: { not: null } },
      select: { id: true, primaryStaffId: true },
    }),
    getVisitStatsAsOf(now),
    prisma.staff.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));

  const byStaff = new Map<string, number>();
  for (const c of clients) {
    const s = stats.get(c.id);
    if (s && s.visitCount >= minVisits) {
      const key = c.primaryStaffId!;
      byStaff.set(key, (byStaff.get(key) ?? 0) + 1);
    }
  }
  return Array.from(byStaff.entries())
    .map(([staffId, count]) => ({ staffId, staffName: nameOf.get(staffId) ?? "(不明)", count }))
    .sort((a, b) => b.count - a.count);
}

/** 全体の離脱率(期間終了時点で在籍する全顧客のうち、離脱扱いになっている割合) */
export async function getOverallChurnRate(period: ReportPeriod) {
  const asOf = asOfNow(period);
  const [totalClients, churnedIds] = await Promise.all([
    prisma.client.count({ where: { firstVisitDate: { lte: asOf } } }),
    getChurnedClientIds(asOf),
  ]);
  return {
    totalClients,
    churnedClients: churnedIds.length,
    rate: totalClients > 0 ? churnedIds.length / totalClients : null,
  };
}

/** スタッフ別離脱率(担当顧客のうち離脱扱いになっている割合) */
export async function getStaffChurnRate(period: ReportPeriod) {
  const asOf = asOfNow(period);
  const [clients, churnedIds, staff] = await Promise.all([
    prisma.client.findMany({
      where: { firstVisitDate: { lte: asOf }, primaryStaffId: { not: null } },
      select: { id: true, primaryStaffId: true },
    }),
    getChurnedClientIds(asOf),
    prisma.staff.findMany({ select: { id: true, name: true } }),
  ]);
  const churnedSet = new Set(churnedIds);
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));

  const byStaff = new Map<string, { total: number; churned: number }>();
  for (const c of clients) {
    const key = c.primaryStaffId!;
    const cur = byStaff.get(key) ?? { total: 0, churned: 0 };
    cur.total++;
    if (churnedSet.has(c.id)) cur.churned++;
    byStaff.set(key, cur);
  }

  return Array.from(byStaff.entries())
    .map(([staffId, v]) => ({
      staffId,
      staffName: nameOf.get(staffId) ?? "(不明)",
      totalClients: v.total,
      churnedClients: v.churned,
      rate: v.total > 0 ? v.churned / v.total : null,
    }))
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
}

/** 期間内に1回以上来院した顧客IDの集合(月次集計の母数を「その月に来た人」に揃えるための共通ヘルパー)。 */
async function getActiveClientIdsInPeriod(period: ReportPeriod): Promise<Set<string>> {
  const rows = await prisma.visit.findMany({
    where: { visitDate: { gte: period.start, lte: period.end } },
    select: { clientId: true },
    distinct: ["clientId"],
  });
  return new Set(rows.map((r) => r.clientId));
}

/**
 * 全体のn回以上リピーター率。母数を「その月(期間)に来院した顧客」に限定し、そのうち
 * 通算n回以上来店している(=リピーターである)割合を返す。初回→2回目移行率・紹介率と
 * 同じく「その月の数字」になるよう、期間終了時点の在籍者全員ではなく期間内の来院者を母数にする。
 */
export async function getRepeaterRateAtLeast(period: ReportPeriod, minVisits: number) {
  const asOf = asOfNow(period);
  const [activeClientIds, stats] = await Promise.all([getActiveClientIdsInPeriod(period), getVisitStatsAsOf(asOf)]);

  let repeaterClients = 0;
  for (const clientId of activeClientIds) {
    const s = stats.get(clientId);
    if (s && s.visitCount >= minVisits) repeaterClients++;
  }
  return {
    totalClients: activeClientIds.size,
    repeaterClients,
    rate: activeClientIds.size > 0 ? repeaterClients / activeClientIds.size : null,
  };
}

/** スタッフ別n回以上リピーター率(その月に来院した担当顧客のうち、n回以上来店した割合)。母数の定義は getRepeaterRateAtLeast と同じ。 */
export async function getStaffRepeaterRateAtLeast(period: ReportPeriod, minVisits: number) {
  const asOf = asOfNow(period);
  const [activeClientIds, clients, stats, staff] = await Promise.all([
    getActiveClientIdsInPeriod(period),
    prisma.client.findMany({
      where: { primaryStaffId: { not: null } },
      select: { id: true, primaryStaffId: true },
    }),
    getVisitStatsAsOf(asOf),
    prisma.staff.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));

  const byStaff = new Map<string, { total: number; repeaters: number }>();
  for (const c of clients) {
    if (!activeClientIds.has(c.id)) continue;
    const s = stats.get(c.id);
    const key = c.primaryStaffId!;
    const cur = byStaff.get(key) ?? { total: 0, repeaters: 0 };
    cur.total++;
    if (s && s.visitCount >= minVisits) cur.repeaters++;
    byStaff.set(key, cur);
  }

  return Array.from(byStaff.entries())
    .map(([staffId, v]) => ({
      staffId,
      staffName: nameOf.get(staffId) ?? "(不明)",
      totalClients: v.total,
      repeaterClients: v.repeaters,
      rate: v.total > 0 ? v.repeaters / v.total : null,
    }))
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
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

type Cohort = { id: string; firstVisitDate: Date | null; referralSourceClientId: string | null; primaryStaffId: string | null }[];

async function getNewClientCohort(period: ReportPeriod): Promise<Cohort> {
  return prisma.client.findMany({
    where: { firstVisitDate: { gte: period.start, lte: period.end } },
    select: { id: true, firstVisitDate: true, referralSourceClientId: true, primaryStaffId: true },
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

/** スタッフ別 初回→2回目移行率(新規顧客のprimaryStaffId基準)。 */
export async function getStaffSecondVisitConversionRate(period: ReportPeriod) {
  const cohort = await getNewClientCohort(period);
  const staff = await prisma.staff.findMany({ select: { id: true, name: true } });
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  if (cohort.length === 0) return [];

  const visits = await prisma.visit.findMany({
    where: { clientId: { in: cohort.map((c) => c.id) }, visitNo: 2 },
    select: { clientId: true, visitDate: true },
  });
  const secondVisitByClient = new Map(visits.map((v) => [v.clientId, v.visitDate]));

  const byStaff = new Map<string, { cohortSize: number; converted: number }>();
  for (const c of cohort) {
    if (!c.primaryStaffId || !c.firstVisitDate) continue;
    const cur = byStaff.get(c.primaryStaffId) ?? { cohortSize: 0, converted: 0 };
    cur.cohortSize++;
    const second = secondVisitByClient.get(c.id);
    if (second && second.getTime() - c.firstVisitDate.getTime() <= SECOND_VISIT_FOLLOWUP_DAYS * DAY_MS) {
      cur.converted++;
    }
    byStaff.set(c.primaryStaffId, cur);
  }

  return Array.from(byStaff.entries())
    .map(([staffId, v]) => ({
      staffId,
      staffName: nameOf.get(staffId) ?? "(不明)",
      cohortSize: v.cohortSize,
      converted: v.converted,
      rate: v.cohortSize > 0 ? v.converted / v.cohortSize : null,
    }))
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
}

/** 8. 紹介経由新規人数・紹介率(期間内新規のうち) */
export async function getReferralStats(period: ReportPeriod) {
  const cohort = await getNewClientCohort(period);
  const referred = cohort.filter((c) => c.referralSourceClientId).length;
  return {
    cohortSize: cohort.length,
    referred,
    rate: cohort.length > 0 ? referred / cohort.length : null,
  };
}

/** スタッフ別 紹介率(新規顧客のprimaryStaffId基準)。 */
export async function getStaffReferralStats(period: ReportPeriod) {
  const cohort = await getNewClientCohort(period);
  const staff = await prisma.staff.findMany({ select: { id: true, name: true } });
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));

  const byStaff = new Map<string, { cohortSize: number; referred: number }>();
  for (const c of cohort) {
    if (!c.primaryStaffId) continue;
    const cur = byStaff.get(c.primaryStaffId) ?? { cohortSize: 0, referred: 0 };
    cur.cohortSize++;
    if (c.referralSourceClientId) cur.referred++;
    byStaff.set(c.primaryStaffId, cur);
  }

  return Array.from(byStaff.entries())
    .map(([staffId, v]) => ({
      staffId,
      staffName: nameOf.get(staffId) ?? "(不明)",
      cohortSize: v.cohortSize,
      referred: v.referred,
      rate: v.cohortSize > 0 ? v.referred / v.cohortSize : null,
    }))
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
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

/** スタッフ別 平均通院回数・平均通院期間(担当顧客ベース)。 */
export async function getStaffAverageVisitStats(period: ReportPeriod) {
  const asOf = asOfNow(period);
  const [clients, stats, staff] = await Promise.all([
    prisma.client.findMany({
      where: { firstVisitDate: { lte: asOf }, primaryStaffId: { not: null } },
      select: { id: true, firstVisitDate: true, primaryStaffId: true },
    }),
    getVisitStatsAsOf(asOf),
    prisma.staff.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));

  const byStaff = new Map<string, { counts: number[]; spans: number[] }>();
  for (const c of clients) {
    const s = stats.get(c.id);
    if (!s || !c.firstVisitDate) continue;
    const key = c.primaryStaffId!;
    const cur = byStaff.get(key) ?? { counts: [], spans: [] };
    cur.counts.push(s.visitCount);
    if (s.visitCount >= 2) cur.spans.push((s.lastVisitDate.getTime() - c.firstVisitDate.getTime()) / DAY_MS);
    byStaff.set(key, cur);
  }
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  return Array.from(byStaff.entries())
    .map(([staffId, v]) => ({
      staffId,
      staffName: nameOf.get(staffId) ?? "(不明)",
      avgVisitCount: avg(v.counts),
      avgVisitSpanDays: avg(v.spans),
    }))
    .sort((a, b) => (b.avgVisitCount ?? 0) - (a.avgVisitCount ?? 0));
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

/**
 * 誕生月アラート: 生年月日が登録されている顧客のうち、当月が誕生月の人を日付順に返す。
 * ダッシュボードの期間切り替え(週次/月次・前後移動)とは独立に、常に「実際の今月」を基準にする
 * (スタッフへの声かけリマインドが目的のため、過去・未来の期間表示では意味がない)。
 */
export type BirthdayClient = { clientId: string; clientName: string; dob: Date; isActive: boolean; phone: string | null };

export async function getBirthdayClientsThisMonth(asOf: Date = new Date()): Promise<BirthdayClient[]> {
  const clients = await prisma.client.findMany({
    where: { dob: { not: null } },
    select: { id: true, name: true, dob: true, isActive: true, phone: true },
  });
  const month = asOf.getUTCMonth();
  return clients
    .filter((c) => c.dob!.getUTCMonth() === month)
    .map((c) => ({ clientId: c.id, clientName: c.name, dob: c.dob!, isActive: c.isActive, phone: c.phone }))
    .sort((a, b) => a.dob.getUTCDate() - b.dob.getUTCDate());
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

/**
 * 13. 再診数(離脱後の復帰、docs/referral-source-registration-type-spec-v2.md)。
 * 期間内に作成された来院記録のうち、以下いずれかを満たすものを1件としてカウントする(重複カウントはしない)。
 *   (A) その顧客のdepartureRecordのうち、confirmedAtより後で初めての来院である(離脱記録ごとに1回まで)
 *   (B) その来院のChartRecord.isManualReturnFlagがtrue
 */
export type ReturnVisitRow = { visitId: string; clientId: string; clientName: string; visitDate: Date; staffId: string; staffName: string };

/** 13. 再診数(離脱後の復帰)の対象来院一覧。docs/dashboard-staff-breakdown-spec-v2.md ③ */
export async function getReturnVisitRows(period: ReportPeriod): Promise<ReturnVisitRow[]> {
  const countedVisitIds = new Set<string>();

  const departures = await prisma.departureRecord.findMany({
    select: { clientId: true, confirmedAt: true },
  });
  if (departures.length > 0) {
    const clientIds = Array.from(new Set(departures.map((d) => d.clientId)));
    const visits = await prisma.visit.findMany({
      where: { clientId: { in: clientIds } },
      select: { id: true, clientId: true, visitDate: true },
      orderBy: { visitDate: "asc" },
    });
    const visitsByClient = new Map<string, { id: string; visitDate: Date }[]>();
    for (const v of visits) {
      const list = visitsByClient.get(v.clientId);
      if (list) list.push(v);
      else visitsByClient.set(v.clientId, [v]);
    }
    for (const d of departures) {
      const firstAfter = (visitsByClient.get(d.clientId) ?? []).find(
        (v) => v.visitDate.getTime() > d.confirmedAt.getTime()
      );
      if (firstAfter && firstAfter.visitDate >= period.start && firstAfter.visitDate <= period.end) {
        countedVisitIds.add(firstAfter.id);
      }
    }
  }

  const manualFlagged = await prisma.visit.findMany({
    where: { visitDate: { gte: period.start, lte: period.end }, chartRecord: { isManualReturnFlag: true } },
    select: { id: true },
  });
  for (const v of manualFlagged) countedVisitIds.add(v.id);

  if (countedVisitIds.size === 0) return [];

  const [visits, staff] = await Promise.all([
    prisma.visit.findMany({
      where: { id: { in: Array.from(countedVisitIds) } },
      select: { id: true, clientId: true, visitDate: true, staffId: true, client: { select: { name: true } } },
      orderBy: { visitDate: "desc" },
    }),
    prisma.staff.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  return visits.map((v) => ({
    visitId: v.id,
    clientId: v.clientId,
    clientName: v.client.name,
    visitDate: v.visitDate,
    staffId: v.staffId,
    staffName: nameOf.get(v.staffId) ?? "(不明)",
  }));
}

export async function countReturnVisits(period: ReportPeriod): Promise<number> {
  return (await getReturnVisitRows(period)).length;
}

/** 期間内の一覧行をスタッフ別に集計する共通ヘルパー(新規・再診・カルテ枚数など「件数」系の指標に使う)。 */
function tallyByStaff(rows: { staffId: string | null; staffName: string }[]) {
  const byStaff = new Map<string, { staffName: string; count: number }>();
  for (const r of rows) {
    if (!r.staffId) continue;
    const cur = byStaff.get(r.staffId) ?? { staffName: r.staffName, count: 0 };
    cur.count++;
    byStaff.set(r.staffId, cur);
  }
  return Array.from(byStaff.entries())
    .map(([staffId, v]) => ({ staffId, staffName: v.staffName, count: v.count }))
    .sort((a, b) => b.count - a.count);
}

/** スタッフ別 新規来院数(新規顧客のprimaryStaffId基準)。 */
export async function getStaffNewClientCounts(period: ReportPeriod) {
  return tallyByStaff(await getNewClientsInPeriod(period));
}

/** スタッフ別 再診数(その来院を担当したstaffId基準)。 */
export async function getStaffReturnVisitCounts(period: ReportPeriod) {
  return tallyByStaff(await getReturnVisitRows(period));
}

/** 期間内のカルテ枚数(ChartRecord件数。1来院=1カルテのため実質「総来院件数」と同義)。 */
export async function countChartRecords(period: ReportPeriod) {
  return prisma.chartRecord.count({ where: { visit: { visitDate: { gte: period.start, lte: period.end } } } });
}

/** スタッフ別 カルテ枚数(その来院を担当したstaffId基準)。docs/dashboard-staff-breakdown-spec-v2.md ⑤ */
export async function getStaffChartRecordCounts(period: ReportPeriod) {
  const rows = await prisma.chartRecord.findMany({
    where: { visit: { visitDate: { gte: period.start, lte: period.end } } },
    select: { visit: { select: { staffId: true, staff: { select: { name: true } } } } },
  });
  return tallyByStaff(rows.map((r) => ({ staffId: r.visit.staffId, staffName: r.visit.staff.name })));
}

/** ダッシュボード用: 12指標をまとめて取得する。 */
export async function getDashboardReport(period: ReportPeriod) {
  const [
    newClients,
    churnedClients,
    overallChurnRate,
    staffChurnRate,
    repeaters6plus,
    repeaters15plus,
    staffRepeaters15plus,
    repeaterRate6plus,
    staffRepeaterRate6plus,
    staffCaseload,
    channelBreakdown,
    secondVisitConversion,
    staffSecondVisitConversion,
    referral,
    staffReferralStats,
    averageVisitStats,
    staffAverageVisitStats,
    staffRepeatRate,
    prepaidDrain,
    distribution,
    returnVisitRows,
    staffNewClientCounts,
    staffReturnVisitCounts,
    chartRecordCount,
    staffChartRecordCounts,
  ] = await Promise.all([
    getNewClientsInPeriod(period),
    getChurnedClientRows(period),
    getOverallChurnRate(period),
    getStaffChurnRate(period),
    countRepeatersAtLeast(6),
    countRepeatersAtLeast(15),
    getStaffRepeatersAtLeast(15),
    getRepeaterRateAtLeast(period, 6),
    getStaffRepeaterRateAtLeast(period, 6),
    getStaffCaseload(period),
    getChannelBreakdown(period),
    getSecondVisitConversionRate(period),
    getStaffSecondVisitConversionRate(period),
    getReferralStats(period),
    getStaffReferralStats(period),
    getAverageVisitStats(period),
    getStaffAverageVisitStats(period),
    getStaffRepeatRate(period),
    getPrepaidDrainWithoutVisit(period),
    getComplaintAndBodyPartDistribution(period),
    getReturnVisitRows(period),
    getStaffNewClientCounts(period),
    getStaffReturnVisitCounts(period),
    countChartRecords(period),
    getStaffChartRecordCounts(period),
  ]);

  return {
    period,
    newVisits: newClients.length,
    newClients,
    churned: churnedClients.length,
    churnedClients,
    overallChurnRate,
    staffChurnRate,
    repeaters6plus,
    repeaters15plus,
    staffRepeaters15plus,
    repeaterRate6plus,
    staffRepeaterRate6plus,
    staffCaseload,
    channelBreakdown,
    secondVisitConversion,
    staffSecondVisitConversion,
    referral,
    staffReferralStats,
    averageVisitStats,
    staffAverageVisitStats,
    staffRepeatRate,
    prepaidDrain,
    distribution,
    returnVisits: returnVisitRows.length,
    returnVisitRows,
    staffNewClientCounts,
    staffReturnVisitCounts,
    chartRecordCount,
    staffChartRecordCounts,
  };
}

export type DashboardReport = Awaited<ReturnType<typeof getDashboardReport>>;
