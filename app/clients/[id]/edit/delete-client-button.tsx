"use client";

import { deleteClient } from "@/app/actions/clients";

export function DeleteClientButton({
  clientId,
  clientName,
  visitCount,
  prepaidBalance,
  productSaleCount,
}: {
  clientId: string;
  clientName: string;
  visitCount: number;
  prepaidBalance: number | null;
  productSaleCount: number;
}) {
  return (
    <form
      action={deleteClient.bind(null, clientId)}
      onSubmit={(e) => {
        const details: string[] = [];
        if (visitCount > 0) details.push(`来院記録${visitCount}件`);
        if (prepaidBalance !== null && prepaidBalance !== 0) details.push(`プリカ残高${prepaidBalance.toLocaleString()}円`);
        if (productSaleCount > 0) details.push(`物販購入記録${productSaleCount}件`);
        const detailText = details.length > 0 ? `\n\n削除される主なデータ: ${details.join("・")}\nこれらのデータが残っている場合は、削除ではなく「統合する」の利用を検討してください。` : "";
        if (!confirm(`${clientName}様の顧客情報を完全に削除します。この操作は取り消せません。${detailText}\n\n本当によろしいですか?`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
      >
        この顧客を削除する
      </button>
    </form>
  );
}
