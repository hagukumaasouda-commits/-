"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClientRank, ReferralSourceType, RegistrationType } from "@/app/generated/prisma/client";

/** 「氏名 #id」形式のデータリスト候補から選択されたIDを取り出す(docs/referral-source-registration-type-spec-v2.md)。 */
function parseReferralSource(formData: FormData, excludeClientId?: string) {
  const typeRaw = String(formData.get("referralSourceType") || "");
  const type = typeRaw ? (typeRaw as ReferralSourceType) : null;

  let clientId: string | null = null;
  let staffId: string | null = null;
  let note: string | null = null;

  if (type === "EXISTING_CLIENT") {
    const query = String(formData.get("referralSourceClientQuery") || "");
    const match = query.match(/#([a-z0-9]+)\s*$/i);
    clientId = match ? match[1] : null;
    if (clientId && clientId === excludeClientId) clientId = null; // 自分自身は紹介元にできない
  } else if (type === "STAFF") {
    staffId = String(formData.get("referralSourceStaffId") || "") || null;
  } else if (type === "OTHER") {
    note = String(formData.get("referralSourceNote") || "") || null;
  }

  return { type, clientId, staffId, note };
}

export async function createClient(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("氏名は必須です");

  const registrationTypeRaw = String(formData.get("registrationType") || "");
  if (!registrationTypeRaw) throw new Error("登録区分は必須です");
  const registrationType = registrationTypeRaw as RegistrationType;

  const acquisitionChannelId = String(formData.get("acquisitionChannelId") || "") || null;
  const primaryStaffId = String(formData.get("primaryStaffId") || "") || null;
  const firstVisitDateRaw = String(formData.get("firstVisitDate") || "");
  const dobRaw = String(formData.get("dob") || "");
  const rankRaw = String(formData.get("rank") || "");
  const initialVisitCountRaw = String(formData.get("initialVisitCount") || "");
  const initialVisitCountInput = initialVisitCountRaw ? parseInt(initialVisitCountRaw, 10) : 0;
  // 「新規」の場合は来院回数(実績)を必ず0にする(UI上は非表示になるが、サーバー側でも保証する)
  const initialVisitCount =
    registrationType === "NEW"
      ? 0
      : Number.isFinite(initialVisitCountInput) && initialVisitCountInput >= 0
        ? initialVisitCountInput
        : 0;

  const referralSource = parseReferralSource(formData);
  let referralSourceClientId = referralSource.clientId;
  if (referralSourceClientId) {
    const exists = await prisma.client.findUnique({ where: { id: referralSourceClientId }, select: { id: true } });
    if (!exists) referralSourceClientId = null;
  }
  let referralSourceType: ReferralSourceType | null = referralSource.type;
  if (referralSourceType === "EXISTING_CLIENT" && !referralSourceClientId) referralSourceType = null;

  const client = await prisma.client.create({
    data: {
      name,
      externalCustomerNo: String(formData.get("externalCustomerNo") || "") || null,
      kana: String(formData.get("kana") || "") || null,
      gender: String(formData.get("gender") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      acquisitionChannelId,
      primaryStaffId,
      firstVisitDate: firstVisitDateRaw ? new Date(firstVisitDateRaw) : null,
      dob: dobRaw ? new Date(dobRaw) : null,
      rank: rankRaw ? (rankRaw as ClientRank) : null,
      initialVisitCount,
      personalData: String(formData.get("personalData") || "") || null,
      manifestNeed: String(formData.get("manifestNeed") || "") || null,
      deepNeed: String(formData.get("deepNeed") || "") || null,
      wants: String(formData.get("wants") || "") || null,
      registrationType,
      referralSourceType,
      referralSourceClientId,
      referralSourceStaffId: referralSource.staffId,
      referralSourceNote: referralSource.note,
    },
  });

  if (primaryStaffId) {
    await prisma.clientStaff.create({ data: { clientId: client.id, staffId: primaryStaffId } });
  }

  if (referralSourceClientId) {
    await prisma.client.update({ where: { id: referralSourceClientId }, data: { referralCount: { increment: 1 } } });
  }

  redirect(`/clients/${client.id}`);
}

export async function updateClient(clientId: string, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("氏名は必須です");

  const dobRaw = String(formData.get("dob") || "");
  const firstVisitDateRaw = String(formData.get("firstVisitDate") || "");
  const acquisitionChannelId = String(formData.get("acquisitionChannelId") || "") || null;
  const primaryStaffId = String(formData.get("primaryStaffId") || "") || null;
  const rankRaw = String(formData.get("rank") || "");
  const initialVisitCountRaw = String(formData.get("initialVisitCount") || "");
  const initialVisitCount = initialVisitCountRaw ? parseInt(initialVisitCountRaw, 10) : 0;
  const registrationTypeRaw = String(formData.get("registrationType") || "");
  if (!registrationTypeRaw) throw new Error("登録区分は必須です");
  const registrationType = registrationTypeRaw as RegistrationType;

  const referralSource = parseReferralSource(formData, clientId);
  let referralSourceClientId = referralSource.clientId;
  if (referralSourceClientId) {
    const exists = await prisma.client.findUnique({ where: { id: referralSourceClientId }, select: { id: true } });
    if (!exists) referralSourceClientId = null;
  }
  let referralSourceType: ReferralSourceType | null = referralSource.type;
  if (referralSourceType === "EXISTING_CLIENT" && !referralSourceClientId) referralSourceType = null;

  const before = await prisma.client.findUnique({
    where: { id: clientId },
    select: { referralSourceType: true, referralSourceClientId: true },
  });
  const oldReferredClientId = before?.referralSourceType === "EXISTING_CLIENT" ? before.referralSourceClientId : null;
  const newReferredClientId = referralSourceType === "EXISTING_CLIENT" ? referralSourceClientId : null;

  await prisma.client.update({
    where: { id: clientId },
    data: {
      name,
      externalCustomerNo: String(formData.get("externalCustomerNo") || "") || null,
      kana: String(formData.get("kana") || "") || null,
      dob: dobRaw ? new Date(dobRaw) : null,
      gender: String(formData.get("gender") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      postalCode: String(formData.get("postalCode") || "") || null,
      address: String(formData.get("address") || "") || null,
      occupation: String(formData.get("occupation") || "") || null,
      acquisitionChannelId,
      primaryStaffId,
      firstVisitDate: firstVisitDateRaw ? new Date(firstVisitDateRaw) : null,
      medicalHistory: String(formData.get("medicalHistory") || "") || null,
      familyData: String(formData.get("familyData") || "") || null,
      personalData: String(formData.get("personalData") || "") || null,
      manifestNeed: String(formData.get("manifestNeed") || "") || null,
      deepNeed: String(formData.get("deepNeed") || "") || null,
      wants: String(formData.get("wants") || "") || null,
      rank: rankRaw ? (rankRaw as ClientRank) : null,
      initialVisitCount: Number.isFinite(initialVisitCount) && initialVisitCount >= 0 ? initialVisitCount : 0,
      registrationType,
      referralSourceType,
      referralSourceClientId,
      referralSourceStaffId: referralSource.staffId,
      referralSourceNote: referralSource.note,
    },
  });

  if (primaryStaffId) {
    await prisma.clientStaff.upsert({
      where: { clientId_staffId: { clientId, staffId: primaryStaffId } },
      update: {},
      create: { clientId, staffId: primaryStaffId },
    });
  }

  if (oldReferredClientId !== newReferredClientId) {
    if (oldReferredClientId) {
      await prisma.client.update({ where: { id: oldReferredClientId }, data: { referralCount: { decrement: 1 } } });
    }
    if (newReferredClientId) {
      await prisma.client.update({ where: { id: newReferredClientId }, data: { referralCount: { increment: 1 } } });
    }
  }

  redirect(`/clients/${clientId}`);
}

/**
 * 誤って作成した重複プロフィールを、関連データごと完全に削除する(docs/client-delete-merge-spec-v2.md 2節)。
 * 実データが入っている場合は代わりに mergeClients を使うべきだが、
 * ここでは呼び出し側(編集画面)の確認ダイアログで件数を示すに留め、削除自体は止めない。
 */
export async function deleteClient(clientId: string) {
  await prisma.$transaction(async (tx) => {
    const visits = await tx.visit.findMany({ where: { clientId }, select: { id: true } });
    const visitIds = visits.map((v) => v.id);

    if (visitIds.length > 0) {
      const checks = await tx.awarenessCheck.findMany({ where: { visitId: { in: visitIds } }, select: { id: true } });
      const checkIds = checks.map((c) => c.id);
      if (checkIds.length > 0) {
        await tx.awarenessDialogue.deleteMany({ where: { awarenessCheckId: { in: checkIds } } });
        await tx.awarenessCheck.deleteMany({ where: { id: { in: checkIds } } });
      }
      await tx.staffMindsetCheck.deleteMany({ where: { visitId: { in: visitIds } } });
    }

    const departures = await tx.departureRecord.findMany({ where: { clientId }, select: { id: true } });
    const departureIds = departures.map((d) => d.id);
    if (departureIds.length > 0) {
      await tx.followupCheckpoint.deleteMany({ where: { departureRecordId: { in: departureIds } } });
      await tx.departureRecord.deleteMany({ where: { id: { in: departureIds } } });
    }

    await tx.reassignmentRequest.deleteMany({ where: { clientId } });
    await tx.reservation.deleteMany({ where: { clientId } });
    await tx.clientStatusSnapshot.deleteMany({ where: { clientId } });
    await tx.productSale.deleteMany({ where: { clientId } });

    const card = await tx.prepaidCard.findUnique({ where: { clientId }, select: { id: true } });
    if (card) {
      await tx.prepaidTransaction.deleteMany({ where: { cardId: card.id } });
      await tx.prepaidCard.delete({ where: { id: card.id } });
    }

    if (visitIds.length > 0) {
      await tx.chartRecord.deleteMany({ where: { visitId: { in: visitIds } } });
      await tx.visit.deleteMany({ where: { id: { in: visitIds } } });
    }

    await tx.treatmentCourse.deleteMany({ where: { clientId } });

    // LINE友だちは削除せず、未紐づけに戻す(友だち自体の記録は残す)
    await tx.lineFriend.updateMany({
      where: { linkedClientId: clientId },
      data: { linkedClientId: null, linkedAt: null, linkedByStaffId: null },
    });

    const target = await tx.client.findUnique({ where: { id: clientId }, select: { referralSourceClientId: true } });
    if (target?.referralSourceClientId) {
      await tx.client.update({
        where: { id: target.referralSourceClientId },
        data: { referralCount: { decrement: 1 } },
      });
    }

    // この顧客を紹介元にしていた他の顧客は、紹介元情報をクリアする
    await tx.client.updateMany({
      where: { referralSourceClientId: clientId },
      data: { referralSourceClientId: null, referralSourceType: null },
    });

    await tx.clientStaff.deleteMany({ where: { clientId } });

    await tx.client.delete({ where: { id: clientId } });
  }, { timeout: 20000 });

  redirect("/clients");
}

function fillIfEmpty<T>(keepValue: T | null, mergeValue: T | null): T | null {
  return keepValue ?? mergeValue ?? null;
}

/**
 * 重複プロフィール(merge)のデータを、開いている顧客(keep)へ統合してからmergeを削除する
 * (docs/client-delete-merge-spec-v2.md 3節)。実データを失わずに1つのプロフィールへまとめる。
 */
export async function mergeClients(keepId: string, formData: FormData) {
  const query = String(formData.get("mergeClientQuery") || "");
  const match = query.match(/#([a-z0-9]+)\s*$/i);
  const mergeId = match ? match[1] : null;
  if (!mergeId) throw new Error("統合する顧客を選択してください");
  if (mergeId === keepId) throw new Error("同じ顧客は選択できません");

  await prisma.$transaction(async (tx) => {
    const [keep, merge] = await Promise.all([
      tx.client.findUniqueOrThrow({ where: { id: keepId } }),
      tx.client.findUniqueOrThrow({ where: { id: mergeId } }),
    ]);

    // 1. 来院(Visit)を時系列で1つの履歴として統合し、visitNoを振り直す。
    // @@unique([clientId, visitNo])に途中で抵触しないよう、一旦大きな番号へ退避してから最終番号を振る。
    const [keepVisits, mergeVisits] = await Promise.all([
      tx.visit.findMany({ where: { clientId: keepId }, select: { id: true, visitDate: true } }),
      tx.visit.findMany({ where: { clientId: mergeId }, select: { id: true, visitDate: true } }),
    ]);
    const allVisits = [...keepVisits, ...mergeVisits].sort((a, b) => a.visitDate.getTime() - b.visitDate.getTime());

    for (let i = 0; i < allVisits.length; i++) {
      await tx.visit.update({ where: { id: allVisits[i].id }, data: { visitNo: 1000000 + i } });
    }
    for (let i = 0; i < allVisits.length; i++) {
      await tx.visit.update({ where: { id: allVisits[i].id }, data: { visitNo: i + 1, clientId: keepId } });
    }

    // 2. プリカの統合(残高は取引の合計で決まるため、取引を1枚のカードにまとめれば自然に合算される)
    const [keepCard, mergeCard] = await Promise.all([
      tx.prepaidCard.findUnique({ where: { clientId: keepId } }),
      tx.prepaidCard.findUnique({ where: { clientId: mergeId } }),
    ]);
    if (mergeCard) {
      if (keepCard) {
        await tx.prepaidTransaction.updateMany({ where: { cardId: mergeCard.id }, data: { cardId: keepCard.id } });
        await tx.prepaidCard.delete({ where: { id: mergeCard.id } });
      } else {
        await tx.prepaidCard.update({ where: { id: mergeCard.id }, data: { clientId: keepId } });
      }
    }

    // 3. 一意制約が絡まない付け替え(FollowupCheckpointはdepartureRecordId経由で自動的に付いてくる)
    await tx.reservation.updateMany({ where: { clientId: mergeId }, data: { clientId: keepId } });
    await tx.clientStatusSnapshot.updateMany({ where: { clientId: mergeId }, data: { clientId: keepId } });
    await tx.productSale.updateMany({ where: { clientId: mergeId }, data: { clientId: keepId } });
    await tx.departureRecord.updateMany({ where: { clientId: mergeId }, data: { clientId: keepId } });
    await tx.reassignmentRequest.updateMany({ where: { clientId: mergeId }, data: { clientId: keepId } });
    await tx.treatmentCourse.updateMany({ where: { clientId: mergeId }, data: { clientId: keepId } });

    // 4. 複数担当(ClientStaff): keepに無い担当だけ追加してからmergeの割り当てを削除
    const [keepAssignments, mergeAssignments] = await Promise.all([
      tx.clientStaff.findMany({ where: { clientId: keepId }, select: { staffId: true } }),
      tx.clientStaff.findMany({ where: { clientId: mergeId }, select: { staffId: true } }),
    ]);
    const keepStaffIds = new Set(keepAssignments.map((a) => a.staffId));
    for (const a of mergeAssignments) {
      if (!keepStaffIds.has(a.staffId)) {
        await tx.clientStaff.create({ data: { clientId: keepId, staffId: a.staffId } });
      }
    }
    await tx.clientStaff.deleteMany({ where: { clientId: mergeId } });

    // 5. LINE友だち紐づけ: keepに無ければ付け替え、両方にあればmergeの方は未紐づけに戻す
    const mergeLineFriend = await tx.lineFriend.findUnique({ where: { linkedClientId: mergeId } });
    if (mergeLineFriend) {
      const keepLineFriend = await tx.lineFriend.findUnique({ where: { linkedClientId: keepId } });
      if (keepLineFriend) {
        await tx.lineFriend.update({
          where: { id: mergeLineFriend.id },
          data: { linkedClientId: null, linkedAt: null, linkedByStaffId: null },
        });
      } else {
        await tx.lineFriend.update({ where: { id: mergeLineFriend.id }, data: { linkedClientId: keepId } });
      }
    }

    // 6. 紹介関係: 他の顧客からmergeへの参照をkeepへ、keep自身の紹介元は未設定の場合のみmergeから採用
    await tx.client.updateMany({
      where: { referralSourceClientId: mergeId, id: { not: keepId } },
      data: { referralSourceClientId: keepId },
    });
    const referralFillIn =
      !keep.referralSourceType && merge.referralSourceType && merge.referralSourceClientId !== keepId
        ? {
            referralSourceType: merge.referralSourceType,
            referralSourceClientId: merge.referralSourceClientId,
            referralSourceStaffId: merge.referralSourceStaffId,
            referralSourceNote: merge.referralSourceNote,
          }
        : {};

    // 7. 予約日系フィールドはグループとして扱う(keepに予約が無い場合のみmergeのグループを丸ごと採用)
    const appointmentFillIn =
      keep.appointmentStatus === "NONE" && merge.appointmentStatus !== "NONE"
        ? { nextAppointmentDate: merge.nextAppointmentDate, appointmentStatus: merge.appointmentStatus, cancelledAt: merge.cancelledAt }
        : {};

    // 8. その他のスカラー項目: keepが未入力の場合のみmergeの値で埋める(不足補完)。
    // firstVisitDateは補完ではなく早い方を採用、initialVisitCount・referralCountは合算する。
    await tx.client.update({
      where: { id: keepId },
      data: {
        kana: fillIfEmpty(keep.kana, merge.kana),
        dob: fillIfEmpty(keep.dob, merge.dob),
        gender: fillIfEmpty(keep.gender, merge.gender),
        phone: fillIfEmpty(keep.phone, merge.phone),
        postalCode: fillIfEmpty(keep.postalCode, merge.postalCode),
        address: fillIfEmpty(keep.address, merge.address),
        occupation: fillIfEmpty(keep.occupation, merge.occupation),
        acquisitionChannelId: fillIfEmpty(keep.acquisitionChannelId, merge.acquisitionChannelId),
        primaryStaffId: fillIfEmpty(keep.primaryStaffId, merge.primaryStaffId),
        rank: fillIfEmpty(keep.rank, merge.rank),
        medicalHistory: fillIfEmpty(keep.medicalHistory, merge.medicalHistory),
        familyData: fillIfEmpty(keep.familyData, merge.familyData),
        personalData: fillIfEmpty(keep.personalData, merge.personalData),
        manifestNeed: fillIfEmpty(keep.manifestNeed, merge.manifestNeed),
        deepNeed: fillIfEmpty(keep.deepNeed, merge.deepNeed),
        wants: fillIfEmpty(keep.wants, merge.wants),
        firstVisitDate:
          keep.firstVisitDate && merge.firstVisitDate
            ? keep.firstVisitDate < merge.firstVisitDate
              ? keep.firstVisitDate
              : merge.firstVisitDate
            : fillIfEmpty(keep.firstVisitDate, merge.firstVisitDate),
        initialVisitCount: keep.initialVisitCount + merge.initialVisitCount,
        referralCount: keep.referralCount + merge.referralCount,
        ...referralFillIn,
        ...appointmentFillIn,
      },
    });

    // lineUserId・externalCustomerNoは一意制約があるため、keep未設定・merge設定済みの場合のみ移す。
    // 先にmerge側をnullにしてから設定しないと一意制約に一時的に抵触する。
    if (!keep.lineUserId && merge.lineUserId) {
      await tx.client.update({ where: { id: mergeId }, data: { lineUserId: null } });
      await tx.client.update({ where: { id: keepId }, data: { lineUserId: merge.lineUserId } });
    }
    if (!keep.externalCustomerNo && merge.externalCustomerNo) {
      await tx.client.update({ where: { id: mergeId }, data: { externalCustomerNo: null } });
      await tx.client.update({ where: { id: keepId }, data: { externalCustomerNo: merge.externalCustomerNo } });
    }

    await tx.client.delete({ where: { id: mergeId } });
  }, { timeout: 20000 });

  redirect(`/clients/${keepId}`);
}
