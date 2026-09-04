"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ReassignmentInitiator, ReassignmentStatus } from "@/app/generated/prisma/client";

/** 担当変更を相談する(顧客詳細ページのボタン、または院長からの打診)。 */
export async function requestReassignment(clientId: string, formData: FormData) {
  const session = await auth();
  const requestedByStaffId = session?.user?.id;
  if (!requestedByStaffId) throw new Error("ログインが必要です");

  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    select: { primaryStaffId: true },
  });
  if (!client.primaryStaffId) throw new Error("この顧客には現在の主担当が設定されていません");

  const initiatedByRaw = String(formData.get("initiatedBy") || ReassignmentInitiator.STAFF_SELF);
  const initiatedBy = initiatedByRaw as ReassignmentInitiator;
  const note = String(formData.get("note") || "") || null;

  await prisma.reassignmentRequest.create({
    data: {
      clientId,
      currentStaffId: client.primaryStaffId,
      initiatedBy,
      requestedByStaffId,
      note,
    },
  });

  revalidatePath(`/clients/${clientId}`);
}

/**
 * 相談を確定・見送りする。「変更確定」の場合は Client.primaryStaffId と
 * ClientStaff を newStaffId へ自動反映する(2.6で確定した仕様)。
 */
export async function resolveReassignment(
  requestId: string,
  decision: "confirm" | "decline",
  formData: FormData
) {
  const request = await prisma.reassignmentRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { clientId: true },
  });

  if (decision === "decline") {
    await prisma.reassignmentRequest.update({
      where: { id: requestId },
      data: { status: ReassignmentStatus.DECLINED, resolvedAt: new Date() },
    });
    revalidatePath(`/clients/${request.clientId}`);
    return;
  }

  const newStaffId = String(formData.get("newStaffId") || "");
  if (!newStaffId) throw new Error("新しい担当を選択してください");
  const handoverNote = String(formData.get("handoverNote") || "") || null;

  await prisma.$transaction(async (tx) => {
    await tx.reassignmentRequest.update({
      where: { id: requestId },
      data: {
        status: ReassignmentStatus.CONFIRMED,
        newStaffId,
        handoverNote,
        resolvedAt: new Date(),
      },
    });

    await tx.client.update({ where: { id: request.clientId }, data: { primaryStaffId: newStaffId } });

    await tx.clientStaff.upsert({
      where: { clientId_staffId: { clientId: request.clientId, staffId: newStaffId } },
      update: {},
      create: { clientId: request.clientId, staffId: newStaffId },
    });
  });

  revalidatePath(`/clients/${request.clientId}`);
}
