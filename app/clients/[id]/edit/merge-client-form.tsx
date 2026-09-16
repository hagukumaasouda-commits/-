"use client";

import { useRef } from "react";
import { mergeClients } from "@/app/actions/clients";

export function MergeClientForm({
  clientId,
  clientName,
  mergeableClients,
}: {
  clientId: string;
  clientName: string;
  mergeableClients: { id: string; name: string }[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      action={mergeClients.bind(null, clientId)}
      onSubmit={(e) => {
        const value = inputRef.current?.value ?? "";
        if (
          !confirm(
            `「${value}」を${clientName}様に統合します。統合される側のプロフィールは削除され、来院記録・プリカ残高・物販記録などは${clientName}様に移されます。この操作は取り消せません。よろしいですか?`
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        ref={inputRef}
        type="text"
        list="merge-client-options"
        name="mergeClientQuery"
        placeholder="統合する(重複した)顧客を氏名で検索"
        autoComplete="off"
        required
        className="input flex-1 min-w-[220px]"
      />
      <datalist id="merge-client-options">
        {mergeableClients.map((c) => (
          <option key={c.id} value={`${c.name} #${c.id}`} />
        ))}
      </datalist>
      <button
        type="submit"
        className="rounded-md border border-amber-400 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
      >
        統合する
      </button>
    </form>
  );
}
