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

  const confirmedAtRaw = String(formData.get("confirmedAt") || "");
  const confirmedAt = confirmedAtRaw ? new Date(confirmedAtRaw) : new Date();

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

/**
 * 離脱理由・補足メモ・離脱日の入力ミスを修正する。離脱日(confirmedAt)を変更した場合、
 * フォローアップチェックポイントの予定日もその新しい離脱日を起点に再計算する
 * (過去データの入力時に当月扱いになってしまう問題への対応)。対応済み(CONTACTED)の
 * チェックポイントも予定日自体は再計算するが、対応記録(contactedAt等)はそのまま残す。
 */
export async function updateDepartureRecord(departureRecordId: string, formData: FormData) {
  const reasonRaw = String(formData.get("reason") || "");
  const reason = reasonRaw ? (reasonRaw as DepartureReason) : null;
  const reasonNote = String(formData.get("reasonNote") || "") || null;
  const confirmedAtRaw = String(formData.get("confirmedAt") || "");

  const clientId = await prisma.$transaction(async (tx) => {
    const data: { reason: DepartureReason | null; reasonNote: string | null; confirmedAt?: Date } = { reason, reasonNote };
    if (confirmedAtRaw) data.confirmedAt = new Date(confirmedAtRaw);

    const record = await tx.departureRecord.update({
      where: { id: departureRecordId },
      data,
      select: { clientId: true, confirmedAt: true },
    });

    if (confirmedAtRaw) {
      for (const stage of Object.keys(CHECKPOINT_OFFSET_DAYS) as CheckpointStage[]) {
        await tx.followupCheckpoint.updateMany({
          where: { departureRecordId, stage },
          data: { scheduledDate: new Date(record.confirmedAt.getTime() + CHECKPOINT_OFFSET_DAYS[stage] * DAY_MS) },
        });
      }
    }

    return record.clientId;
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
