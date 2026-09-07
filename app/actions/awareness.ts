"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { saveOfficeCheck } from "@/lib/awareness/office";
import { saveAiInsights, type AiInsightResult } from "@/lib/awareness/ai-insight";
import { CheckStatus } from "@/app/generated/prisma/client";
import { auth } from "@/auth";

export type AwarenessCheckState = { aiStatus: AiInsightResult["status"] | null };

// 「気づきチェック」ボタンから呼ばれるサーバーアクション(useActionStateで結果を受け取るシグネチャ)。
// 事務チェック(ルールベース)とAI気づき(生成AI)を両方走らせ、
// awareness_checks に保存するだけで、顧客のステータス等は一切変更しない。
// AI側の実行結果(ok/error/not_configured)を呼び出し元に返し、失敗時にUIへ表示できるようにする。
export async function runAwarenessCheck(
  visitId: string,
  _prevState: AwarenessCheckState,
  _formData: FormData
): Promise<AwarenessCheckState> {
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    select: { clientId: true },
  });

  const [, aiResult] = await Promise.all([saveOfficeCheck(visitId), saveAiInsights(visitId, visit.clientId)]);

  revalidatePath(`/clients/${visit.clientId}`);
  return { aiStatus: aiResult.status };
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
