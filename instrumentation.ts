// Vercelでは環境変数名 "TZ" が予約済みで設定できないため、"APP_TZ" として
// 受け取り、サーバー起動時に process.env.TZ へ反映する(Node/Date/Intl が
// タイムゾーン判定に使うのは TZ という名前の変数のため)。
export function register() {
  if (process.env.APP_TZ) {
    process.env.TZ = process.env.APP_TZ;
  }
}
