import { prisma } from "@/lib/prisma";
import type { ReportPeriod } from "@/lib/reports";
import { ProductCategory } from "@/app/generated/prisma/client";

// 物販(商品販売)の集計ロジック。プレゼント品(isGift=true)は売上集計から除外し、
// 件数だけ別枠で集計する(ユーザー確認済みの方針)。

/** 月次・商品別の売上(件数・金額)。プレゼント品は除外。 */
export async function getMonthlyProductSales(period: ReportPeriod) {
  const rows = await prisma.productSale.groupBy({
    by: ["productId"],
    where: { saleDate: { gte: period.start, lte: period.end }, isGift: false },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const products = await prisma.product.findMany({ select: { id: true, name: true, category: true } });
  const nameOf = new Map(products.map((p) => [p.id, p]));

  return rows
    .map((r) => ({
      productId: r.productId,
      productName: nameOf.get(r.productId)?.name ?? "(不明)",
      category: nameOf.get(r.productId)?.category ?? null,
      count: r._count._all,
      amount: r._sum.amount ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** 期間内のプレゼント品(無料配布)件数を商品別に集計。 */
export async function getGiftSummary(period: ReportPeriod) {
  const rows = await prisma.productSale.groupBy({
    by: ["productId"],
    where: { saleDate: { gte: period.start, lte: period.end }, isGift: true },
    _count: { _all: true },
  });
  const products = await prisma.product.findMany({ select: { id: true, name: true } });
  const nameOf = new Map(products.map((p) => [p.id, p.name]));

  return rows
    .map((r) => ({
      productId: r.productId,
      productName: nameOf.get(r.productId) ?? "(不明)",
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}

/** スタッフ別の物販売上(プレゼント品を除く)。担当が突合できなかった行は除外。 */
export async function getStaffProductSales(period: ReportPeriod) {
  const rows = await prisma.productSale.groupBy({
    by: ["staffId"],
    where: {
      saleDate: { gte: period.start, lte: period.end },
      isGift: false,
      staffId: { not: null },
    },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const staff = await prisma.staff.findMany({ select: { id: true, name: true } });
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));

  return rows
    .filter((r) => r.staffId)
    .map((r) => ({
      staffId: r.staffId!,
      staffName: nameOf.get(r.staffId!) ?? "(不明)",
      count: r._count._all,
      amount: r._sum.amount ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** 顧客ごとの購入履歴(新しい順)。編集フォームの初期値に必要なフィールドも含む。 */
export async function getClientPurchaseHistory(clientId: string) {
  const sales = await prisma.productSale.findMany({
    where: { clientId },
    orderBy: { saleDate: "desc" },
    include: { product: { select: { name: true, category: true } } },
  });
  return sales.map((s) => ({
    id: s.id,
    productId: s.productId,
    saleDate: s.saleDate,
    productName: s.product.name,
    category: s.product.category,
    amount: s.amount,
    quantity: s.quantity,
    itemType: s.itemType,
    purchaseType: s.purchaseType,
    isGift: s.isGift,
    staffId: s.staffId,
  }));
}

const CORRELATION_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 施術内容(主訴タグ)と購入商品の相関(共起回数)。
 * 各購入について、同じ顧客の最も近い来院(前後14日以内)のチャート主訴タグと突き合わせる。
 * 将来の商品提案(この主訴の人にはこの商品がよく売れている)の土台として使う想定。
 */
export async function getTreatmentProductCorrelation(period: ReportPeriod) {
  const sales = await prisma.productSale.findMany({
    where: { saleDate: { gte: period.start, lte: period.end }, isGift: false, clientId: { not: null } },
    select: { clientId: true, saleDate: true, product: { select: { name: true } } },
  });
  if (sales.length === 0) return [];

  const clientIds = Array.from(new Set(sales.map((s) => s.clientId!)));
  const visits = await prisma.visit.findMany({
    where: { clientId: { in: clientIds } },
    select: { clientId: true, visitDate: true, chartRecord: { select: { chiefComplaintTags: true } } },
  });
  const visitsByClient = new Map<string, typeof visits>();
  for (const v of visits) {
    const list = visitsByClient.get(v.clientId) ?? [];
    list.push(v);
    visitsByClient.set(v.clientId, list);
  }

  const counts = new Map<string, { tag: string; productName: string; count: number }>();
  for (const sale of sales) {
    const candidateVisits = visitsByClient.get(sale.clientId!) ?? [];
    let nearest: (typeof candidateVisits)[number] | null = null;
    let nearestDiff = Infinity;
    for (const v of candidateVisits) {
      const diff = Math.abs(v.visitDate.getTime() - sale.saleDate.getTime());
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearest = v;
      }
    }
    if (!nearest || nearestDiff > CORRELATION_WINDOW_DAYS * DAY_MS) continue;
    for (const tag of nearest.chartRecord?.chiefComplaintTags ?? []) {
      const key = `${tag}\u0000${sale.product.name}`;
      const existing = counts.get(key);
      if (existing) existing.count++;
      else counts.set(key, { tag, productName: sale.product.name, count: 1 });
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

export type StaffCategorySales = {
  staffId: string;
  staffName: string;
  byCategory: Record<ProductCategory, { count: number; amount: number }>;
  totalCount: number;
  totalAmount: number;
};

function emptyCategoryTotals(): Record<ProductCategory, { count: number; amount: number }> {
  return {
    RIPPLE: { count: 0, amount: 0 },
    GRANT: { count: 0, amount: 0 },
    OTHER: { count: 0, amount: 0 },
  };
}

/**
 * スタッフ別・カテゴリ別の物販売上(プレゼント品を除く)。歩合率がカテゴリごとに
 * 異なるため、個人の売上をカテゴリで内訳表示できるようにする。担当が突合できな
 * かった行は除外(既存のgetStaffProductSalesと同じ方針)。
 */
export async function getStaffProductSalesByCategory(period: ReportPeriod): Promise<StaffCategorySales[]> {
  const rows = await prisma.productSale.groupBy({
    by: ["staffId", "productId"],
    where: {
      saleDate: { gte: period.start, lte: period.end },
      isGift: false,
      staffId: { not: null },
    },
    _sum: { amount: true },
    _count: { _all: true },
  });
  if (rows.length === 0) return [];

  const [staff, products] = await Promise.all([
    prisma.staff.findMany({ select: { id: true, name: true } }),
    prisma.product.findMany({ select: { id: true, category: true } }),
  ]);
  const staffNameOf = new Map(staff.map((s) => [s.id, s.name]));
  const categoryOf = new Map(products.map((p) => [p.id, p.category]));

  const byStaff = new Map<string, StaffCategorySales>();
  for (const r of rows) {
    if (!r.staffId) continue;
    const category = categoryOf.get(r.productId) ?? ProductCategory.OTHER;
    const cur = byStaff.get(r.staffId) ?? {
      staffId: r.staffId,
      staffName: staffNameOf.get(r.staffId) ?? "(不明)",
      byCategory: emptyCategoryTotals(),
      totalCount: 0,
      totalAmount: 0,
    };
    cur.byCategory[category].count += r._count._all;
    cur.byCategory[category].amount += r._sum.amount ?? 0;
    cur.totalCount += r._count._all;
    cur.totalAmount += r._sum.amount ?? 0;
    byStaff.set(r.staffId, cur);
  }

  return Array.from(byStaff.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}

export type InventoryStatus = {
  id: string;
  name: string;
  category: ProductCategory;
  active: boolean;
  totalStockIn: number;
  totalSold: number;
  currentStock: number;
};

/**
 * 商品ごとの現在庫 = 仕入れ数量の合計 - 販売数量の合計。
 * ProductSale.quantityが未記録の行(CSV取り込み分の一部)は販売数量に反映されない
 * ため、その分だけ在庫が実際より多く表示される制約がある(手入力運用の限界)。
 */
export async function getInventoryStatus(): Promise<InventoryStatus[]> {
  const [products, stockInSums, saleSums] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.productStockIn.groupBy({ by: ["productId"], _sum: { quantity: true } }),
    prisma.productSale.groupBy({ by: ["productId"], _sum: { quantity: true } }),
  ]);
  const stockInOf = new Map(stockInSums.map((s) => [s.productId, s._sum.quantity ?? 0]));
  const soldOf = new Map(saleSums.map((s) => [s.productId, s._sum.quantity ?? 0]));

  return products.map((p) => {
    const totalStockIn = stockInOf.get(p.id) ?? 0;
    const totalSold = soldOf.get(p.id) ?? 0;
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      active: p.active,
      totalStockIn,
      totalSold,
      currentStock: totalStockIn - totalSold,
    };
  });
}

/** 仕入れ履歴(新しい順)。編集フォームの初期値に必要なフィールドも含む。 */
export async function getStockInHistory() {
  const rows = await prisma.productStockIn.findMany({
    orderBy: { stockInDate: "desc" },
    include: { product: { select: { name: true } }, staff: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.product.name,
    quantity: r.quantity,
    stockInDate: r.stockInDate,
    staffId: r.staffId,
    staffName: r.staff?.name ?? null,
    note: r.note,
  }));
}
