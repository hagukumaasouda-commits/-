import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLineSignature, getLineProfile } from "@/lib/line";

// LINE公式アカウントのWebhook(docs/line-friend-linking-spec-v2.md)。
// このアプリには middleware.ts が無く、ページ単位で auth() を呼ぶ方式のため、
// このAPI Routeは未認証のままLINEプラットフォームから直接呼ばれる想定。
// 署名検証(verifyLineSignature)が唯一の防御なので、必ず先に通す。

export const runtime = "nodejs";

type LineWebhookEvent = {
  type: string;
  source?: { type: string; userId?: string };
};

type LineWebhookBody = { destination?: string; events?: LineWebhookEvent[] };

export async function POST(request: NextRequest) {
  // 署名検証には生のリクエストボディ(バイト列)が必要。request.json() で先にパースすると
  // 再シリアライズでバイト列が変わり検証に失敗するため、必ず text() で取得してから検証する。
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  for (const event of body.events ?? []) {
    const userId = event.source?.type === "user" ? event.source.userId : undefined;
    if (!userId) continue;

    try {
      if (event.type === "follow") {
        const profile = await getLineProfile(userId);
        await prisma.lineFriend.upsert({
          where: { lineUserId: userId },
          update: { displayName: profile?.displayName, unfollowedAt: null },
          create: { lineUserId: userId, displayName: profile?.displayName ?? null },
        });
      } else if (event.type === "unfollow") {
        await prisma.lineFriend.updateMany({
          where: { lineUserId: userId },
          data: { unfollowedAt: new Date() },
        });
      } else {
        // follow/unfollow以外のイベント(メッセージ受信等)でも、まだ記録が無ければ保険として作成する。
        // LINEデスクトップ版のみ利用している友だちは followers/ids 一括取得に載らないため、
        // 何かしらのイベントが届いた時点で拾えるようにする保険(仕様書4節)。
        const existing = await prisma.lineFriend.findUnique({ where: { lineUserId: userId } });
        if (!existing) {
          const profile = await getLineProfile(userId);
          await prisma.lineFriend.create({
            data: { lineUserId: userId, displayName: profile?.displayName ?? null },
          });
        }
      }
    } catch (err) {
      // 1件の処理失敗で他のイベントや200応答をブロックしない(LINE側の再送ループを避ける)。
      console.error("LINE webhook event processing failed:", event.type, err);
    }
  }

  return NextResponse.json({ ok: true });
}
