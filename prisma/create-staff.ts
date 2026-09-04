import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { StaffRole } from "../app/generated/prisma/client";

// スタッフアカウントを1件作成/更新する運用スクリプト(作成用UIが無いため)。
// 使い方: STAFF_USERNAME / STAFF_PASSWORD / STAFF_NAME / STAFF_ROLE (STAFF or DIRECTOR) を
// 環境変数で渡して実行する。
// 例:
//   DATABASE_URL="<direct connection>" \
//   STAFF_USERNAME="inchou" STAFF_PASSWORD="xxxx" STAFF_NAME="院長" STAFF_ROLE="DIRECTOR" \
//   npx tsx prisma/create-staff.ts

const username = process.env.STAFF_USERNAME;
const password = process.env.STAFF_PASSWORD;
const role = (process.env.STAFF_ROLE ?? "STAFF") as StaffRole;

async function main() {
  if (!username || !password) {
    throw new Error("STAFF_USERNAME と STAFF_PASSWORD を環境変数で指定してください。");
  }
  const name = process.env.STAFF_NAME ?? username;
  if (role !== StaffRole.STAFF && role !== StaffRole.DIRECTOR) {
    throw new Error("STAFF_ROLE は STAFF か DIRECTOR を指定してください。");
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const staff = await prisma.staff.upsert({
    where: { username },
    update: { passwordHash, name, role, active: true },
    create: { username, passwordHash, name, role },
  });

  console.log(`作成/更新しました: id=${staff.id} username=${staff.username} role=${staff.role}`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
