import { CLIENT_PHOTO_CATEGORY_OPTIONS } from "@/lib/tags";
import { addClientPhoto } from "@/app/actions/client-photos";
import { DeletePhotoButton } from "./delete-photo-button";

export type ClientPhotoWithUrl = {
  id: string;
  category: string;
  takenAt: Date;
  note: string | null;
  uploadedBy: { name: string };
  signedUrl: string | null;
};

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ClientPhotosSection({ clientId, photos }: { clientId: string; photos: ClientPhotoWithUrl[] }) {
  const grouped = CLIENT_PHOTO_CATEGORY_OPTIONS.map((opt) => ({
    ...opt,
    photos: photos.filter((p) => p.category === opt.value),
  }));

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="font-semibold mb-1">写真記録(姿勢・インボディ)</h2>
      <p className="text-xs text-stone-500 mb-3">お客様に見せながら経過を確認できます。区分ごとに撮影日の新しい順で並びます。</p>

      <form
        action={addClientPhoto.bind(null, clientId)}
        className="flex flex-wrap items-end gap-3 rounded-md border border-stone-200 bg-stone-50 p-3 mb-4"
      >
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
        <button type="submit" className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white">
          登録する
        </button>
      </form>

      {photos.length === 0 && <p className="text-sm text-stone-400">まだ写真が登録されていません</p>}

      <div className="flex flex-col gap-5">
        {grouped.map(
          (g) =>
            g.photos.length > 0 && (
              <div key={g.value}>
                <h3 className="mb-2 text-sm font-medium text-stone-700">
                  {g.label}({g.photos.length}件)
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {g.photos.map((p) => (
                    <div key={p.id} className="flex flex-col gap-1">
                      {p.signedUrl ? (
                        <a href={p.signedUrl} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storageの署名付きURL(60秒で失効)を直接表示するため、キャッシュを挟むnext/imageは使わない */}
                          <img
                            src={p.signedUrl}
                            alt={`${g.label} ${fmtDate(p.takenAt)}`}
                            className="aspect-square w-full rounded-md border border-stone-200 object-cover"
                          />
                        </a>
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center rounded-md border border-stone-200 bg-stone-100 text-xs text-stone-400">
                          画像を取得できません
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-stone-500">
                        <span>{fmtDate(p.takenAt)}</span>
                        <DeletePhotoButton photoId={p.id} />
                      </div>
                      {p.note && (
                        <p className="truncate text-xs text-stone-600" title={p.note}>
                          {p.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
        )}
      </div>
    </section>
  );
}
