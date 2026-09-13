"use client";

import { useState } from "react";
import { updateProductSale, deleteProductSale } from "@/app/actions/products";

type Sale = {
  id: string;
  productId: string;
  saleDate: Date;
  productName: string;
  amount: number;
  quantity: number | null;
  itemType: string;
  purchaseType: string;
  isGift: boolean;
  staffId: string | null;
};

function fmtDate(d: Date) {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function ProductSaleRow({
  sale,
  products,
  staff,
}: {
  sale: Sale;
  products: { id: string; name: string }[];
  staff: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <tr className="border-b border-stone-100 last:border-0">
        <td className="py-1.5 text-stone-600">{fmtDate(sale.saleDate)}</td>
        <td className="py-1.5">{sale.productName}</td>
        <td className="py-1.5 text-stone-500 text-xs">
          {sale.itemType === "FULL" ? "本品" : "バラ"} ・ {sale.purchaseType === "NEW" ? "新規" : "リピート"}
          {sale.isGift && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">プレゼント</span>}
        </td>
        <td className="py-1.5 text-right tabular-nums">{sale.amount.toLocaleString()}円</td>
        <td className="py-1.5 text-right whitespace-nowrap">
          <button onClick={() => setEditing(true)} className="text-xs text-emerald-800 underline">
            編集
          </button>
          <form
            action={deleteProductSale.bind(null, sale.id)}
            className="inline"
            onSubmit={(e) => {
              if (!confirm(`${sale.productName}の購入記録を削除します。よろしいですか?`)) {
                e.preventDefault();
              }
            }}
          >
            <button type="submit" className="ml-3 text-xs text-rose-700 underline">
              削除
            </button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-stone-100 last:border-0 bg-stone-50">
      <td colSpan={5} className="py-2">
        <form
          action={async (formData) => {
            await updateProductSale(sale.id, formData);
            setEditing(false);
          }}
          className="flex flex-col gap-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <select name="productId" required defaultValue={sale.productId} className="input py-1.5 text-sm">
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input type="number" name="amount" defaultValue={sale.amount} className="input py-1.5 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" name="quantity" defaultValue={sale.quantity ?? ""} placeholder="個数" className="input py-1.5 text-sm" />
            <select name="itemType" defaultValue={sale.itemType} className="input py-1.5 text-sm">
              <option value="FULL">本品</option>
              <option value="LOOSE">バラ</option>
            </select>
            <select name="purchaseType" defaultValue={sale.purchaseType} className="input py-1.5 text-sm">
              <option value="NEW">新規</option>
              <option value="REPEAT">リピート</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="saleDate" defaultValue={sale.saleDate.toISOString().slice(0, 10)} className="input py-1.5 text-sm" />
            <select name="staffId" defaultValue={sale.staffId ?? ""} className="input py-1.5 text-sm">
              <option value="">担当スタッフ</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 text-sm text-stone-700">
            <input type="checkbox" name="isGift" value="true" defaultChecked={sale.isGift} className="accent-emerald-800" />
            プレゼント品(無料配布)
          </label>
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-stone-800 px-3 py-1.5 text-xs text-white w-fit">
              保存
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-stone-500 underline">
              キャンセル
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}
