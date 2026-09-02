import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CheckType } from "@/app/generated/prisma/client";
import { runAwarenessCheck, resolveAwarenessCheck, submitDialogue } from "@/app/actions/awareness";
import { getClientPurchaseHistory } from "@/lib/product-reports";

function fmtDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

const severityStyle: Record<string, string> = {
  INFO: "bg-stone-100 text-stone-600",
  NOTICE: "bg-sky-100 text-sky-800",
  IMPORTANT: "bg-rose-100 text-rose-800",
};
const statusLabel: Record<string, string> = {
  OPEN: "未対応",
  DISCUSSED: "対話中",
  RESOLVED: "対応済み",
};

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      primaryStaff: true,
      acquisitionChannel: true,
      referredBy: { select: { id: true, name: true } },
      referrals: { select: { id: true, name: true } },
      prepaidCard: { include: { transactions: { orderBy: { txDate: "desc" }, take: 10 } } },
      treatmentCourses: { orderBy: { courseNo: "desc" } },
      reservations: { orderBy: { reservedAt: "desc" }, take: 5 },
      visits: {
        orderBy: { visitNo: "desc" },
        include: { staff: true, chartRecord: true, awarenessChecks: { include: { dialogue: { include: { authorStaff: true } } } } },
      },
    },
  });
  if (!client) notFound();

  const purchaseHistory = await getClientPurchaseHistory(client.id);

  const balance = client.prepaidCard
    ? client.prepaidCard.transactions.reduce((s, t) => s + t.amount, 0)
    : null;

  const officeChecks = client.visits.flatMap((v) =>
    v.awarenessChecks.filter((c) => c.checkType === CheckType.OFFICE).map((c) => ({ ...c, visit: v }))
  );
  const aiChecks = client.visits.flatMap((v) =>
    v.awarenessChecks.filter((c) => c.checkType === CheckType.AI_INSIGHT).map((c) => ({ ...c, visit: v }))
  );

  const latestVisit = client.visits[0];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">
            {client.name}
            {!client.isActive && <span className="ml-2 rounded bg-stone-100 px-2 py-0.5 text-xs align-middle text-stone-500">離脱</span>}
          </h1>
          <p className="text-sm text-stone-500 mt-1">{client.kana}</p>
        </div>
        <Link href={`/clients/${client.id}/visits/new`} className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white">
          来院を記録する
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-stone-200 bg-white p-5 lg:col-span-1">
          <h2 className="font-semibold mb-3">基本情報</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="性別" value={client.gender ?? "—"} />
            <Row label="電話" value={client.phone ?? "—"} />
            <Row label="来店きっかけ" value={client.acquisitionChannel?.name ?? "—"} />
            <Row
              label="紹介元"
              value={client.referredBy ? <Link href={`/clients/${client.referredBy.id}`} className="text-emerald-800 underline">{client.referredBy.name}</Link> : "—"}
            />
            <Row label="主担当" value={client.primaryStaff?.name ?? "—"} />
            <Row label="初回来院" value={fmtDate(client.firstVisitDate)} />
            <Row label="来院回数" value={`${client.visits.length}回`} />
            {client.referrals.length > 0 && (
              <Row
                label="紹介した人"
                value={client.referrals.map((r) => (
                  <Link key={r.id} href={`/clients/${r.id}`} className="mr-2 text-emerald-800 underline">
                    {r.name}
                  </Link>
                ))}
              />
            )}
          </dl>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5 lg:col-span-1">
          <h2 className="font-semibold mb-3">プリカ残高</h2>
          {client.prepaidCard ? (
            <>
              <div className="text-2xl font-semibold tabular-nums text-stone-900">{balance?.toLocaleString()}円</div>
              <div className="text-xs text-stone-500 mb-3">プラン: {client.prepaidCard.planType ?? "—"}</div>
              <ul className="flex flex-col gap-1 text-sm">
                {client.prepaidCard.transactions.map((t) => (
                  <li key={t.id} className="flex justify-between text-stone-600">
                    <span>{fmtDate(t.txDate)} {t.txType === "CHARGE" ? "チャージ" : t.txType === "USE" ? "利用" : "訂正"}</span>
                    <span className="tabular-nums">{t.amount > 0 ? "+" : ""}{t.amount.toLocaleString()}円</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-stone-400">プリカ未発行</p>
          )}
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5 lg:col-span-1">
          <h2 className="font-semibold mb-3">予約</h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {client.reservations.map((r) => (
              <li key={r.id} className="flex justify-between text-stone-600">
                <span>{r.reservedAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                <span className="text-xs">{r.status}</span>
              </li>
            ))}
            {client.reservations.length === 0 && <p className="text-stone-400">予約なし</p>}
          </ul>
        </section>
      </div>

      {latestVisit && (
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold">気づきチェック</h2>
            <form action={runAwarenessCheck.bind(null, latestVisit.id)}>
              <button className="rounded-md border border-emerald-800 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50">
                最新来院(第{latestVisit.visitNo}回)を気づきチェックする
              </button>
            </form>
          </div>
          <p className="text-xs text-stone-500">
            事務チェック(記入漏れ)とAI気づき(関わりの質・離脱兆候)は別々に走ります。AIは判断を下すのではなく、対話のきっかけを提示するだけです。
          </p>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <AwarenessLane title="事務チェック(記入漏れ)" tone="office" checks={officeChecks} />
        <AwarenessLane title="AI気づき(関わりの質・離脱兆候)" tone="ai" checks={aiChecks} />
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">購入履歴(物販)</h2>
        {purchaseHistory.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200">
                <th className="py-1.5 font-normal">日付</th>
                <th className="py-1.5 font-normal">商品</th>
                <th className="py-1.5 font-normal">区分</th>
                <th className="py-1.5 font-normal text-right">金額</th>
              </tr>
            </thead>
            <tbody>
              {purchaseHistory.map((p) => (
                <tr key={p.id} className="border-b border-stone-100 last:border-0">
                  <td className="py-1.5 text-stone-600">{fmtDate(p.saleDate)}</td>
                  <td className="py-1.5">{p.productName}</td>
                  <td className="py-1.5 text-stone-500 text-xs">
                    {p.itemType === "FULL" ? "本品" : "バラ"} ・ {p.purchaseType === "NEW" ? "新規" : "リピート"}
                    {p.isGift && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">プレゼント</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{p.amount.toLocaleString()}円</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-stone-400">購入履歴なし</p>
        )}
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">来院タイムライン</h2>
        <ul className="flex flex-col divide-y divide-stone-100">
          {client.visits.map((v) => (
            <li key={v.id} className="py-3">
              <details>
                <summary className="cursor-pointer flex items-center justify-between text-sm">
                  <span>
                    第{v.visitNo}回 ・ {fmtDate(v.visitDate)} ・ 担当: {v.staff.name}
                    {v.menu && <span className="ml-2 text-stone-500">{v.menu}</span>}
                  </span>
                  {v.awarenessChecks.length > 0 && (
                    <span className="text-xs text-stone-400">気づき{v.awarenessChecks.length}件</span>
                  )}
                </summary>
                {v.chartRecord && (
                  <div className="mt-2 grid gap-1 pl-2 text-xs text-stone-600 border-l-2 border-stone-100">
                    {v.chartRecord.chiefComplaintTags.length > 0 && <p>主訴: {v.chartRecord.chiefComplaintTags.join("、")}</p>}
                    {v.chartRecord.bodyPartTags.length > 0 && <p>部位: {v.chartRecord.bodyPartTags.join("、")}</p>}
                    {v.chartRecord.evaluation && <p>評価: {v.chartRecord.evaluation}</p>}
                    {v.chartRecord.changeFromLast && <p>前回からの変化: {v.chartRecord.changeFromLast}</p>}
                    {v.chartRecord.clientVoice && <p>お客様の声: {v.chartRecord.clientVoice}</p>}
                    {v.chartRecord.nextCheck && <p>次回確認: {v.chartRecord.nextCheck}</p>}
                  </div>
                )}
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right text-stone-800">{value}</dd>
    </div>
  );
}

type CheckWithVisit = {
  id: string;
  category: string;
  message: string;
  severity: string;
  status: string;
  visit: { visitNo: number };
  dialogue: { id: string; comment: string; createdAt: Date; authorStaff: { name: string } }[];
};

function AwarenessLane({
  title,
  tone,
  checks,
}: {
  title: string;
  tone: "office" | "ai";
  checks: CheckWithVisit[];
}) {
  return (
    <section className={`rounded-lg border p-5 ${tone === "ai" ? "border-amber-200 bg-amber-50/40" : "border-stone-200 bg-white"}`}>
      <h2 className="font-semibold mb-3">{title}</h2>
      {checks.length === 0 && <p className="text-sm text-stone-400">まだありません</p>}
      <ul className="flex flex-col gap-4">
        {checks.map((c) => (
          <li key={c.id} className="rounded-md border border-stone-200 bg-white p-3">
            <div className="flex items-center gap-2 text-xs">
              <span className={`rounded px-1.5 py-0.5 ${severityStyle[c.severity]}`}>{c.category}</span>
              <span className="text-stone-400">第{c.visit.visitNo}回</span>
              <span className="ml-auto text-stone-500">{statusLabel[c.status]}</span>
            </div>
            <p className="mt-2 text-sm text-stone-800">{c.message}</p>

            {c.dialogue.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 border-t border-stone-100 pt-2">
                {c.dialogue.map((d) => (
                  <li key={d.id} className="text-xs text-stone-600">
                    <span className="font-medium text-stone-700">{d.authorStaff.name}</span>: {d.comment}
                  </li>
                ))}
              </ul>
            )}

            <form action={submitDialogue} className="mt-2 flex items-center gap-2">
              <input type="hidden" name="awarenessCheckId" value={c.id} />
              <input name="comment" placeholder="コメントする" className="input flex-1 py-1 text-xs" />
              <button className="rounded-md bg-stone-800 px-2.5 py-1 text-xs text-white">送信</button>
            </form>
            {c.status !== "RESOLVED" && (
              <form action={resolveAwarenessCheck.bind(null, c.id)} className="mt-1">
                <button className="text-xs text-stone-400 hover:text-stone-600 underline">対応済みにする</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
