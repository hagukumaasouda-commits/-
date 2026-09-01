import { prisma } from "@/lib/prisma";
import { ReservationStatus } from "@/app/generated/prisma/client";
import ReminderList from "./reminder-list";

export default async function RemindersPage() {
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const reservations = await prisma.reservation.findMany({
    where: {
      reservedAt: { gte: now, lte: soon },
      status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHANGED] },
      reminderSentAt: null,
    },
    include: { client: { select: { id: true, name: true, lineUserId: true } } },
    orderBy: { reservedAt: "asc" },
  });

  const hasToken = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">予約リマインド(3日以内・未送信)</h1>
        <p className="text-sm text-stone-500 mt-1">
          LINE公式アカウントの友だち連携が済んでいる顧客のみ自動送信できます。現時点では手動で「送信する」を押す運用です。
        </p>
      </div>

      {!hasToken && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <code className="font-mono">LINE_CHANNEL_ACCESS_TOKEN</code>{" "}
          が未設定のため、送信は失敗します。チャネルアクセストークンを発行して
          <code className="font-mono">.env</code> に設定してください。
        </div>
      )}

      <ReminderList
        reservations={reservations.map((r) => ({
          id: r.id,
          reservedAt: r.reservedAt.toISOString(),
          clientId: r.client.id,
          clientName: r.client.name,
          hasLineUserId: !!r.client.lineUserId,
        }))}
      />
    </div>
  );
}
