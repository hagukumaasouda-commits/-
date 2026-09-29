"use client";

import { unlinkLineFriend } from "@/app/actions/line-friends";

export function UnlinkButton({ lineFriendId, clientName }: { lineFriendId: string; clientName: string }) {
  return (
    <form
      action={unlinkLineFriend.bind(null, lineFriendId)}
      onSubmit={(e) => {
        if (!confirm(`${clientName}様との紐づけを解除します。顧客情報自体は削除されません。よろしいですか?`)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50">
        紐づけ解除
      </button>
    </form>
  );
}
