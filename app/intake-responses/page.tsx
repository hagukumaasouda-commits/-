import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { linkIntakeResponseToClient } from "@/app/actions/intake";
import { IntakeAnswersView } from "./intake-answers-view";

function fmtDateTime(d: Date) {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default async function IntakeResponsesPage() {
  const [responses, clients] = await Promise.all([
    prisma.intakeResponse.findMany({
      orderBy: { submittedAt: "desc" },
      include: { linkedClient: { select: { id: true, name: true } }, linkedByStaff: { select: { name: true } } },
    }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const unlinked = responses.filter((r) => !r.linkedClientId);
  const linked = responses.filter((r) => r.linkedClientId);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">事前問診の回答</h1>
        <p className="text-sm text-stone-500 mt-1">
          LINEから送信された事前問診の回答一覧です。すでにLINE友だち紐づけ済みの方は自動で顧客に紐づきます。未紐づけの方は、新規顧客登録時に読み込むか、ここで既存顧客に手動で紐づけてください。
        </p>
        <Link href="/intake" className="mt-2 inline-block text-sm text-emerald-800 underline">
          LINEをお持ちでない方の問診内容をスタッフが代わりに入力する
        </Link>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">未紐づけの回答({unlinked.length}件)</h2>
        {unlinked.length === 0 && <p className="text-sm text-stone-400">未紐づけの回答はありません</p>}
        <ul className="flex flex-col divide-y divide-stone-100">
          {unlinked.map((r) => (
            <li key={r.id} className="py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-stone-800">
                  {r.name}
                  {r.kana && <span className="ml-1.5 text-xs text-stone-400">({r.kana})</span>}
                </span>
                <span className="text-xs text-stone-400">送信: {fmtDateTime(r.submittedAt)}</span>
              </div>
              {r.phone && <p className="text-xs text-stone-500">電話: {r.phone}</p>}

              <details>
                <summary className="cursor-pointer text-xs text-emerald-800 underline">回答内容を見る</summary>
                <div className="mt-2 rounded-md border border-stone-200 bg-stone-50 p-3">
                  <IntakeAnswersView answers={r.answers as Record<string, string | string[]>} />
                </div>
              </details>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/clients/new?intakeResponseId=${r.id}`}
                  className="rounded-md bg-emerald-800 px-3 py-1 text-xs font-medium text-white"
                >
                  この内容で新規顧客登録
                </Link>
                <form action={linkIntakeResponseToClient.bind(null, r.id)} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    list="intake-response-client-options"
                    name="clientQuery"
                    placeholder="既存顧客の氏名を入力して選択"
                    autoComplete="off"
                    className="input py-1 text-sm flex-1 min-w-[200px]"
                  />
                  <button type="submit" className="rounded-md border border-stone-300 px-3 py-1 text-xs text-stone-700 hover:bg-stone-50">
                    既存顧客に紐づける
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <datalist id="intake-response-client-options">
          {clients.map((c) => (
            <option key={c.id} value={`${c.name} #${c.id}`} />
          ))}
        </datalist>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">紐づけ済み({linked.length}件)</h2>
        {linked.length === 0 && <p className="text-sm text-stone-400">紐づけ済みの回答はありません</p>}
        <ul className="flex flex-col divide-y divide-stone-100">
          {linked.map((r) => (
            <li key={r.id} className="py-2 flex items-center justify-between gap-2 text-sm">
              <span>
                {r.name} →{" "}
                {r.linkedClient && (
                  <Link href={`/clients/${r.linkedClient.id}`} className="text-emerald-800 underline">
                    {r.linkedClient.name}
                  </Link>
                )}
              </span>
              <span className="text-xs text-stone-400">
                {r.linkedAt && fmtDateTime(r.linkedAt)}
                {r.linkedByStaff && ` ・ ${r.linkedByStaff.name}`}
                {!r.linkedByStaff && " ・ 自動紐づけ"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
