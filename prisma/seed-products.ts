import { prisma } from "../lib/prisma";

// 物販の商品マスタを初期投入する運用スクリプト(upsertなので何度実行しても安全)。
// 価格は未確定のため defaultPrice は空のまま。以降の追加・修正・価格入力は
// /products/manage 画面から行う。
// 使い方:
//   DATABASE_URL="<direct connection>" npx tsx prisma/seed-products.ts

const PRODUCT_NAMES = [
  "Bトレ トライ",
  "Bトレ キッズ",
  "Bトレ BASE",
  "酵素ドリンク",
  "トリプルカッター",
  "トリプルカッター(1箱)10個入",
  "トリプルカッター(1箱)30個入り",
  "代替食トマト",
  "代替食カレー",
  "代替食玄米クリーム",
  "代替食グリーンべジ",
  "代替食コメ",
  "代替食ガユ",
  "代替食(1箱)",
  "水(2L)",
  "水(500ml)",
  "プロテイン(1袋)",
  "プロテイン(1箱)",
  "プロテイン大袋",
  "フローラバランス(1袋)",
  "フローラバランス(1箱)",
  "ビタミンC",
  "ハーブティー1箱",
  "ハーブティー1袋",
  "メタスレンディア",
  "レンタルコアレ",
  "ローヤルゼリー お徳用",
  "ローヤルゼリー",
  "スマイル",
  "ケイ素50ml",
  "ケイ素500ml",
  "カカオパウダー",
  "インカインチプロテイン",
  "ルテイン400粒",
  "ルテイン120粒",
  "Rベーシック",
  "ベーシック",
  "ベーシックカプセル",
  "生酵素",
  "にがりウォーター",
  "梅肉エキス",
  "梅肉エキス(粒)田七",
  "はちみつ500g",
  "はちみつ1kg",
];

async function main() {
  for (const name of PRODUCT_NAMES) {
    await prisma.product.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`商品マスタを ${PRODUCT_NAMES.length} 件 upsert しました。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
