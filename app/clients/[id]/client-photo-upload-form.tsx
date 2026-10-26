"use client";

import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { CLIENT_PHOTO_CATEGORY_OPTIONS } from "@/lib/tags";
import { requestClientPhotoUpload, finalizeClientPhoto } from "@/app/actions/client-photos";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET = "client-photos";

export function ClientPhotoUploadForm({ clientId }: { clientId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("画像ファイルを選択してください");
      return;
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setError("アップロード設定が未完了です(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 未設定)");
      return;
    }

    setUploading(true);
    try {
      // 画像本体はVercelのサーバー関数を経由させず、署名付きアップロードURLでブラウザから
      // Supabase Storageへ直接送る(docs/client-photos-upload-fix-v2.md)。
      const { path, token } = await requestClientPhotoUpload(clientId, file.name);

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(path, token, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) throw new Error(uploadError.message);

      const payload = new FormData();
      payload.set("storagePath", path);
      payload.set("category", String(formData.get("category") || ""));
      payload.set("takenAt", String(formData.get("takenAt") || ""));
      payload.set("note", String(formData.get("note") || ""));
      await finalizeClientPhoto(clientId, payload);

      formRef.current?.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-md border border-stone-200 bg-stone-50 p-3 mb-4"
    >
      {error && <p className="w-full text-xs text-rose-600">{error}</p>}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-600">
          区分<span className="text-rose-600"> *</span>
        </span>
        <select name="category" required defaultValue="" className="input">
          <option value="" disabled>
            選択してください
          </option>
          {CLIENT_PHOTO_CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-600">
          撮影日<span className="text-rose-600"> *</span>
        </span>
        <input type="date" name="takenAt" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
      </label>
      <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-sm">
        <span className="text-stone-600">メモ(任意)</span>
        <input type="text" name="note" placeholder="施術前・3ヶ月後 など" className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-600">
          画像<span className="text-rose-600"> *</span>
        </span>
        <input type="file" name="file" accept="image/*" capture="environment" required className="text-sm" />
      </label>
      <button
        type="submit"
        disabled={uploading}
        className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {uploading ? "アップロード中…" : "登録する"}
      </button>
    </form>
  );
}
