"use client";

import { useActionState } from "react";
import { runAwarenessCheck, type AwarenessCheckState } from "@/app/actions/awareness";

const initialState: AwarenessCheckState = { aiStatus: null };

export function AwarenessCheckButton({ visitId, visitNo }: { visitId: string; visitNo: number }) {
  const [state, formAction, isPending] = useActionState(runAwarenessCheck.bind(null, visitId), initialState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-emerald-800 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
      >
        {isPending ? "実行中…" : `最新来院(第${visitNo}回)を気づきチェックする`}
      </button>
      {state.aiStatus === "error" && (
        <p className="text-xs text-rose-600">AI気づきを実行できませんでした(設定を確認してください)。事務チェックは通常通り記録されています。</p>
      )}
      {state.aiStatus === "not_configured" && (
        <p className="text-xs text-stone-500">AI気づきは未設定のため実行されていません。事務チェックは通常通り記録されています。</p>
      )}
    </form>
  );
}
