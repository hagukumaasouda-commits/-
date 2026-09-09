"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { VisitInterval, HealthHappinessScore, ClientRank, MenuPlan } from "@/app/generated/prisma/client";
import { LIFESTYLE_SUPPORT_ITEMS, TREATMENT_MODALITY_ITEMS } from "@/lib/tags";

export async function createVisit(clientId: string, formData: FormData) {
  const staffId = String(formData.get("staffId") || "");
  const visitDateRaw = String(formData.get("visitDate") || "");
  if (!staffId || !visitDateRaw) throw new Error("担当スタッフと来院日は必須です");

  const menu = String(formData.get("menu") || "") || null;
  const evaluation = String(formData.get("evaluation") || "") || null;
  const changeFromLast = String(formData.get("changeFromLast") || "") || null;
  const nextCheck = String(formData.get("nextCheck") || "") || null;
  const nextRequired = String(formData.get("nextRequired") || "") || null;
  const clientVoice = String(formData.get("clientVoice") || "") || null;
  const chiefComplaintTags = formData.getAll("chiefComplaintTags").map(String);
  const bodyPartTags = formData.getAll("bodyPartTags").map(String);
  const requiredVisitIntervalRaw = String(formData.get("requiredVisitInterval") || "");
  const requiredVisitInterval = requiredVisitIntervalRaw ? (requiredVisitIntervalRaw as VisitInterval) : null;
  const healthPracticeNote = String(formData.get("healthPracticeNote") || "") || null;
  const checkedLifestyleItems = new Set(formData.getAll("lifestyleSupportStatus").map(String));
  const lifestyleSupportStatus = Object.fromEntries(
    LIFESTYLE_SUPPORT_ITEMS.map((item) => [item, checkedLifestyleItems.has(item)])
  );
  const healthHappinessScoreRaw = String(formData.get("healthHappinessScore") || "");
  const healthHappinessScore = healthHappinessScoreRaw ? (healthHappinessScoreRaw as HealthHappinessScore) : null;

  const testimonialObtained = formData.get("testimonialObtained") === "true";
  const testimonialObtainedDateRaw = String(formData.get("testimonialObtainedDate") || "");
  const testimonialObtainedDate =
    testimonialObtained && testimonialObtainedDateRaw ? new Date(testimonialObtainedDateRaw) : null;

  const referralGiven = formData.get("referralGiven") === "true";
  const referralCountRaw = String(formData.get("referralCount") || "");
  const referralCount = referralGiven ? Number(referralCountRaw) || 1 : null;

  const rankRaw = String(formData.get("rank") || "");
  const rank = rankRaw ? (rankRaw as ClientRank) : null;

  const menuPlanRaw = String(formData.get("menuPlan") || "");
  const menuPlan = menuPlanRaw ? (menuPlanRaw as MenuPlan) : null;
  const checkedModalities = new Set(formData.getAll("treatmentModalities").map(String));
  const treatmentModalities = Object.fromEntries(
    TREATMENT_MODALITY_ITEMS.map((item) => [item, checkedModalities.has(item)])
  );

  const isManualReturnFlag = formData.get("isManualReturnFlag") === "true";

  const existingCount = await prisma.visit.count({ where: { clientId } });
  const visitNo = existingCount + 1;

  const visit = await prisma.visit.create({
    data: {
      clientId,
      staffId,
      visitDate: new Date(visitDateRaw),
      visitNo,
      menu,
    },
  });

  await prisma.chartRecord.create({
    data: {
      visitId: visit.id,
      chiefComplaintTags,
      bodyPartTags,
      evaluation,
      changeFromLast,
      nextCheck,
      nextRequired,
      clientVoice,
      requiredVisitInterval,
      lifestyleSupportStatus,
      healthPracticeNote,
      healthHappinessScore,
      testimonialObtained,
      testimonialObtainedDate,
      referralGiven,
      referralCount,
      menuPlan,
      treatmentModalities,
      isManualReturnFlag,
    },
  });

  await prisma.client.update({
    where: { id: clientId },
    data: {
      isActive: true,
      rank,
      ...(visitNo === 1 ? { firstVisitDate: new Date(visitDateRaw) } : {}),
      ...(referralGiven ? { referralCount: { increment: referralCount ?? 1 } } : {}),
    },
  });

  redirect(`/clients/${clientId}`);
}

