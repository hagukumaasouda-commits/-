"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { VisitInterval } from "@/app/generated/prisma/client";
import { LIFESTYLE_SUPPORT_ITEMS } from "@/lib/tags";

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
    },
  });

  if (visitNo === 1) {
    await prisma.client.update({
      where: { id: clientId },
      data: { firstVisitDate: new Date(visitDateRaw), isActive: true },
    });
  } else {
    await prisma.client.update({ where: { id: clientId }, data: { isActive: true } });
  }

  redirect(`/clients/${clientId}`);
}
