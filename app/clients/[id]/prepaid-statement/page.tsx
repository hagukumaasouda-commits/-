import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "./print-button";

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const txTypeLabel: Record<string, string> = {
  CHARGE: "入金",
  USE: "使用",
  ADJUST: "訂正",
};

export default async function PrepaidStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from, to } = await searchParams;

  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      externalCustomerNo: true,
      prepaidCard: { select: { id: true, planType: true } },
    },
  });
  if (!client) notFound();

  const fromDate = from ? new Date(`${from}T00:00:00`) : null;
  const toDate = to ? new Date(`${to}T23:59:59.999`) : null;

  // balanceAfter は記録時点での全件合計のスナップショットで、後から過去日付の取引を
  // 追加すると実際の時系列残高とズレる(prisma/schema.prisma参照)。明細としては
  // txDate昇順で全件を都度再計算し、正しい期首・期末残高を出す。
  const allTx = client.prepaidCard
    ? await prisma.prepaidTransaction.findMany({
        where: { cardId: client.prepaidCard.id },
        orderBy: { txDate: "asc" },
        include: { staff: { select: { name: true } } },
      })
    : [];

  let running = 0;
  let openingBalance = 0;
  const rows: { id: string; txDate: Date; txType: string; amount: number; note: string | null; staffName: string | null; runningBalance: number }[] = [];
  for (const t of allTx) {
    running += t.amount;
    if (fromDate && t.txDate < fromDate) {
      openingBalance = running;
      continue;
    }
    if (toDate && t.txDate > toDate) continue;
    rows.push({
      id: t.id,
      txDate: t.txDate,
      txType: t.txType,
      amount: t.amount,
      note: t.note,
      staffName: t.staff?.name ?? null,
      runningBalance: running,
    });
  }
  const closingBalance = rows.length > 0 ? rows[rows.length - 1].runningBalance : openingBalance;
  const totalCharge = rows.filter((r) => r.amount > 0).reduce((sum, r) => sum + r.amount, 0);
  const totalUse = rows.filter((r) => r.amount < 0).reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/clients/${client.id}`} className="text-sm text-emerald-800 underline">
          ← 顧客詳細に戻る
        </Link>
        <PrintButton />
      </div>

      <form className="flex flex-wrap items-end gap-2 text-sm print:hidden">
        <label className="flex flex-col gap-1">
          <span className="text-stone-600">開始日</span>
          <input type="date" name="from" defaultValue={from ?? ""} className="input py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-stone-600">終了日</span>
          <input type="date" name="to" defaultValue={to ?? ""} className="input py-1.5" />
        </label>
        <button type="submit" className="rounded-md bg-emerald-800 px-3 py-1.5 text-white">
          表示
        </button>
        {(from || to) && (
          <Link href={`/clients/${client.id}/prepaid-statement`} className="text-xs text-stone-400 underline">
            期間指定を解除(全期間表示)
          </Link>
        )}
      </form>

      <div className="rounded-lg border border-stone-200 bg-white p-6 print:border-0 print:p-0">
        <h1 className="text-lg font-semibold text-stone-900">プリカご利用明細</h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-stone-500">お客様番号</dt>
            <dd>{client.externalCustomerNo ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-stone-500">お名前</dt>
            <dd>{client.name} 様</dd>
          </div>
          <div>
            <dt className="text-stone-500">プラン</dt>
            <dd>{client.prepaidCard?.planType ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-stone-500">対象期間</dt>
            <dd>
              {from ?? "(最初から)"} 〜 {to ?? "(現在まで)"}
            </dd>
          </div>
        </dl>

        {!client.prepaidCard ? (
          <p className="mt-6 text-sm text-stone-400">プリカ未発行です。</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-stone-500">期首残高</dt>
                <dd className="tabular-nums">{openingBalance.toLocaleString()}円</dd>
              </div>
              <div>
                <dt className="text-stone-500">入金合計</dt>
                <dd className="tabular-nums">{totalCharge.toLocaleString()}円</dd>
              </div>
              <div>
                <dt className="text-stone-500">使用合計</dt>
                <dd className="tabular-nums">{totalUse.toLocaleString()}円</dd>
              </div>
              <div>
                <dt className="text-stone-500 font-medium">期末残高</dt>
                <dd className="tabular-nums font-medium">{closingBalance.toLocaleString()}円</dd>
              </div>
            </div>

            <table className="mt-6 w-full text-sm">
              <thead>
                <tr className="border-b border-stone-300 text-left text-stone-500">
                  <th className="py-1.5 pr-4 font-normal">日付</th>
                  <th className="py-1.5 pr-4 font-normal">種別</th>
                  <th className="py-1.5 pr-4 font-normal text-right">金額</th>
                  <th className="py-1.5 pr-4 font-normal text-right">残高</th>
                  <th className="py-1.5 pr-4 font-normal">担当</th>
                  <th className="py-1.5 font-normal">メモ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-stone-100 last:border-0">
                    <td className="py-1.5 pr-4 whitespace-nowrap">{fmtDate(r.txDate)}</td>
                    <td className="py-1.5 pr-4">{txTypeLabel[r.txType] ?? r.txType}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">
                      {r.amount > 0 ? "+" : ""}
                      {r.amount.toLocaleString()}円
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">{r.runningBalance.toLocaleString()}円</td>
                    <td className="py-1.5 pr-4">{r.staffName ?? "—"}</td>
                    <td className="py-1.5 text-stone-500">{r.note ?? ""}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-stone-400">
                      この期間の取引はありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
