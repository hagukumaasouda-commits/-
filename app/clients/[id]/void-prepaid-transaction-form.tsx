"use client";

import { voidPrepaidTransaction } from "@/app/actions/prepaid";

export function VoidPrepaidTransactionForm({
  transactionId,
  confirmLabel,
}: {
  transactionId: string;
  confirmLabel: string;
}) {
  return (
    <details>
      <summary className="cursor-pointer text-xs text-rose-700 underline">取消</summary>
      <form
        action={voidPrepaidTransaction.bind(null, transactionId)}
        className="mt-1 flex flex-wrap items-center gap-1"
        onSubmit={(e) => {
          if (!confirm(`この取引(${confirmLabel})を取り消します。よろしいですか?`)) {
            e.preventDefault();
          }
        }}
      >
        <input name="voidReason" placeholder="取消理由(任意)" className="input py-1 text-xs flex-1 min-w-[140px]" />
        <button type="submit" className="rounded bg-rose-700 px-2 py-1 text-xs text-white">
          取消を確定する
        </button>
      </form>
    </details>
  );
}
