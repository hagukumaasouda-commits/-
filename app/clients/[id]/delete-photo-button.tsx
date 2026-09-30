"use client";

import { deleteClientPhoto } from "@/app/actions/client-photos";

export function DeletePhotoButton({ photoId }: { photoId: string }) {
  return (
    <form
      action={deleteClientPhoto.bind(null, photoId)}
      onSubmit={(e) => {
        if (!confirm("この写真を削除します。よろしいですか?")) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="text-rose-600 underline">
        削除
      </button>
    </form>
  );
}
