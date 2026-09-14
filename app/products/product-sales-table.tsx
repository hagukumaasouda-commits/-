"use client";

import { Fragment, useMemo, useState } from "react";
import { ProductSaleRow } from "./product-sale-row";
import { PRODUCT_CATEGORY_LABEL } from "@/lib/tags";
import type { ProductCategory } from "@/app/generated/prisma/client";

type ProductSaleSummary = {
  productId: string;
  productName: string;
  category: ProductCategory | null;
  count: number;
  amount: number;
};

type Transaction = {
  id: string;
  productId: string;
  clientId: string | null;
  clientName: string | null;
  rawClientLabel: string | null;
  staffId: string | null;
  saleDate: Date;
  amount: number;
  quantity: number | null;
  itemType: string;
  purchaseType: string;
  isGift: boolean;
};

export function ProductSalesTable({
  productSales,
  transactions,
  products,
  staff,
}: {
  productSales: ProductSaleSummary[];
  transactions: Transaction[];
  products: { id: string; name: string }[];
  staff: { id: string; name: string }[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const transactionsByProduct = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const list = map.get(t.productId);
      if (list) list.push(t);
      else map.set(t.productId, [t]);
    }
    return map;
  }, [transactions]);

  const toggle = (productId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-stone-500 border-b border-stone-200">
          <th className="py-1.5 font-normal">商品</th>
          <th className="py-1.5 font-normal">カテゴリ</th>
          <th className="py-1.5 font-normal text-right">件数</th>
          <th className="py-1.5 font-normal text-right">金額</th>
          <th className="py-1.5 font-normal text-right">明細</th>
        </tr>
      </thead>
      <tbody>
        {productSales.map((p) => {
          const isOpen = expanded.has(p.productId);
          const productTransactions = transactionsByProduct.get(p.productId) ?? [];
          return (
            <Fragment key={p.productId}>
              <tr className="border-b border-stone-100 last:border-0">
                <td className="py-1.5">{p.productName}</td>
                <td className="py-1.5 text-stone-500 text-xs">{p.category ? PRODUCT_CATEGORY_LABEL[p.category] : "—"}</td>
                <td className="py-1.5 text-right tabular-nums">{p.count}</td>
                <td className="py-1.5 text-right tabular-nums">{p.amount.toLocaleString()}円</td>
                <td className="py-1.5 text-right">
                  <button onClick={() => toggle(p.productId)} className="text-xs text-emerald-800 underline">
                    {isOpen ? "閉じる" : "内訳を見る"}
                  </button>
                </td>
              </tr>
              {isOpen && (
                <tr className="border-b border-stone-100 last:border-0">
                  <td colSpan={5} className="bg-stone-50 p-3">
                    {productTransactions.length > 0 ? (
                      <>
                        <p className="text-xs text-stone-500 mb-2">
                          この商品の取引明細(プレゼント品を含む全{productTransactions.length}件)。入力ミスの修正・削除ができます。
                        </p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-stone-500 border-b border-stone-200">
                              <th className="py-1 font-normal">日付</th>
                              <th className="py-1 font-normal">顧客</th>
                              <th className="py-1 font-normal">区分</th>
                              <th className="py-1 font-normal text-right">金額</th>
                              <th className="py-1 font-normal text-right">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {productTransactions.map((t) => (
                              <ProductSaleRow
                                key={t.id}
                                sale={{ ...t, productName: p.productName }}
                                products={products}
                                staff={staff}
                                clientLabel={t.clientName ?? t.rawClientLabel ?? "—"}
                              />
                            ))}
                          </tbody>
                        </table>
                      </>
                    ) : (
                      <p className="text-xs text-stone-400">この期間の取引はありません</p>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
        {productSales.length === 0 && (
          <tr>
            <td colSpan={5} className="py-4 text-center text-stone-400">
              この期間の物販データはありません
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
