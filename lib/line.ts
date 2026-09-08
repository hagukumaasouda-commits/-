// LINE公式アカウント Messaging API 経由のリマインド送信・友だち紐づけ(docs/line-friend-linking-spec-v2.md)。
// LINE_CHANNEL_ACCESS_TOKEN が未設定、または相手の lineUserId が未登録の場合は
// 何もせず理由を返す(呼び出し側でUIに理由を出す)。実際のトークンが用意でき次第、
// このまま動作する想定。

import crypto from "node:crypto";

const LINE_API_BASE = "https://api.line.me/v2/bot";
const LINE_PUSH_ENDPOINT = `${LINE_API_BASE}/message/push`;

/**
 * LINEプラットフォームからのWebhookリクエストであることを検証する。
 * x-line-signature は「チャネルシークレットをキーにしたHMAC-SHA256でリクエストボディ全体を
 * 署名し、Base64化した値」。呼び出し側は request.text() で取得した生の文字列をそのまま渡すこと
 * (JSON.parse後の再シリアライズはバイト列が変わるため検証に使えない)。
 */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export type LineApiResult<T> = { ok: true; data: T } | { ok: false; reason: "no_token" | "api_error"; detail?: string };

/**
 * 友だち追加済み全員のuserIdを取得する(GET /v2/bot/followers/ids、ページネーションを追って全件回収)。
 * 注意: LINEのiOS/Android版アプリのユーザーのみが対象で、LINEデスクトップ版・LINE公式アカウント
 * 管理画面からのみ操作しているユーザーは含まれない(LINE公式ドキュメントに明記された制限)。
 */
export async function getLineFollowerIds(): Promise<LineApiResult<string[]>> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, reason: "no_token" };

  const userIds: string[] = [];
  let start: string | undefined;
  do {
    const url = new URL(`${LINE_API_BASE}/followers/ids`);
    url.searchParams.set("limit", "1000");
    if (start) url.searchParams.set("start", start);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const detail = await res.text().catch(() => undefined);
      return { ok: false, reason: "api_error", detail };
    }
    const body = (await res.json()) as { userIds: string[]; next?: string };
    userIds.push(...body.userIds);
    start = body.next;
  } while (start);

  return { ok: true, data: userIds };
}

export type LineProfile = { userId: string; displayName: string; pictureUrl?: string; statusMessage?: string };

/** GET /v2/bot/profile/{userId}。ブロック済み等で取得できない場合はnullを返す(呼び出し側で表示名なし扱い)。 */
export async function getLineProfile(userId: string): Promise<LineProfile | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;

  const res = await fetch(`${LINE_API_BASE}/profile/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as LineProfile;
}

export type SendLineResult =
  | { ok: true }
  | { ok: false; reason: "no_token" | "no_line_user_id" | "api_error"; detail?: string };

export async function sendLineTextMessage(lineUserId: string | null, text: string): Promise<SendLineResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, reason: "no_token" };
  if (!lineUserId) return { ok: false, reason: "no_line_user_id" };

  const res = await fetch(LINE_PUSH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => undefined);
    return { ok: false, reason: "api_error", detail };
  }
  return { ok: true };
}

export function buildReservationReminderMessage(clientName: string, reservedAt: Date): string {
  const dateStr = `${reservedAt.getMonth() + 1}月${reservedAt.getDate()}日 ${reservedAt.getHours()}時${String(
    reservedAt.getMinutes()
  ).padStart(2, "0")}分`;
  return `${clientName}様\n\nはぐくまです。ご予約のリマインドです。\n\n${dateStr}〜のご予約をお待ちしております。\n\n変更・キャンセルの際はお気軽にご連絡ください。`;
}
