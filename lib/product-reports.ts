import { prisma } from "@/lib/prisma";
import type { ReportPeriod } from "@/lib/reports";

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

/** 顧客ごとの購入履歴(新しい順)。 */
export async function getClientPurchaseHistory(clientId: string) {
  const sales = await prisma.productSale.findMany({
    where: { clientId },
    orderBy: { saleDate: "desc" },
    include: { product: { select: { name: true, category: true } } },
  });
  return sales.map((s) => ({
    id: s.id,
    saleDate: s.saleDate,
    productName: s.product.name,
    category: s.product.category,
    amount: s.amount,
    itemType: s.itemType,
    purchaseType: s.purchaseType,
    isGift: s.isGift,
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
