# LINE事前問診フォーム 仕様書 v2

## 背景

これまでGoogleフォーム(【はぐくま】お身体の健康状態に関する事前問診票)で運用していた問診票を、来院前にLINEから記入できるLIFF(LINE Front-end Framework)ページに置き換え、回答をそのまま顧客管理に統合する。目的は来院時の記入時間短縮。

## 全体構成

- `lib/intake-questions.ts`: 質問項目(全28問、Googleフォームの内容をそのまま踏襲)の唯一の情報源。LIFF入力フォームとスタッフ向け表示の両方がここから生成する
- `IntakeResponse`テーブル: 1回答=1行。氏名・フリガナ・電話番号は一覧表示・突合用に複製して持つが、本体は`answers`(Json、質問keyごとの回答)にそのまま保存する
- `app/intake`(`/intake`): 患者がLINEから開く公開ページ(ログイン不要。`proxy.ts`で認証対象から除外)。`@line/liff`でLIFF初期化し、ログイン済みならIDトークンを取得してフォームに添える
- `app/actions/intake.ts`の`submitIntakeResponse`: IDトークンをLINE側のverifyエンドポイントで検証(`lib/line.ts`の`verifyLiffIdToken`、`LIFF_CHANNEL_ID`で`aud`を照合)し、本物の`lineUserId`を確定させてから保存する。クライアントが申告したuserIdをそのまま信用すると、他人のuserIdを騙って別人の顧客情報に回答を紐づけられてしまうため、必ずサーバー側で検証する
- **LIFFの作成先について**: LINEの仕様変更により、既存のMessaging APIチャネルに直接LIFFを追加することができなくなったため、同じプロバイダー配下に新規の「LINEログインチャネル」を作成し、そちらにLIFFアプリを追加する運用にしている。`LIFF_CHANNEL_ID`は、このLINEログインチャネル自身のチャネルID(Messaging APIチャネルのIDではない)。LINEのユーザーID(`sub`)は同一プロバイダー内の全チャネルで共通のため、同じプロバイダー配下に作っている限り`verifyLiffIdToken`が返す`lineUserId`は、Webhookで記録している`LineFriend.lineUserId`とそのまま一致し、突合処理に影響はない(**別プロバイダーで作成した場合はユーザーIDが一致せず、自動突合だけが静かに機能しなくなる**ため要注意)
- 突合: 送信時点でその`lineUserId`が既に`LineFriend.linkedClientId`で顧客に紐づいている場合は、作成と同時に自動でその顧客へ紐づける。未紐づけの場合は`/intake-responses`(スタッフ向け、ナビに追加)で一覧表示され、新規顧客登録時に読み込む(`/clients/new?intakeResponseId=...`で該当項目をプリフィルし、登録と同時に紐づける)か、既存顧客に手動で紐づけられる

## フィールドのマッピング方針

個人情報(氏名・フリガナ・生年月日・性別・電話番号・郵便番号・住所・職業)と来店きっかけは、`Client`の対応する既存カラムにそのままプリフィルする(入力の手間を省く主目的のため)。それ以外(お悩み・お腹や血流のサイン・妊娠出産・睡眠・飲み物・食事・既往・現在の治療等)は、件数が多く表記の揺れがあるため、既存の`medicalHistory`・`personalData`・`chiefComplaintTags`等へは自動転記せず、`IntakeResponse.answers`をそのままの文言で保持し、顧客詳細ページ・新規登録ページの折りたたみセクションでスタッフが参照できるようにするに留める(誤った自動マッピングで医療情報を書き換えるリスクを避けるため)。

- 来店きっかけ: `AcquisitionChannel`マスタに無かった3件(自宅や職場の近く・神経整体のSNS・動画・チラシ)を追加した(`prisma/seed.ts`・`prisma/seed-production.ts`)。「ご家族・ご友人からのご紹介」は既存の「ご紹介」チャネルに別名として突合する
- 「ご紹介」の紹介者名の自由記述は、紹介元(誰の紹介か)欄の近くに参考表示するのみで、既存顧客への自動突合は行わない(表記ゆれでの誤爆を避けるため、スタッフが確認して手動で選択する)

## LIFF未設定時のフォールバック

`NEXT_PUBLIC_LIFF_ID`が未設定でも`/intake`ページ自体は開け、回答も保存される(ただし`lineUserId`が無いため全件`/intake-responses`で未紐づけ扱いになる)。動作確認・LIFFアプリ申請中の期間でもフォームを先行運用できるようにするための設計。

## 本番セットアップ(README「LINE事前問診」節参照)

1. Messaging APIチャネルと同じプロバイダー配下に、LIFF専用の新規LINEログインチャネルを作成し、その「LIFF」タブからLIFFアプリを追加(エンドポイントURL `https://<本番ドメイン>/intake`)
2. 発行された LIFF ID を`NEXT_PUBLIC_LIFF_ID`、**このLINEログインチャネル自身の**チャネルIDを`LIFF_CHANNEL_ID`としてVercel環境変数に設定
3. `npx tsx prisma/seed-production.ts`を再実行し、追加した3件の来店きっかけマスタを本番に投入する(upsertのため安全に再実行可能)
4. リッチメニュー等にLIFFのURL(`https://liff.line.me/<LIFF ID>`)を設置する
