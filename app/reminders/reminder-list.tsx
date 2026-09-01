"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitReminder, type ReminderActionState } from "@/app/actions/reservations";

type ReminderRow = {
  id: string;
  reservedAt: string;
  clientId: string;
  clientName: string;
  hasLineUserId: boolean;
};

const reasonText: Record<string, string> = {
  no_token: "チャネルアクセストークン未設定のため送信できません",
  no_line_user_id: "この顧客はLINE未連携のため送信できません",
  api_error: "LINE APIでエラーが発生しました",
};

export default function ReminderList({ reservations }: { reservations: ReminderRow[] }) {
  if (reservations.length === 0) {
    return <p className="text-sm text-stone-400">3日以内の未送信リマインドはありません。</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
      {reservations.map((r) => (
        <ReminderRow key={r.id} reservation={r} />
      ))}
    </ul>
  );
}

function ReminderRow({ reservation }: { reservation: ReminderRow }) {
  const [state, formAction, isPending] = useActionState<ReminderActionState, FormData>(submitReminder, undefined);
  const result = state?.reservationId === reservation.id ? state.result : undefined;

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      <div>
        <Link href={`/clients/${reservation.clientId}`} className="font-medium text-emerald-800 hover:underline">
          {reservation.clientName}
        </Link>
        <span className="ml-2 text-stone-500">{reservation.reservedAt.slice(0, 16).replace("T", " ")}</span>
        {!reservation.hasLineUserId && (
          <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">LINE未連携</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {result && !result.ok && <span className="text-xs text-rose-600">{reasonText[result.reason]}</span>}
        {result?.ok && <span className="text-xs text-emerald-700">送信しました</span>}
        <form action={formAction}>
          <input type="hidden" name="reservationId" value={reservation.id} />
          <button
            disabled={isPending || result?.ok}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {isPending ? "送信中…" : "送信する"}
          </button>
        </form>
      </div>
    </li>
  );
}
