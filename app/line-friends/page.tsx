import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { linkLineFriend } from "@/app/actions/line-friends";
import { BackfillButton } from "./backfill-button";

function fmtDateTime(d: Date) {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

/** 表示名の先頭が顧客番号になっているパターン(例:「2370大亀紫姫」)を検知する。 */
function extractLeadingClientNo(displayName: string | null): string | null {
  if (!displayName) return null;
  const match = displayName.match(/^(\d+)/);
  return match ? match[1] : null;
}

export default async function LineFriendsPage() {
  const [friends, clients] = await Promise.all([
    prisma.lineFriend.findMany({
      orderBy: { followedAt: "desc" },
      include: { linkedClient: { select: { id: true, name: true } }, linkedByStaff: { select: { name: true } } },
    }),
    prisma.client.findMany({ select: { id: true, name: true, externalCustomerNo: true }, orderBy: { name: "asc" } }),
  ]);

  const clientByNo = new Map(clients.filter((c) => c.externalCustomerNo).map((c) => [c.externalCustomerNo, c]));

  const unlinked = friends.filter((f) => !f.linkedClientId);
  const linked = friends.filter((f) => f.linkedClientId);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">LINE友だち紐づけ</h1>
        <p className="text-sm text-stone-500 mt-1">
          LINE公式アカウントの友だち追加をWebhookで検知し、顧客と紐づけます。紐づけると予約リマインドの送信先として使われます。
        </p>
      </div>

      <BackfillButton />

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">未紐づけの友だち({unlinked.length}件)</h2>
        {unlinked.length === 0 && <p className="text-sm text-stone-400">未紐づけの友だちはいません</p>}
        <ul className="flex flex-col divide-y divide-stone-100">
          {unlinked.map((f) => {
            const leadingNo = extractLeadingClientNo(f.displayName);
            const suggested = leadingNo ? clientByNo.get(leadingNo) : undefined;
            return (
              <li key={f.id} className="py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-stone-800">
                    {f.displayName ?? "(表示名不明)"}
                    {f.unfollowedAt && <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">ブロック済み</span>}
                  </span>
                  <span className="text-xs text-stone-400">友だち追加: {fmtDateTime(f.followedAt)}</span>
                </div>

                {suggested && (
                  <form action={linkLineFriend.bind(null, f.id)} className="flex items-center gap-2">
                    <input type="hidden" name="clientQuery" value={`${suggested.name} #${suggested.id}`} />
                    <span className="text-sm text-stone-600">
                      この顧客ですか? <span className="font-medium text-emerald-800">{suggested.name}</span>(顧客番号: {leadingNo})
                    </span>
                    <button type="submit" className="rounded-md bg-emerald-800 px-3 py-1 text-xs font-medium text-white">
                      この顧客をリンク
                    </button>
                  </form>
                )}

                <form action={linkLineFriend.bind(null, f.id)} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    list="line-friend-client-options"
                    name="clientQuery"
                    placeholder="氏名を入力して選択(手動でリンク)"
                    autoComplete="off"
                    className="input py-1 text-sm flex-1 min-w-[200px]"
                  />
                  <button type="submit" className="rounded-md border border-stone-300 px-3 py-1 text-xs text-stone-700 hover:bg-stone-50">
                    手動でリンク
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
        <datalist id="line-friend-client-options">
          {clients.map((c) => (
            <option key={c.id} value={`${c.name} #${c.id}`} />
          ))}
        </datalist>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">リンク済み({linked.length}件)</h2>
        {linked.length === 0 && <p className="text-sm text-stone-400">リンク済みの友だちはいません</p>}
        <ul className="flex flex-col divide-y divide-stone-100">
          {linked.map((f) => (
            <li key={f.id} className="py-2 flex items-center justify-between text-sm">
              <span>
                {f.displayName ?? "(表示名不明)"} →{" "}
                {f.linkedClient && (
                  <Link href={`/clients/${f.linkedClient.id}`} className="text-emerald-800 underline">
                    {f.linkedClient.name}
                  </Link>
                )}
              </span>
              <span className="text-xs text-stone-400">
                {f.linkedAt && fmtDateTime(f.linkedAt)}
                {f.linkedByStaff && ` ・ ${f.linkedByStaff.name}`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
