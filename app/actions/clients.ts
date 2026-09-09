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
