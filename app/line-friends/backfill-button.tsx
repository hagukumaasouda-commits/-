"use client";

import { useActionState } from "react";
import { backfillLineFriends, type BackfillResult } from "@/app/actions/line-friends";

export function BackfillButton() {
  const [state, formAction, isPending] = useActionState<BackfillResult | null, FormData>(backfillLineFriends, null);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-emerald-800 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
      >
        {isPending ? "取得中…" : "友だち一覧を取得(遡及登録)"}
      </button>
      {state?.status === "ok" && (
        <p className="text-xs text-stone-500">
          友だち{state.total}件中、新たに{state.created}件を登録しました。
        </p>
      )}
      {state?.status === "no_token" && (
        <p className="text-xs text-rose-600">LINE_CHANNEL_ACCESS_TOKENが未設定のため取得できません。</p>
      )}
      {state?.status === "error" && <p className="text-xs text-rose-600">取得に失敗しました。{state.detail ?? ""}</p>}
    </form>
  );
}
