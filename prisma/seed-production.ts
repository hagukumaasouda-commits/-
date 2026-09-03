import { prisma } from "../lib/prisma";

// 本番投入用の最小限マスタデータ。prisma/seed.ts と違い、架空の顧客・来院・
// スタッフアカウントは一切作成しない(upsertなので何度実行しても安全)。
// スタッフアカウントは実際のユーザー名・パスワードが必要なため、別途
// 個別に作成する(このファイルには含めない)。

const CHANNEL_NAMES = [
  "院の看板",
  "ホットペッパービューティー",
  "ホームページ",
  "インスタグラム・SNS",
  "ご紹介",
  "その他",
];

async function main() {
  for (const name of CHANNEL_NAMES) {
    await prisma.acquisitionChannel.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`来店経路マスタを ${CHANNEL_NAMES.length} 件 upsert しました。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
