# 写真アップロード失敗の修正 仕様書 v2

## 症状・原因

本番(Vercel)でスマホから写真をアップロードすると「This page couldn't load / A server error occurred」という汎用エラーになり、アップロードできなかった。

原因はVercelのプラットフォーム自体の制約: サーバー関数(Server Actions含む)へのリクエストボディには約4.5MBの上限があり、これは`next.config.ts`の`experimental.serverActions.bodySizeLimit`(15mbに設定済み)では回避できない。スマホカメラの写真はこの4.5MBを超えることが多く、ローカル開発環境ではこの上限が存在しないため、本番でだけ再現する問題だった。

## 対応

画像本体をアプリのサーバー関数経由で送るのをやめ、**ブラウザからSupabase Storageへ直接アップロードする**方式に変更した(Supabase Storageの「署名付きアップロードURL」機能を使用)。

1. `requestClientPhotoUpload(clientId, fileName)`(サーバー側): `service_role`鍵で署名付きアップロードURL(token)を発行するだけ。画像本体は一切経由しない
2. ブラウザ側(`app/clients/[id]/client-photo-upload-form.tsx`、新設のクライアントコンポーネント): `@supabase/supabase-js`を使い、発行されたtokenでSupabase Storageへ画像を直接PUTする。この通信はVercelを経由しないため、ボディサイズ上限の制約を受けない
3. `finalizeClientPhoto(clientId, formData)`(サーバー側): アップロード完了後、`storagePath`等の小さなデータだけを受け取ってDBレコード(`ClientPhoto`)を作成する

ブラウザから直接Supabase Storageにアクセスするため、新たに`NEXT_PUBLIC_SUPABASE_URL`・`NEXT_PUBLIC_SUPABASE_ANON_KEY`(`anon`キー。公開して問題ない値)が必要になった。画像の削除(`deleteClientPhoto`)は元々小さいリクエストのため、従来どおりサーバー側(`service_role`鍵)で行う。

## ストレージ容量について

写真は蓄積されていくため、Supabaseの契約プランのストレージ容量・転送量には将来的に注意が必要(Freeプランは1GB、Proプランは100GB込みでそれ以降は従量課金)。1枚あたり数MB程度と見積もると、数百〜数千枚単位であれば当面問題にならない規模感だが、利用量が増えてきたらSupabaseダッシュボードの使用量を確認し、必要に応じてプラン変更や画像圧縮の導入(今回のスコープ外)を検討する。
