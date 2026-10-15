"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { verifyLiffIdToken } from "@/lib/line";
import { INTAKE_QUESTIONS } from "@/lib/intake-questions";

export type SubmitIntakeResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * LIFF問診フォーム(app/intake)からの送信を受ける。ログイン不要(患者自身がLINEから送信するため)。
 * idTokenが付いている場合はLINE側で検証し、既にLineFriendとして紐づけ済みのlineUserIdであれば
 * 作成と同時にそのClientへ自動で紐づける(患者側の追加操作は不要)。未紐づけの場合は
 * スタッフが来院時(新規顧客登録 or /intake-responses)に手動で紐づける。
 *
 * LINEを持たない患者の分は、スタッフが同じ/intakeページをログイン状態で開いて代筆する
 * (idTokenが付かないため、lineUserId=nullの未紐づけ回答として作成される。/clients/new
 * へそのまま進めるよう、作成したIDを返す)。
 */
export async function submitIntakeResponse(formData: FormData): Promise<SubmitIntakeResult> {
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "お名前を入力してください" };

  const idToken = String(formData.get("idToken") || "");
  let lineUserId: string | null = null;
  if (idToken) {
    const verified = await verifyLiffIdToken(idToken);
    lineUserId = verified?.userId ?? null;
  }

  const answers: Record<string, string | string[]> = {};
  for (const q of INTAKE_QUESTIONS) {
    if (q.type === "checkbox") {
      const values = formData.getAll(q.key).map(String);
      if (values.length > 0) answers[q.key] = values;
    } else {
      const value = String(formData.get(q.key) || "").trim();
      if (value) answers[q.key] = value;
    }
    if (q.otherOption) {
      const otherValue = String(formData.get(`${q.key}Other`) || "").trim();
      if (otherValue) answers[`${q.key}Other`] = otherValue;
    }
  }

  const linkedClient = lineUserId
    ? await prisma.lineFriend.findUnique({ where: { lineUserId }, select: { linkedClientId: true } })
    : null;

  const created = await prisma.intakeResponse.create({
    data: {
      lineUserId,
      name,
      kana: String(formData.get("kana") || "").trim() || null,
      phone: String(formData.get("phone") || "").trim() || null,
      answers,
      linkedClientId: linkedClient?.linkedClientId ?? null,
      linkedAt: linkedClient?.linkedClientId ? new Date() : null,
    },
  });

  if (linkedClient?.linkedClientId) revalidatePath(`/clients/${linkedClient.linkedClientId}`);
  revalidatePath("/intake-responses");

  return { ok: true, id: created.id };
}

/** スタッフが未紐づけの問診回答を既存顧客に手動で紐づける(/intake-responses)。LINE友だち紐づけと同じclientQuery方式。 */
export async function linkIntakeResponseToClient(intakeResponseId: string, formData: FormData) {
  const session = await auth();
  const staffId = session?.user?.id;
  if (!staffId) throw new Error("ログインが必要です");

  const query = String(formData.get("clientQuery") || "");
  const match = query.match(/#([a-z0-9]+)\s*$/i);
  const clientId = match ? match[1] : null;
  if (!clientId) throw new Error("顧客を選択してください");

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new Error("顧客が見つかりません");

  await prisma.intakeResponse.update({
    where: { id: intakeResponseId },
    data: { linkedClientId: clientId, linkedAt: new Date(), linkedByStaffId: staffId },
  });

  revalidatePath("/intake-responses");
  revalidatePath(`/clients/${clientId}`);
}
