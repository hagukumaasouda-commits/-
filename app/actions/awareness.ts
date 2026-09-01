"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { saveOfficeCheck } from "@/lib/awareness/office";
import { saveAiInsights } from "@/lib/awareness/ai-insight";
import { CheckStatus } from "@/app/generated/prisma/client";
import { auth } from "@/auth";

// 「気づきチェック」ボタンから呼ばれるサーバーアクション。
// 事務チェック(ルールベース)とAI気づき(生成AI)を両方走らせ、
// awareness_checks に保存するだけで、顧客のステータス等は一切変更しない。
export async function runAwarenessCheck(visitId: string): Promise<void> {
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    select: { clientId: true },
  });

  await Promise.all([saveOfficeCheck(visitId), saveAiInsights(visitId, visit.clientId)]);

  revalidatePath(`/clients/${visit.clientId}`);
}

export async function submitDialogue(formData: FormData) {
  const session = await auth();
  const authorStaffId = session?.user?.id;
  if (!authorStaffId) return;

  const awarenessCheckId = String(formData.get("awarenessCheckId") || "");
  const comment = String(formData.get("comment") || "");
  if (!awarenessCheckId) return;
  await postDialogue(awarenessCheckId, authorStaffId, comment);
}

export async function postDialogue(awarenessCheckId: string, authorStaffId: string, comment: string) {
  if (!comment.trim()) return;

  const check = await prisma.awarenessCheck.findUniqueOrThrow({
    where: { id: awarenessCheckId },
    include: { visit: { select: { clientId: true } } },
  });

  await prisma.awarenessDialogue.create({
    data: { awarenessCheckId, authorStaffId, comment: comment.trim() },
  });

  if (check.status === CheckStatus.OPEN) {
    await prisma.awarenessCheck.update({
      where: { id: awarenessCheckId },
      data: { status: CheckStatus.DISCUSSED },
    });
  }

  revalidatePath(`/clients/${check.visit.clientId}`);
}

export async function resolveAwarenessCheck(awarenessCheckId: string) {
  const check = await prisma.awarenessCheck.update({
    where: { id: awarenessCheckId },
    data: { status: CheckStatus.RESOLVED },
    include: { visit: { select: { clientId: true } } },
  });
  revalidatePath(`/clients/${check.visit.clientId}`);
}
