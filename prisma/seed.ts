import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import {
  PrepaidTxType,
  ReservationSource,
  ReservationStatus,
  CheckType,
  Severity,
  CheckStatus,
  StaffRole,
} from "../app/generated/prisma/client";

// 開発・デモ用のシードデータです。実在の患者情報は含みません(すべて架空の人物)。
// ログイン用パスワードは全員共通の "hagukuma-demo" です。本番投入前に必ず変更してください。

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);
const DEMO_PASSWORD_HASH = bcrypt.hashSync("hagukuma-demo", 10);

async function main() {
  console.log("seeding...");

  await prisma.awarenessDialogue.deleteMany();
  await prisma.awarenessCheck.deleteMany();
  await prisma.staffMindsetCheck.deleteMany();
  await prisma.prepaidTransaction.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.chartRecord.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.treatmentCourse.deleteMany();
  await prisma.prepaidCard.deleteMany();
  await prisma.clientStatusSnapshot.deleteMany();
  await prisma.clientStaff.deleteMany();
  await prisma.client.deleteMany();
  await prisma.acquisitionChannel.deleteMany();
  await prisma.staff.deleteMany();

  // --- スタッフ -----------------------------------------------------------
  const director = await prisma.staff.create({
    data: {
      name: "高橋 院長",
      role: StaffRole.DIRECTOR,
      username: "inchou",
      passwordHash: DEMO_PASSWORD_HASH,
    },
  });
  const staffSato = await prisma.staff.create({
    data: { name: "佐藤", username: "sato", passwordHash: DEMO_PASSWORD_HASH },
  });
  const staffSuzuki = await prisma.staff.create({
    data: { name: "鈴木", username: "suzuki", passwordHash: DEMO_PASSWORD_HASH },
  });
  const staffTanaka = await prisma.staff.create({
    data: { name: "田中", username: "tanaka", passwordHash: DEMO_PASSWORD_HASH },
  });

  // --- 来店経路 -------------------------------------------------------------
  const channelNames = [
    "院の看板",
    "ホットペッパービューティー",
    "ホームページ",
    "インスタグラム・SNS",
    "ご紹介",
    "その他",
  ];
  const channels = Object.fromEntries(
    await Promise.all(
      channelNames.map(async (name) => [
        name,
        await prisma.acquisitionChannel.create({ data: { name } }),
      ])
    )
  );

  const complaintTagPool = [
    "肩こり",
    "腰痛",
    "頭痛",
    "自律神経症状",
    "姿勢改善",
    "冷えやむくみ",
  ];
  const bodyPartTagPool = ["頸部", "胸椎", "腰椎", "骨盤", "上肢", "下肢"];

  async function createVisitsWithChart(opts: {
    clientId: string;
    staffId: string;
    firstVisitDate: Date;
    count: number;
    intervalDays: number;
  }) {
    const { clientId, staffId, firstVisitDate, count, intervalDays } = opts;
    let visitDate = firstVisitDate;
    for (let i = 1; i <= count; i++) {
      const visit = await prisma.visit.create({
        data: {
          clientId,
          staffId,
          visitDate,
          visitNo: i,
          menu: "全身調整",
        },
      });
      await prisma.chartRecord.create({
        data: {
          visitId: visit.id,
          chiefComplaintTags: [
            complaintTagPool[i % complaintTagPool.length],
            complaintTagPool[(i + 2) % complaintTagPool.length],
          ],
          bodyPartTags: [
            bodyPartTagPool[i % bodyPartTagPool.length],
            bodyPartTagPool[(i + 1) % bodyPartTagPool.length],
          ],
          exam: { neck: "2", chest: "2", waist: "2" },
          evaluation: `第${i}回。前回からの反応は良好。`,
          changeFromLast: i === 1 ? null : "可動域がやや改善",
          nextCheck: "睡眠時間の変化を確認",
          requiredFields: { menu: "完", evaluation: "完", nextCheck: "完" },
        },
      });
      visitDate = new Date(visitDate.getTime() + intervalDays * DAY);
    }
    return visitDate; // 次に来るはずだった日(離脱判定の参考用)
  }

  // --- 顧客1: 山田花子(ホットペッパー / 活発 / 次回予約あり) --------------
  const yamada = await prisma.client.create({
    data: {
      name: "山田 花子",
      kana: "ヤマダ ハナコ",
      gender: "女",
      phone: "090-0000-0001",
      acquisitionChannelId: channels["ホットペッパービューティー"].id,
      primaryStaffId: staffSato.id,
      firstVisitDate: daysAgo(150),
      lifestyleTags: { sleepHours: 6, waterIntake: "500ml〜1L" },
    },
  });
  await prisma.clientStaff.create({ data: { clientId: yamada.id, staffId: staffSato.id } });
  await createVisitsWithChart({
    clientId: yamada.id,
    staffId: staffSato.id,
    firstVisitDate: daysAgo(150),
    count: 10,
    intervalDays: 14,
  });
  const yamadaCard = await prisma.prepaidCard.create({
    data: { clientId: yamada.id, planType: "プ2万" },
  });
  await prisma.prepaidTransaction.create({
    data: { cardId: yamadaCard.id, txType: PrepaidTxType.CHARGE, amount: 20000, balanceAfter: 20000, txDate: daysAgo(150) },
  });
  await prisma.prepaidTransaction.create({
    data: { cardId: yamadaCard.id, txType: PrepaidTxType.USE, amount: -12000, balanceAfter: 8000, txDate: daysAgo(20) },
  });
  await prisma.reservation.create({
    data: {
      clientId: yamada.id,
      source: ReservationSource.HOTPEPPER,
      reservedAt: daysFromNow(5),
      status: ReservationStatus.CONFIRMED,
    },
  });

  // --- 顧客2: 田中太郎(院の看板 / 15回以上のロイヤル顧客) ------------------
  const tanaka = await prisma.client.create({
    data: {
      name: "田中 太郎",
      kana: "タナカ タロウ",
      gender: "男",
      phone: "090-0000-0002",
      acquisitionChannelId: channels["院の看板"].id,
      primaryStaffId: staffSuzuki.id,
      firstVisitDate: daysAgo(240),
    },
  });
  await prisma.clientStaff.create({ data: { clientId: tanaka.id, staffId: staffSuzuki.id } });
  await createVisitsWithChart({
    clientId: tanaka.id,
    staffId: staffSuzuki.id,
    firstVisitDate: daysAgo(240),
    count: 18,
    intervalDays: 12,
  });
  await prisma.reservation.create({
    data: { clientId: tanaka.id, source: ReservationSource.LINE, reservedAt: daysFromNow(3) },
  });

  // --- 顧客3: 佐々木恵美(山田花子からの紹介 / 初回→2回目移行済み) --------
  const sasaki = await prisma.client.create({
    data: {
      name: "佐々木 恵美",
      kana: "ササキ エミ",
      gender: "女",
      acquisitionChannelId: channels["ご紹介"].id,
      referredById: yamada.id,
      primaryStaffId: staffSato.id,
      firstVisitDate: daysAgo(50),
    },
  });
  await prisma.clientStaff.create({ data: { clientId: sasaki.id, staffId: staffSato.id } });
  await createVisitsWithChart({
    clientId: sasaki.id,
    staffId: staffSato.id,
    firstVisitDate: daysAgo(50),
    count: 3,
    intervalDays: 14,
  });
  await prisma.reservation.create({
    data: { clientId: sasaki.id, source: ReservationSource.MANUAL, reservedAt: daysFromNow(10) },
  });

  // --- 顧客4: 高橋純一(ホームページ / 6回以上リピーター) -------------------
  const takahashi = await prisma.client.create({
    data: {
      name: "高橋 純一",
      kana: "タカハシ ジュンイチ",
      gender: "男",
      acquisitionChannelId: channels["ホームページ"].id,
      primaryStaffId: staffTanaka.id,
      firstVisitDate: daysAgo(90),
    },
  });
  await prisma.clientStaff.create({ data: { clientId: takahashi.id, staffId: staffTanaka.id } });
  await createVisitsWithChart({
    clientId: takahashi.id,
    staffId: staffTanaka.id,
    firstVisitDate: daysAgo(90),
    count: 7,
    intervalDays: 12,
  });
  await prisma.reservation.create({
    data: { clientId: takahashi.id, source: ReservationSource.PHONE, reservedAt: daysFromNow(7) },
  });

  // --- 顧客5: 中村あすか(SNS / 初回のみで来店が止まった=離脱) --------------
  const nakamura = await prisma.client.create({
    data: {
      name: "中村 あすか",
      kana: "ナカムラ アスカ",
      gender: "女",
      acquisitionChannelId: channels["インスタグラム・SNS"].id,
      primaryStaffId: staffSato.id,
      firstVisitDate: daysAgo(60),
      isActive: false,
    },
  });
  await prisma.clientStaff.create({ data: { clientId: nakamura.id, staffId: staffSato.id } });
  await createVisitsWithChart({
    clientId: nakamura.id,
    staffId: staffSato.id,
    firstVisitDate: daysAgo(60),
    count: 1,
    intervalDays: 14,
  });
  // 予約なし・6週間以上経過 = 離脱扱い

  // --- 顧客6: 小林誠(ホットペッパー / 残高は残っているのに来店停止) --------
  const kobayashi = await prisma.client.create({
    data: {
      name: "小林 誠",
      kana: "コバヤシ マコト",
      gender: "男",
      acquisitionChannelId: channels["ホットペッパービューティー"].id,
      primaryStaffId: staffSato.id,
      firstVisitDate: daysAgo(300),
      isActive: false,
    },
  });
  await prisma.clientStaff.create({ data: { clientId: kobayashi.id, staffId: staffSato.id } });
  const kobayashiLastVisit = await createVisitsWithChart({
    clientId: kobayashi.id,
    staffId: staffSato.id,
    firstVisitDate: daysAgo(300),
    count: 16,
    intervalDays: 14,
  });
  const kobayashiCard = await prisma.prepaidCard.create({
    data: { clientId: kobayashi.id, planType: "プ3万" },
  });
  await prisma.prepaidTransaction.create({
    data: { cardId: kobayashiCard.id, txType: PrepaidTxType.CHARGE, amount: 30000, balanceAfter: 30000, txDate: daysAgo(300) },
  });
  await prisma.prepaidTransaction.create({
    data: { cardId: kobayashiCard.id, txType: PrepaidTxType.USE, amount: -18000, balanceAfter: 12000, txDate: daysAgo(60) },
  });
  // 残高12,000円が残ったまま8週間以上来店なし、次回予約もなし -> 消化ペース検出の対象
  void kobayashiLastVisit;

  // --- 顧客7: 渡辺由紀(田中太郎からの紹介 / 初回来店したばかり) -----------
  const watanabe = await prisma.client.create({
    data: {
      name: "渡辺 由紀",
      kana: "ワタナベ ユキ",
      gender: "女",
      acquisitionChannelId: channels["ご紹介"].id,
      referredById: tanaka.id,
      primaryStaffId: staffSuzuki.id,
      firstVisitDate: daysAgo(10),
    },
  });
  await prisma.clientStaff.create({ data: { clientId: watanabe.id, staffId: staffSuzuki.id } });
  await createVisitsWithChart({
    clientId: watanabe.id,
    staffId: staffSuzuki.id,
    firstVisitDate: daysAgo(10),
    count: 1,
    intervalDays: 14,
  });
  await prisma.reservation.create({
    data: { clientId: watanabe.id, source: ReservationSource.HOTPEPPER, reservedAt: daysFromNow(4) },
  });

  // --- 顧客8: 伊藤誠一(その他 / 継続中) ------------------------------------
  const ito = await prisma.client.create({
    data: {
      name: "伊藤 誠一",
      kana: "イトウ セイイチ",
      gender: "男",
      acquisitionChannelId: channels["その他"].id,
      primaryStaffId: staffTanaka.id,
      firstVisitDate: daysAgo(120),
    },
  });
  await prisma.clientStaff.create({ data: { clientId: ito.id, staffId: staffTanaka.id } });
  const itoVisits = await prisma.$transaction(async () => {
    await createVisitsWithChart({
      clientId: ito.id,
      staffId: staffTanaka.id,
      firstVisitDate: daysAgo(120),
      count: 9,
      intervalDays: 12,
    });
  });
  void itoVisits;
  await prisma.reservation.create({
    data: { clientId: ito.id, source: ReservationSource.MANUAL, reservedAt: daysFromNow(6) },
  });

  // --- 気づきチェックのサンプル(小林さんの最終来院時に紐づける) -----------
  const kobayashiLastVisitRow = await prisma.visit.findFirst({
    where: { clientId: kobayashi.id },
    orderBy: { visitNo: "desc" },
  });
  if (kobayashiLastVisitRow) {
    const officeCheck = await prisma.awarenessCheck.create({
      data: {
        visitId: kobayashiLastVisitRow.id,
        checkType: CheckType.OFFICE,
        category: "記入漏れ",
        message: "「次回必須」の項目が未入力のままです。",
        severity: Severity.NOTICE,
        status: CheckStatus.RESOLVED,
      },
    });
    await prisma.awarenessDialogue.create({
      data: {
        awarenessCheckId: officeCheck.id,
        authorStaffId: staffSato.id,
        comment: "記入漏れに気づき、当日中に追記しました。",
      },
    });

    const aiCheck = await prisma.awarenessCheck.create({
      data: {
        visitId: kobayashiLastVisitRow.id,
        checkType: CheckType.AI_INSIGHT,
        category: "残高消化と来店の乖離",
        message:
          "小林様はプリカ残高が12,000円残っていますが、最終来院から8週間以上が経過し、次回予約も入っていません。来店が途絶えた理由に心当たりはありますか？一度お電話や院長への共有を検討してみてはいかがでしょうか。",
        severity: Severity.IMPORTANT,
        status: CheckStatus.OPEN,
      },
    });
    await prisma.awarenessDialogue.create({
      data: {
        awarenessCheckId: aiCheck.id,
        authorStaffId: director.id,
        comment: "共有ありがとう。来週スタッフミーティングで話しましょう。",
      },
    });
  }

  // --- マインドチェックのサンプル -------------------------------------------
  const yamadaLastVisit = await prisma.visit.findFirst({
    where: { clientId: yamada.id },
    orderBy: { visitNo: "desc" },
  });
  if (yamadaLastVisit) {
    await prisma.staffMindsetCheck.create({
      data: {
        visitId: yamadaLastVisit.id,
        staffId: staffSato.id,
        selfCheck: {
          totonoeru: true,
          imakoko: true,
          hyoukakyoufuNashi: false,
          haraOKukuru: true,
        },
        note: "評価が気になり少し前のめりになった。次回は検査結果をもっと待ってから伝える。",
      },
    });
  }

  // --- 状態スナップショット ---------------------------------------------
  await prisma.clientStatusSnapshot.createMany({
    data: [
      { clientId: yamada.id, snapshotDate: daysAgo(20), rank: "A", healthScore: 65, statusLabel: "継続" },
      { clientId: tanaka.id, snapshotDate: daysAgo(15), rank: "AS", healthScore: 70, statusLabel: "健康管理" },
      { clientId: kobayashi.id, snapshotDate: daysAgo(60), rank: "B", healthScore: 45, statusLabel: "不安" },
    ],
  });

  console.log("seed done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
