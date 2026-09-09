"use client";

import { deleteVisit } from "@/app/actions/visits";

export function DeleteVisitButton({ visitId, visitNo }: { visitId: string; visitNo: number }) {
  return (
    <form
      action={deleteVisit.bind(null, visitId)}
      onSubmit={(e) => {
        if (!confirm(`第${visitNo}回の来院記録を削除します。この操作は取り消せません。よろしいですか?`)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="text-xs text-rose-700 underline w-fit">
        この記録を削除する
      </button>
    </form>
  );
}
