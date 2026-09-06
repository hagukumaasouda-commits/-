import { prisma } from "@/lib/prisma";
import { getChurnedClientIds } from "@/lib/reports";
import { ReservationStatus, AppointmentStatus } from "@/app/generated/prisma/client";

// 離脱フォローアップ(docs/departure-followup-spec-v2.md)。
// 離脱候補・キャンセル後未予約候補は DepartureRecord を作らず都度計算する(2.2 / 2.5(a))。
// スタッフが実際に「離脱を記録する」操作をした時点でのみ DepartureRecord が作られる。

const DAY_MS = 24 * 60 * 60 * 1000;

/** キャンセル後、この日数以内に新規予約が入らなければ候補とする(2.5)。 */
export const CANCELLATION_FOLLOWUP_DAYS = 21;

export type DepartureCandidate = {
  clientId: string;
  clientName: string;
  trigger: "pace" | "cancellation";
  source?: "reservation" | "manual";
  lastVisitDate: Date | null;
  cancelledReservedAt: Date | null;
};

/** 来院ペースの乖離による離脱候補(まだ isActive=true、つまり未確定のもののみ)。 */
async function getPaceBasedCandidates(asOf: Date): Promise<DepartureCandidate[]> {
  const churnedIds = await getChurnedClientIds(asOf);
  if (churnedIds.length === 0) return [];

  const clients = await prisma.client.findMany({
    where: { id: { in: churnedIds }, isActive: true },
    select: { id: true, name: true, visits: { orderBy: { visitDate: "desc" }, take: 1, select: { visitDate: true } } },
  });

  return clients.map((c) => ({
    clientId: c.id,
    clientName: c.name,
    trigger: "pace" as const,
    lastVisitDate: c.visits[0]?.visitDate ?? null,
    cancelledReservedAt: null,
  }));
}

/** キャンセル後、CANCELLATION_FOLLOWUP_DAYS 以内に新規予約が無い候補(まだ isActive=true のもののみ)。 */
async function getCancellationBasedCandidates(asOf: Date): Promise<DepartureCandidate[]> {
  // クライアントごとの最新予約(reservedAt降順で1件) = それが CANCELLED かつ古ければ、以降新規予約が無いということ
  const latestReservations = await prisma.reservation.findMany({
    where: { reservedAt: { lte: asOf } },
    orderBy: { reservedAt: "desc" },
    distinct: ["clientId"],
    select: { clientId: true, status: true, reservedAt: true },
  });

  const cutoff = asOf.getTime() - CANCELLATION_FOLLOWUP_DAYS * DAY_MS;
  const candidates = latestReservations.filter(
    (r) => r.status === ReservationStatus.CANCELLED && r.reservedAt.getTime() <= cutoff
  );
  if (candidates.length === 0) return [];

  const clients = await prisma.client.findMany({
    where: { id: { in: candidates.map((c) => c.clientId) }, isActive: true },
    select: { id: true, name: true },
  });
  const clientNames = new Map(clients.map((c) => [c.id, c.name]));

  return candidates
    .filter((c) => clientNames.has(c.clientId))
    .map((c) => ({
      clientId: c.clientId,
      clientName: clientNames.get(c.clientId)!,
      trigger: "cancellation" as const,
      source: "reservation" as const,
      lastVisitDate: null,
      cancelledReservedAt: c.reservedAt,
    }));
}

/**
 * 次回予約・キャンセル記録(docs/next-appointment-cancellation-spec-v2.md)由来のキャンセル後未予約候補。
 * appointmentStatus=CANCELLED かつ cancelledAt から CANCELLATION_FOLLOWUP_DAYS 以上経過(まだ isActive=true のもののみ)。
 */
async function getManualCancellationCandidates(asOf: Date): Promise<DepartureCandidate[]> {
  const cutoff = new Date(asOf.getTime() - CANCELLATION_FOLLOWUP_DAYS * DAY_MS);

  const clients = await prisma.client.findMany({
    where: { isActive: true, appointmentStatus: AppointmentStatus.CANCELLED, cancelledAt: { lte: cutoff } },
    select: { id: true, name: true, cancelledAt: true },
  });

  return clients.map((c) => ({
    clientId: c.id,
    clientName: c.name,
    trigger: "cancellation" as const,
    source: "manual" as const,
    lastVisitDate: null,
    cancelledReservedAt: c.cancelledAt,
  }));
}

/** 離脱候補一覧(都度計算・保存不要)。ペース基準とキャンセル後未予約(予約CSV由来・手動記録由来)の両方を合わせて返す。 */
export async function getDepartureCandidates(asOf: Date = new Date()): Promise<DepartureCandidate[]> {
  const [pace, reservationCancellation, manualCancellation] = await Promise.all([
    getPaceBasedCandidates(asOf),
    getCancellationBasedCandidates(asOf),
    getManualCancellationCandidates(asOf),
  ]);
  // 同一顧客が両方のキャンセル経路に該当する場合、呼び出し側の重複排除ロジックが後勝ちで扱うため、
  // より正確な起点日を持つ手動記録(manual)を最後に置いて優先させる。
  return [...pace, ...reservationCancellation, ...manualCancellation];
}
