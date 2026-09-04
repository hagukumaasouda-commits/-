"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { CheckpointStage, DepartureReason, FollowupStatus, ContactMethod, FollowupResponse } from "@/app/generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

/** DepartureRecord 作成時に自動生成する5件のチェックポイント(2.4)。 */
const CHECKPOINT_OFFSET_DAYS: Record<CheckpointStage, number> = {
  WEEK3: 21,
  WEEK6: 42,
  MONTH3: 90,
  MONTH6: 180,
  YEAR1: 365,
};

/** 離脱を記録する。5件のフォローアップチェックポイントを自動生成し、Client.isActive を false にする。 */
export async function confirmDeparture(clientId: string, formData: FormData) {
  const session = await auth();
  const confirmedById = session?.user?.id;
  if (!confirmedById) throw new Error("ログインが必要です");

  const reasonRaw = String(formData.get("reason") || "");
  const reason = reasonRaw ? (reasonRaw as DepartureReason) : null;
  const reasonNote = String(formData.get("reasonNote") || "") || null;
  const triggeredByCancellation = formData.get("triggeredByCancellation") === "true";

  const confirmedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const departure = await tx.departureRecord.create({
      data: { clientId, confirmedById, confirmedAt, reason, reasonNote, triggeredByCancellation },
    });

    await tx.followupCheckpoint.createMany({
      data: (Object.keys(CHECKPOINT_OFFSET_DAYS) as CheckpointStage[]).map((stage) => ({
        departureRecordId: departure.id,
        stage,
        scheduledDate: new Date(confirmedAt.getTime() + CHECKPOINT_OFFSET_DAYS[stage] * DAY_MS),
      })),
    });

    await tx.client.update({ where: { id: clientId }, data: { isActive: false } });
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/followups");
}

/** フォローアップチェックポイントへの対応(連絡方法・反応)を記録する。 */
export async function recordFollowupContact(checkpointId: string, formData: FormData) {
  const session = await auth();
  const contactedById = session?.user?.id;
  if (!contactedById) throw new Error("ログインが必要です");

  const contactMethod = String(formData.get("contactMethod") || "") as ContactMethod;
  const response = String(formData.get("response") || "") as FollowupResponse;
  const note = String(formData.get("note") || "") || null;

  const checkpoint = await prisma.followupCheckpoint.update({
    where: { id: checkpointId },
    data: {
      status: FollowupStatus.CONTACTED,
      contactMethod,
      response,
      contactedById,
      contactedAt: new Date(),
      note,
    },
    include: { departureRecord: { select: { clientId: true } } },
  });

  revalidatePath(`/clients/${checkpoint.departureRecord.clientId}`);
  revalidatePath("/followups");
}
