"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductItemType, ProductPurchaseType } from "@/app/generated/prisma/client";

// 商品マスタは「あとで追加・修正できる」運用にするため、ここで作成・編集の両方を扱う
// (仕様書 chart-prepaid-product-spec-v2.md 3.3)。

export async function upsertProduct(productId: string | null, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("商品名は必須です");
  const category = String(formData.get("category") || "") || null;
  const defaultPriceRaw = String(formData.get("defaultPrice") || "");
  const defaultPrice = defaultPriceRaw ? Number(defaultPriceRaw) : null;

  if (productId) {
    await prisma.product.update({ where: { id: productId }, data: { name, category, defaultPrice } });
  } else {
    await prisma.product.create({ data: { name, category, defaultPrice } });
  }

  revalidatePath("/products/manage");
  redirect("/products/manage");
}

export async function setProductActive(productId: string, active: boolean) {
  await prisma.product.update({ where: { id: productId }, data: { active } });
  revalidatePath("/products/manage");
  redirect("/products/manage");
}

/** 物販購入を記録する(手入力運用。CSV取り込みとは別経路)。 */
export async function recordProductSale(clientId: string, formData: FormData) {
  const productId = String(formData.get("productId") || "");
  const amountRaw = Number(formData.get("amount"));
  if (!productId || Number.isNaN(amountRaw)) throw new Error("商品と金額を入力してください");

  const quantityRaw = String(formData.get("quantity") || "");
  const quantity = quantityRaw ? Number(quantityRaw) : null;
  const isGift = formData.get("isGift") === "true";
  const staffId = String(formData.get("staffId") || "") || null;
  const saleDateRaw = String(formData.get("saleDate") || "");
  const itemType = (String(formData.get("itemType") || "") || ProductItemType.FULL) as ProductItemType;
  const purchaseType = (String(formData.get("purchaseType") || "") || ProductPurchaseType.NEW) as ProductPurchaseType;

  await prisma.productSale.create({
    data: {
      productId,
      clientId,
      staffId,
      saleDate: saleDateRaw ? new Date(saleDateRaw) : new Date(),
      amount: isGift ? 0 : Math.abs(amountRaw),
      quantity,
      itemType,
      purchaseType,
      isGift,
      // CSV取り込み(サロンボード)の再取り込み防止キーとは無関係。手入力行を一意にするだけ。
      dedupKey: `manual-${clientId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
  });

  revalidatePath(`/clients/${clientId}`);
}
