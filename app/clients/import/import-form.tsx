"use client";

import { useActionState } from "react";
import { importClientMigrationCsv, type ClientImportSummary } from "@/app/actions/clients-import";

export default function ClientImportForm() {
  const [state, formAction, isPending] = useActionState<ClientImportSummary | undefined, FormData>(
    importClientMigrationCsv,
    undefined
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex items-center gap-3">
        <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isPending ? "取り込み中…" : "取り込む"}
        </button>
      </form>

      {state && !state.ok && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">{state.formatError}</div>
      )}

      {state && state.ok && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="対象行数" value={state.totalDataRows} />
            <Stat label="新規顧客" value={state.clientsCreated} />
            <Stat label="既存顧客に一致" value={state.clientsMatched} />
            <Stat label="ランク記録" value={state.ranksRecorded} />
            <Stat label="来院履歴を初期化" value={state.seedVisitsCreated} />
          </div>

          {state.skipped.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
              <p className="font-medium text-amber-900 mb-2">スキップした行({state.skipped.length}件)</p>
              <ul className="flex flex-col gap-1 text-xs text-amber-800 max-h-48 overflow-y-auto">
                {state.skipped.map((s, i) => (
                  <li key={i}>
                    {s.line}行目: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
              <p className="font-medium text-amber-900 mb-2">警告(顧客自体は取り込み済み・{state.warnings.length}件)</p>
              <ul className="flex flex-col gap-1 text-xs text-amber-800 max-h-48 overflow-y-auto">
                {state.warnings.map((w, i) => (
                  <li key={i}>
                    {w.line}行目({w.clientNumber}): {w.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.dbErrors.length > 0 && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm">
              <p className="font-medium text-rose-900 mb-2">保存に失敗した行({state.dbErrors.length}件)</p>
              <ul className="flex flex-col gap-1 text-xs text-rose-800 max-h-48 overflow-y-auto">
                {state.dbErrors.map((e, i) => (
                  <li key={i}>
                    {e.line}行目({e.clientNumber}): {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.skipped.length === 0 && state.warnings.length === 0 && state.dbErrors.length === 0 && (
            <p className="text-sm text-emerald-700">すべての行を問題なく取り込みました。</p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-stone-900">{value}</div>
    </div>
  );
}
