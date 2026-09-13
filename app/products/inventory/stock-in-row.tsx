"use client";

import { useState } from "react";
import { updateStockIn, deleteStockIn } from "@/app/actions/products";

type StockIn = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  stockInDate: Date;
  staffId: string | null;
  staffName: string | null;
  note: string | null;
};

function fmtDate(d: Date) {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function StockInRow({
  stockIn,
  products,
  staff,
}: {
  stockIn: StockIn;
  products: { id: string; name: string }[];
  staff: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <tr className="border-b border-stone-100 last:border-0">
        <td className="py-1.5 text-stone-600">{fmtDate(stockIn.stockInDate)}</td>
        <td className="py-1.5">{stockIn.productName}</td>
        <td className="py-1.5 text-right tabular-nums">{stockIn.quantity}</td>
        <td className="py-1.5 text-stone-500 text-xs">{stockIn.staffName ?? "—"}</td>
        <td className="py-1.5 text-stone-500 text-xs">{stockIn.note ?? ""}</td>
        <td className="py-1.5 text-right whitespace-nowrap">
          <button onClick={() => setEditing(true)} className="text-xs text-emerald-800 underline">
            編集
          </button>
          <form
            action={deleteStockIn.bind(null, stockIn.id)}
            className="inline"
            onSubmit={(e) => {
              if (!confirm(`${stockIn.productName}の仕入れ記録(${stockIn.quantity}個)を削除します。よろしいですか?`)) {
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
      <td colSpan={6} className="py-2">
        <form
          action={async (formData) => {
            await updateStockIn(stockIn.id, formData);
            setEditing(false);
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <select name="productId" required defaultValue={stockIn.productId} className="input py-1 text-sm">
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input type="number" name="quantity" min={1} step={1} required defaultValue={stockIn.quantity} className="input py-1 text-sm w-24" />
          <input type="date" name="stockInDate" defaultValue={stockIn.stockInDate.toISOString().slice(0, 10)} className="input py-1 text-sm" />
          <select name="staffId" defaultValue={stockIn.staffId ?? ""} className="input py-1 text-sm">
            <option value="">担当スタッフ</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input name="note" defaultValue={stockIn.note ?? ""} placeholder="メモ" className="input py-1 text-sm" />
          <button type="submit" className="rounded-md bg-stone-800 px-3 py-1 text-xs text-white">
            保存
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-stone-500 underline">
            キャンセル
          </button>
        </form>
      </td>
    </tr>
  );
}
