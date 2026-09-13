"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductItemType, ProductPurchaseType, ProductCategory } from "@/app/generated/prisma/client";

// 商品マスタは「あとで追加・修正できる」運用にするため、ここで作成・編集の両方を扱う
// (仕様書 chart-prepaid-product-spec-v2.md 3.3)。

export async function upsertProduct(productId: string | null, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("商品名は必須です");
  const categoryRaw = String(formData.get("category") || "");
  const category = (Object.values(ProductCategory) as string[]).includes(categoryRaw)
    ? (categoryRaw as ProductCategory)
    : ProductCategory.OTHER;
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

function parseProductSaleFields(formData: FormData) {
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

  return {
    productId,
    staffId,
    saleDate: saleDateRaw ? new Date(saleDateRaw) : new Date(),
    amount: isGift ? 0 : Math.abs(amountRaw),
    quantity,
    itemType,
    purchaseType,
    isGift,
  };
}

/** 物販購入を記録する(手入力運用。CSV取り込みとは別経路)。 */
export async function recordProductSale(clientId: string, formData: FormData) {
  const fields = parseProductSaleFields(formData);

  await prisma.productSale.create({
    data: {
      ...fields,
      clientId,
      // CSV取り込み(サロンボード)の再取り込み防止キーとは無関係。手入力行を一意にするだけ。
      dedupKey: `manual-${clientId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
  });

  revalidatePath(`/clients/${clientId}`);
}

/** 物販購入記録の入力ミスを修正する。 */
export async function updateProductSale(saleId: string, formData: FormData) {
  const fields = parseProductSaleFields(formData);
  const sale = await prisma.productSale.update({ where: { id: saleId }, data: fields, select: { clientId: true } });
  if (sale.clientId) revalidatePath(`/clients/${sale.clientId}`);
  revalidatePath("/products");
}

/** 誤って入力した物販購入記録を削除する。 */
export async function deleteProductSale(saleId: string) {
  const sale = await prisma.productSale.delete({ where: { id: saleId }, select: { clientId: true } });
  if (sale.clientId) revalidatePath(`/clients/${sale.clientId}`);
  revalidatePath("/products");
}

function parseStockInFields(formData: FormData) {
  const productId = String(formData.get("productId") || "");
  const quantityRaw = Number(formData.get("quantity"));
  if (!productId || !Number.isFinite(quantityRaw) || quantityRaw <= 0) {
    throw new Error("商品と数量(1以上)を入力してください");
  }
  const stockInDateRaw = String(formData.get("stockInDate") || "");
  const staffId = String(formData.get("staffId") || "") || null;
  const note = String(formData.get("note") || "") || null;

  return {
    productId,
    quantity: Math.trunc(quantityRaw),
    stockInDate: stockInDateRaw ? new Date(stockInDateRaw) : new Date(),
    staffId,
    note,
  };
}

/** 仕入れ(在庫の入荷)を記録する。 */
export async function recordStockIn(formData: FormData) {
  const fields = parseStockInFields(formData);
  await prisma.productStockIn.create({ data: fields });
  revalidatePath("/products/inventory");
}

/** 仕入れ記録の入力ミスを修正する。 */
export async function updateStockIn(stockInId: string, formData: FormData) {
  const fields = parseStockInFields(formData);
  await prisma.productStockIn.update({ where: { id: stockInId }, data: fields });
  revalidatePath("/products/inventory");
}

/** 誤って入力した仕入れ記録を削除する。 */
export async function deleteStockIn(stockInId: string) {
  await prisma.productStockIn.delete({ where: { id: stockInId } });
  revalidatePath("/products/inventory");
}
