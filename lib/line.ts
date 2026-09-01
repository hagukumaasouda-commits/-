// LINE公式アカウント Messaging API 経由のリマインド送信。
// LINE_CHANNEL_ACCESS_TOKEN が未設定、または相手の lineUserId が未登録の場合は
// 何もせず理由を返す(呼び出し側でUIに理由を出す)。実際のトークンが用意でき次第、
// このまま動作する想定。

const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";

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
