import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getInventoryStatus, getStockInHistory } from "@/lib/product-reports";
import { recordStockIn } from "@/app/actions/products";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/tags";
import { StockInRow } from "./stock-in-row";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [inventory, stockInHistory, activeProducts, staff] = await Promise.all([
    getInventoryStatus(),
    getStockInHistory(),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/products" className="text-sm text-emerald-800 underline">
          ← 物販売上に戻る
        </Link>
        <h1 className="text-xl font-semibold text-stone-900 mt-2">在庫管理</h1>
        <p className="text-sm text-stone-500 mt-1">
          現在庫 = 仕入れ数量の合計 − 販売数量の合計です。販売記録に個数が入っていない行(CSV取り込み分の一部)は在庫計算に反映されないため、実際の在庫より多く表示される場合があります。
        </p>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">現在の在庫</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-200">
              <th className="py-1.5 font-normal">商品</th>
              <th className="py-1.5 font-normal">カテゴリ</th>
              <th className="py-1.5 font-normal text-right">仕入れ累計</th>
              <th className="py-1.5 font-normal text-right">販売累計</th>
              <th className="py-1.5 font-normal text-right">現在庫</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((p) => (
              <tr key={p.id} className={`border-b border-stone-100 last:border-0 ${!p.active ? "opacity-50" : ""}`}>
                <td className="py-1.5">
                  {p.name}
                  {!p.active && <span className="ml-2 text-xs text-stone-400">(取り扱い終了)</span>}
                </td>
                <td className="py-1.5 text-stone-500 text-xs">{PRODUCT_CATEGORY_LABEL[p.category]}</td>
                <td className="py-1.5 text-right tabular-nums">{p.totalStockIn}</td>
                <td className="py-1.5 text-right tabular-nums">{p.totalSold}</td>
                <td className={`py-1.5 text-right tabular-nums font-medium ${p.currentStock <= 0 ? "text-rose-700" : "text-stone-900"}`}>
                  {p.currentStock}
                </td>
              </tr>
            ))}
            {inventory.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-stone-400">
                  商品が登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">仕入れを記録する</h2>
        <form action={recordStockIn} className="flex flex-wrap items-end gap-2">
          <select name="productId" required className="input py-1.5 text-sm">
            <option value="">商品を選択</option>
            {activeProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input type="number" name="quantity" min={1} step={1} required placeholder="数量" className="input py-1.5 text-sm w-24" />
          <input type="date" name="stockInDate" defaultValue={new Date().toISOString().slice(0, 10)} className="input py-1.5 text-sm" />
          <select name="staffId" className="input py-1.5 text-sm">
            <option value="">担当スタッフ</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input name="note" placeholder="メモ(仕入れ先など、任意)" className="input py-1.5 text-sm" />
          <button type="submit" className="rounded-md bg-emerald-800 px-3 py-1.5 text-sm font-medium text-white">
            記録する
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">仕入れ履歴({stockInHistory.length}件)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-200">
              <th className="py-1.5 font-normal">日付</th>
              <th className="py-1.5 font-normal">商品</th>
              <th className="py-1.5 font-normal text-right">数量</th>
              <th className="py-1.5 font-normal">担当</th>
              <th className="py-1.5 font-normal">メモ</th>
              <th className="py-1.5 font-normal text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {stockInHistory.map((s) => (
              <StockInRow key={s.id} stockIn={s} products={activeProducts} staff={staff} />
            ))}
            {stockInHistory.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-stone-400">
                  仕入れ記録はまだありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
