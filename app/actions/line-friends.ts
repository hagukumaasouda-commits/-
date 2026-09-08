"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getLineFollowerIds, getLineProfile } from "@/lib/line";

/** 「氏名 #id」形式の候補から選択されたIDを取り出す(app/actions/clients.tsのparseReferralSourceと同じ方式)。 */
export async function linkLineFriend(lineFriendId: string, formData: FormData) {
  const session = await auth();
  const staffId = session?.user?.id;
  if (!staffId) throw new Error("ログインが必要です");

  const query = String(formData.get("clientQuery") || "");
  const match = query.match(/#([a-z0-9]+)\s*$/i);
  const clientId = match ? match[1] : null;
  if (!clientId) throw new Error("顧客を選択してください");

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new Error("顧客が見つかりません");

  const friend = await prisma.lineFriend.findUniqueOrThrow({ where: { id: lineFriendId } });

  await prisma.$transaction([
    // この顧客が既に別の友だちにリンクされていた場合、先にそちらのリンクを解除する
    // (linkedClientIdはユニーク制約のため、1顧客につき常に1件のリンクに保つ)
    prisma.lineFriend.updateMany({
      where: { linkedClientId: clientId, id: { not: lineFriendId } },
      data: { linkedClientId: null, linkedAt: null, linkedByStaffId: null },
    }),
    prisma.lineFriend.update({
      where: { id: lineFriendId },
      data: { linkedClientId: clientId, linkedAt: new Date(), linkedByStaffId: staffId },
    }),
    prisma.client.update({ where: { id: clientId }, data: { lineUserId: friend.lineUserId } }),
  ]);

  revalidatePath("/line-friends");
}

export type BackfillResult =
  | { status: "ok"; created: number; total: number }
  | { status: "no_token" }
  | { status: "error"; detail?: string };

/**
 * Webhook実装前から友だち追加済みだったユーザーを遡って登録する(仕様書4節)。
 * GET /v2/bot/followers/ids で全userIdを取得し、まだ記録が無いものだけプロフィール取得して作成する。
 * LINEデスクトップ版のみ利用の友だちはこのAPIに載らないため、その分はWebhook側の保険
 * (follow/unfollow以外のイベントでも記録する処理)でカバーする。
 */
export async function backfillLineFriends(
  _prevState: BackfillResult | null,
  _formData: FormData
): Promise<BackfillResult> {
  const result = await getLineFollowerIds();
  if (!result.ok) {
    if (result.reason === "no_token") return { status: "no_token" };
    return { status: "error", detail: result.detail };
  }

  const existingIds = new Set(
    (await prisma.lineFriend.findMany({ select: { lineUserId: true } })).map((f) => f.lineUserId)
  );
  const newIds = result.data.filter((id) => !existingIds.has(id));

  let created = 0;
  for (const userId of newIds) {
    const profile = await getLineProfile(userId);
    await prisma.lineFriend.create({
      data: { lineUserId: userId, displayName: profile?.displayName ?? null },
    });
    created++;
  }

  revalidatePath("/line-friends");
  return { status: "ok", created, total: result.data.length };
}
