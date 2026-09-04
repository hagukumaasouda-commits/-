import Link from "next/link";
import { granularityToPeriod } from "@/lib/reports";
import {
  getMonthlyProductSales,
  getGiftSummary,
  getStaffProductSales,
  getTreatmentProductCorrelation,
} from "@/lib/product-reports";

function fmtDate(d: Date) {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function shiftReference(ref: Date, granularity: "week" | "month", dir: -1 | 1) {
  const d = new Date(ref);
  if (granularity === "week") d.setDate(d.getDate() + dir * 7);
  else d.setMonth(d.getMonth() + dir);
  return d.toISOString().slice(0, 10);
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ granularity?: string; ref?: string }>;
}) {
  const sp = await searchParams;
  const granularity: "week" | "month" = sp.granularity === "week" ? "week" : "month";
  const reference = sp.ref ? new Date(sp.ref) : new Date();
  const period = granularityToPeriod(granularity, reference);

  const [productSales, gifts, staffSales, correlation] = await Promise.all([
    getMonthlyProductSales(period),
    getGiftSummary(period),
    getStaffProductSales(period),
    getTreatmentProductCorrelation(period),
  ]);

  const totalAmount = productSales.reduce((s, p) => s + p.amount, 0);
  const totalCount = productSales.reduce((s, p) => s + p.count, 0);

  const prevHref = `/products?granularity=${granularity}&ref=${shiftReference(reference, granularity, -1)}`;
  const nextHref = `/products?granularity=${granularity}&ref=${shiftReference(reference, granularity, 1)}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">物販売上</h1>
          <p className="text-sm text-stone-500 mt-1">
            {fmtDate(period.start)} 〜 {fmtDate(period.end)}(プレゼント品は売上から除外・別集計)
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/products/manage" className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100">
            商品マスタを管理
          </Link>
          <div className="flex rounded-md border border-stone-300 overflow-hidden">
            <Link
              href={`/products?granularity=week`}
              className={`px-3 py-1.5 ${granularity === "week" ? "bg-emerald-800 text-white" : "bg-white text-stone-600"}`}
            >
              週次
            </Link>
            <Link
              href={`/products?granularity=month`}
              className={`px-3 py-1.5 ${granularity === "month" ? "bg-emerald-800 text-white" : "bg-white text-stone-600"}`}
            >
              月次
            </Link>
          </div>
          <Link href={prevHref} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100">
            ← 前
          </Link>
          <Link href={nextHref} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100">
            次 →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="text-xs text-stone-500">物販売上合計</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{totalAmount.toLocaleString()}円</div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="text-xs text-stone-500">販売件数</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{totalCount}件</div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="text-xs text-stone-500">プレゼント品(件数)</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
            {gifts.reduce((s, g) => s + g.count, 0)}件
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="font-semibold mb-3">商品別売上</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200">
                <th className="py-1.5 font-normal">商品</th>
                <th className="py-1.5 font-normal text-right">件数</th>
                <th className="py-1.5 font-normal text-right">金額</th>
              </tr>
            </thead>
            <tbody>
              {productSales.map((p) => (
                <tr key={p.productId} className="border-b border-stone-100 last:border-0">
                  <td className="py-1.5">{p.productName}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.count}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.amount.toLocaleString()}円</td>
                </tr>
              ))}
              {productSales.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-stone-400">
                    この期間の物販データはありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="font-semibold mb-3">スタッフ別物販売上</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200">
                <th className="py-1.5 font-normal">スタッフ</th>
                <th className="py-1.5 font-normal text-right">件数</th>
                <th className="py-1.5 font-normal text-right">金額</th>
              </tr>
            </thead>
            <tbody>
              {staffSales.map((s) => (
                <tr key={s.staffId} className="border-b border-stone-100 last:border-0">
                  <td className="py-1.5">{s.staffName}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.count}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.amount.toLocaleString()}円</td>
                </tr>
              ))}
              {staffSales.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-stone-400">
                    この期間の物販データはありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="font-semibold mb-3">プレゼント品(無料配布)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200">
                <th className="py-1.5 font-normal">商品</th>
                <th className="py-1.5 font-normal text-right">件数</th>
              </tr>
            </thead>
            <tbody>
              {gifts.map((g) => (
                <tr key={g.productId} className="border-b border-stone-100 last:border-0">
                  <td className="py-1.5">{g.productName}</td>
                  <td className="py-1.5 text-right tabular-nums">{g.count}</td>
                </tr>
              ))}
              {gifts.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-4 text-center text-stone-400">
                    この期間のプレゼント品はありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="font-semibold mb-3">主訴×購入商品の傾向(参考)</h2>
          <p className="text-xs text-stone-500 mb-2">
            来院前後14日以内の購入を、その来院の主訴タグと突き合わせた件数です。将来の商品提案の参考情報です。
          </p>
          <ul className="flex flex-col gap-1 text-sm max-h-64 overflow-y-auto">
            {correlation.slice(0, 20).map((c, i) => (
              <li key={i} className="flex justify-between text-stone-600">
                <span>
                  {c.tag} → {c.productName}
                </span>
                <span className="tabular-nums">{c.count}件</span>
              </li>
            ))}
            {correlation.length === 0 && <p className="text-stone-400">この期間のデータはありません</p>}
          </ul>
        </section>
      </div>
    </div>
  );
}
