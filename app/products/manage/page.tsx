import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { upsertProduct, setProductActive } from "@/app/actions/products";

// 追加・編集・取り扱い終了の切り替えを行うページなので、キャッシュされた
// 静的レンダリングではなく常に最新のマスタ一覧を返す。
export const dynamic = "force-dynamic";

export default async function ManageProductsPage() {
  const products = await prisma.product.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/products" className="text-sm text-emerald-800 underline">
          ← 物販売上に戻る
        </Link>
        <h1 className="text-xl font-semibold text-stone-900 mt-2">商品マスタを管理</h1>
        <p className="text-sm text-stone-500 mt-1">
          物販購入記録フォームの「商品名」選択肢です。参考価格は購入記録時の目安表示のみで、実際の金額はその都度手入力します。
        </p>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">新しい商品を追加</h2>
        <form action={upsertProduct.bind(null, null)} className="flex flex-wrap items-end gap-2">
          <Field label="商品名" required>
            <input name="name" required className="input" />
          </Field>
          <Field label="カテゴリ(任意)">
            <input name="category" className="input" />
          </Field>
          <Field label="参考価格(任意)">
            <input type="number" name="defaultPrice" className="input" />
          </Field>
          <button type="submit" className="rounded-md bg-emerald-800 px-3 py-1.5 text-sm font-medium text-white">
            追加する
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">商品一覧({products.length}件)</h2>
        <ul className="flex flex-col divide-y divide-stone-100">
          {products.map((p) => (
            <li key={p.id} className={`py-3 ${!p.active ? "opacity-50" : ""}`}>
              <form action={upsertProduct.bind(null, p.id)} className="flex flex-wrap items-end gap-2">
                <Field label="商品名" required>
                  <input name="name" required defaultValue={p.name} className="input" />
                </Field>
                <Field label="カテゴリ">
                  <input name="category" defaultValue={p.category ?? ""} className="input" />
                </Field>
                <Field label="参考価格">
                  <input type="number" name="defaultPrice" defaultValue={p.defaultPrice ?? ""} className="input" />
                </Field>
                <button type="submit" className="rounded-md bg-stone-800 px-3 py-1.5 text-xs text-white">
                  保存
                </button>
              </form>
              <form action={setProductActive.bind(null, p.id, !p.active)} className="mt-1">
                <button type="submit" className="text-xs text-stone-400 hover:text-stone-600 underline">
                  {p.active ? "取り扱い終了にする" : "取り扱いを再開する"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-stone-500">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </span>
      {children}
    </label>
  );
}