/**
 * 保存済みの来院記録を修正する(入力途中で誤って保存してしまった場合の訂正用)。
 * ランクはClientの現在値を単純に上書きする単一フィールドのため、最新の来院記録を
 * 編集した場合のみClient.rankに反映する(古い来院記録の編集で最新のランクを
 * 巻き戻してしまわないようにするため。ページ側でも最新以外はランク欄自体を隠す)。
 * 紹介人数はClient.referralCountの増分として記録されているため、編集前後の差分だけ反映する。
 */
export async function updateVisit(visitId: string, formData: FormData) {
  const existingVisit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      clientId: true,
      chartRecord: { select: { referralGiven: true, referralCount: true } },
    },
  });
  if (!existingVisit) throw new Error("来院記録が見つかりません");
  const { clientId } = existingVisit;

  const staffId = String(formData.get("staffId") || "");
  const visitDateRaw = String(formData.get("visitDate") || "");
  if (!staffId || !visitDateRaw) throw new Error("担当スタッフと来院日は必須です");

  const menu = String(formData.get("menu") || "") || null;
  const evaluation = String(formData.get("evaluation") || "") || null;
  const changeFromLast = String(formData.get("changeFromLast") || "") || null;
  const nextCheck = String(formData.get("nextCheck") || "") || null;
  const nextRequired = String(formData.get("nextRequired") || "") || null;
  const clientVoice = String(formData.get("clientVoice") || "") || null;
  const chiefComplaintTags = formData.getAll("chiefComplaintTags").map(String);
  const bodyPartTags = formData.getAll("bodyPartTags").map(String);
  const requiredVisitIntervalRaw = String(formData.get("requiredVisitInterval") || "");
  const requiredVisitInterval = requiredVisitIntervalRaw ? (requiredVisitIntervalRaw as VisitInterval) : null;
  const healthPracticeNote = String(formData.get("healthPracticeNote") || "") || null;
  const checkedLifestyleItems = new Set(formData.getAll("lifestyleSupportStatus").map(String));
  const lifestyleSupportStatus = Object.fromEntries(
    LIFESTYLE_SUPPORT_ITEMS.map((item) => [item, checkedLifestyleItems.has(item)])
  );
  const healthHappinessScoreRaw = String(formData.get("healthHappinessScore") || "");
  const healthHappinessScore = healthHappinessScoreRaw ? (healthHappinessScoreRaw as HealthHappinessScore) : null;

  const testimonialObtained = formData.get("testimonialObtained") === "true";
  const testimonialObtainedDateRaw = String(formData.get("testimonialObtainedDate") || "");
  const testimonialObtainedDate =
    testimonialObtained && testimonialObtainedDateRaw ? new Date(testimonialObtainedDateRaw) : null;

  const referralGiven = formData.get("referralGiven") === "true";
  const referralCountRaw = String(formData.get("referralCount") || "");
  const referralCount = referralGiven ? Number(referralCountRaw) || 1 : null;

  const rankRaw = String(formData.get("rank") || "");
  const rank = rankRaw ? (rankRaw as ClientRank) : null;

  const menuPlanRaw = String(formData.get("menuPlan") || "");
  const menuPlan = menuPlanRaw ? (menuPlanRaw as MenuPlan) : null;
  const checkedModalities = new Set(formData.getAll("treatmentModalities").map(String));
  const treatmentModalities = Object.fromEntries(
    TREATMENT_MODALITY_ITEMS.map((item) => [item, checkedModalities.has(item)])
  );

  const isManualReturnFlag = formData.get("isManualReturnFlag") === "true";

  await prisma.visit.update({
    where: { id: visitId },
    data: { staffId, visitDate: new Date(visitDateRaw), menu },
  });

  await prisma.chartRecord.update({
    where: { visitId },
    data: {
      chiefComplaintTags,
      bodyPartTags,
      evaluation,
      changeFromLast,
      nextCheck,
      nextRequired,
      clientVoice,
      requiredVisitInterval,
      lifestyleSupportStatus,
      healthPracticeNote,
      healthHappinessScore,
      testimonialObtained,
      testimonialObtainedDate,
      referralGiven,
      referralCount,
      menuPlan,
      treatmentModalities,
      isManualReturnFlag,
    },
  });

  const latestVisit = await prisma.visit.findFirst({
    where: { clientId },
    orderBy: { visitNo: "desc" },
    select: { id: true },
  });
  const isLatestVisit = latestVisit?.id === visitId;

  const oldReferral = existingVisit.chartRecord?.referralGiven ? existingVisit.chartRecord.referralCount ?? 1 : 0;
  const newReferral = referralGiven ? referralCount ?? 1 : 0;
  const referralCountDelta = newReferral - oldReferral;

  await prisma.client.update({
    where: { id: clientId },
    data: {
      ...(isLatestVisit ? { rank } : {}),
      ...(referralCountDelta !== 0 ? { referralCount: { increment: referralCountDelta } } : {}),
    },
  });

  redirect(`/clients/${clientId}`);
}

