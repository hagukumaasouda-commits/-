"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PrepaidTxType } from "@/app/generated/prisma/client";

// プリカ台帳は全面的に手入力(仕様書 chart-prepaid-product-spec-v2.md 3.1)。
// 自動計算ロジックは持たず、入金・使用の合計を都度集計するだけ。カードが未発行の顧客に
// 初めて記録する場合は、この時点で PrepaidCard を自動発行する。
export async function recordPrepaidTransaction(clientId: string, formData: FormData) {
  const txType = String(formData.get("txType") || "") as PrepaidTxType;
  const amountInput = Number(formData.get("amount"));
  if (!Object.values(PrepaidTxType).includes(txType) || Number.isNaN(amountInput)) {
    throw new Error("種別と金額を入力してください");
  }

  const staffId = String(formData.get("staffId") || "") || null;
  const txDateRaw = String(formData.get("txDate") || "");
  const note = String(formData.get("note") || "") || null;

  // 入金・使用はスタッフに正の数で入力してもらい、符号はここで揃える。
  // 訂正(ADJUST)のみ、入力した符号をそのまま使う。
  const amount =
    txType === PrepaidTxType.USE
      ? -Math.abs(amountInput)
      : txType === PrepaidTxType.CHARGE
        ? Math.abs(amountInput)
        : amountInput;

  await prisma.$transaction(async (tx) => {
    const card = await tx.prepaidCard.upsert({
      where: { clientId },
      update: {},
      create: { clientId },
    });

    const created = await tx.prepaidTransaction.create({
      data: {
        cardId: card.id,
        txType,
        amount,
        txDate: txDateRaw ? new Date(txDateRaw) : new Date(),
        staffId,
        note,
      },
    });

    const sum = await tx.prepaidTransaction.aggregate({
      where: { cardId: card.id },
      _sum: { amount: true },
    });
    await tx.prepaidTransaction.update({
      where: { id: created.id },
      data: { balanceAfter: sum._sum.amount ?? amount },
    });
  });

  revalidatePath(`/clients/${clientId}`);
}