/**
 * 誤って同じ日に二重入力してしまった来院記録を削除する。
 * ランクはClientの現在値のみを保持し履歴を持たないため、削除しても復元できない
 * (updateVisitと同じ制約)。紹介人数は増分の取り消しとしてClient.referralCountに反映する。
 * 後続の来院のvisitNoを詰め、初回来院(visitNo===1)を削除した場合はfirstVisitDateを
 * 繰り上がった新しい初回来院の日付に更新する(残り0件ならnullに戻す)。
 */
export async function deleteVisit(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      clientId: true,
      visitNo: true,
      chartRecord: { select: { referralGiven: true, referralCount: true } },
    },
  });
  if (!visit) throw new Error("来院記録が見つかりません");
  const { clientId, visitNo } = visit;
  const referralCountDelta = visit.chartRecord?.referralGiven ? -(visit.chartRecord.referralCount ?? 1) : 0;

  await prisma.$transaction(async (tx) => {
    const checks = await tx.awarenessCheck.findMany({ where: { visitId }, select: { id: true } });
    const checkIds = checks.map((c) => c.id);
    if (checkIds.length > 0) {
      await tx.awarenessDialogue.deleteMany({ where: { awarenessCheckId: { in: checkIds } } });
      await tx.awarenessCheck.deleteMany({ where: { id: { in: checkIds } } });
    }
    await tx.staffMindsetCheck.deleteMany({ where: { visitId } });
    // プリカ取引は実際の入出金記録なので削除せず、この来院への参照だけを外す
    await tx.prepaidTransaction.updateMany({ where: { visitId }, data: { visitId: null } });
    await tx.chartRecord.deleteMany({ where: { visitId } });
    await tx.visit.delete({ where: { id: visitId } });
    await tx.visit.updateMany({
      where: { clientId, visitNo: { gt: visitNo } },
      data: { visitNo: { decrement: 1 } },
    });

    if (referralCountDelta !== 0) {
      await tx.client.update({ where: { id: clientId }, data: { referralCount: { increment: referralCountDelta } } });
    }

    if (visitNo === 1) {
      const newFirstVisit = await tx.visit.findFirst({ where: { clientId }, orderBy: { visitNo: "asc" } });
      await tx.client.update({ where: { id: clientId }, data: { firstVisitDate: newFirstVisit?.visitDate ?? null } });
    }
  });

  revalidatePath(`/clients/${clientId}`);
}
