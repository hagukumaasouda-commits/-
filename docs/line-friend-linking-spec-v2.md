# LINE友だち紐づけ 仕様書 v2

チャットでの依頼(「LINE友だちと顧客を紐づける仕組み」)を実装するための整理。v1文書は無く、既存実装調査→実装方針の提案→承認、という流れで進めた。実装前にLINE Messaging APIの正確な挙動(署名検証・イベント形式・友だち一覧取得の可否)を公式ドキュメント(developers.line.biz、LINE公式OpenAPI定義)で裏取りした上で実装した。

## 1. 背景・現状把握

- `Client.lineUserId`(既存フィールド)はリマインド送信(`lib/line.ts`・`app/actions/reservations.ts`)の宛先として使われているが、これを埋める仕組みが一切無かった(Webhookも手入力欄も無し)
- 運用上、友だち追加時にLINE公式アカウント管理画面で表示名を「顧客番号+氏名」の形(例:「2370大亀紫姫」)に手動で書き換える運用が既に定着している。この運用を前提に、表示名から顧客番号を抽出して自動サジェストする

## 2. データモデル

新規に`LineFriend`モデルを追加(`Client.lineUserId`とは別に、友だち全員の台帳として持つ)。

| フィールド | 説明 |
|---|---|
| `lineUserId` | LINEのユーザーID(一意) |
| `displayName` | followイベント時点(または遡及登録実行時点)の表示名 |
| `followedAt` | 友だち追加日時(遡及登録の場合は実行日時で代用) |
| `unfollowedAt` | ブロックされた日時(参考記録。行は削除しない) |
| `linkedClientId` | 紐づけ済みならClientのID(一意。1顧客につき1友だちまで) |
| `linkedAt` / `linkedByStaffId` | 紐づけた日時・スタッフ |

紐づけ確定時に、`lineUserId`を既存の`Client.lineUserId`にコピーする。予約リマインドはこのフィールドを見るだけなので、コード変更不要でそのまま動く。

## 3. Webhookエンドポイント(`app/api/line/webhook/route.ts`)

**[実装中に発覚した問題と修正] 認証方式**: 実装前の調査時点では「`middleware.ts`が無いのでページ単位の`auth()`呼び出し方式であり、新設するAPI Routeは自動的に未認証で公開される」と判断していたが、これは誤りだった。このリポジトリはNext.js 16で`middleware.ts`から名称変更された`proxy.ts`を使っており、`api/auth`以外の**全ルートを`auth()`でログイン必須にゲートしていた**(`matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"]`)。この状態では、LINEからのWebhookリクエストは`/login`へ307リダイレクトされてしまい、署名検証まで到達せず機能しない。ローカルで実際にWebhookをシミュレートして初めて発覚した。`proxy.ts`のmatcherに`api/line/webhook`を追加除外して修正した。署名検証が引き続き唯一の防御。

**[確定] 署名検証**: LINEは「チャネルシークレット(`LINE_CHANNEL_SECRET`、送信用の`LINE_CHANNEL_ACCESS_TOKEN`とは別の値)をキーにしたHMAC-SHA256でリクエストボディ全体を署名し、Base64化した値」を`x-line-signature`ヘッダーに載せて送ってくる。Next.jsの`request.json()`で先にパースすると再シリアライズでバイト列が変わり検証に失敗するため、`request.text()`で生の文字列を取得してから検証→`JSON.parse`という順序にしている(`lib/line.ts`の`verifyLineSignature`)。

**イベント処理**:
- `follow`: `GET /v2/bot/profile/{userId}`で表示名を取得し、`LineFriend`を作成(既存があれば`unfollowedAt`をクリアして復活扱い)
- `unfollow`: 該当行があれば`unfollowedAt`を記録(削除はしない)
- **[v2で追加] それ以外のイベント(メッセージ受信等)でも、`event.source.userId`が載っていてまだ記録が無ければ`LineFriend`を作成する**。理由は4節参照

## 4. 遡及登録(Webhook実装前からの既存の友だち)

`GET /v2/bot/followers/ids`は実在するエンドポイント(公式OpenAPI定義で確認済み)で、`{userIds: string[], next?: string}`をページネーション付きで返す(`limit`最大1000、`start`で次ページ取得)。`/line-friends`の「友だち一覧を取得」ボタンから呼び出し、まだ`LineFriend`に無いuserIdだけ`GET /v2/bot/profile/{userId}`で表示名を取得して作成する(`app/actions/line-friends.ts`の`backfillLineFriends`)。

**[確定] 既知の制限**: 公式ドキュメントに明記された制限として、`followers/ids`は**LINEのiOS/Android版アプリのユーザーのみが対象**で、LINEデスクトップ版・LINE公式アカウント管理画面からのみ操作しているユーザーは含まれない。この制限に該当する友だちは、3節で追加した「follow以外のイベントでも記録する」保険でカバーする(その友だちが何かメッセージを送った時点で拾える)。それでも一切メッセージが来ない相手については、LINE公式アカウント管理画面がユーザーIDを表示しないためシステム的に遡及する手段が無く、次回来店時にLINEで一言送ってもらう運用回避が必要になる(README「LINE友だち紐づけ」に明記)。

## 5. 管理画面(`/line-friends`、ナビに追加)

- 未紐づけの友だちを`followedAt`降順で一覧表示(表示名・友だち追加日時・ブロック済みバッジ)
- 表示名の先頭の数字の連続を正規表現(`/^(\d+)/`)で抽出し、`Client.externalCustomerNo`と一致する顧客がいれば「この顧客ですか? [氏名]」とサジェスト+ワンクリックでリンクするボタンを表示
- サジェストが無い/違う場合は、既存の紹介元入力(`referralSourceClientQuery`、`app/clients/new/page.tsx`)と同じ「氏名 #顧客ID」形式の`<input list> + <datalist>`で手動検索→リンク
- リンク済みの友だちも一覧の下部に残し、誰がいつリンクしたか確認できるようにした

## 6. 未確定・今後の検討事項

- 「リンクを解除する」専用の操作は今回実装していない。ただし`linkedClientId`には一意制約があるため、誤って別の`LineFriend`を同じ顧客にリンクし直した場合にPrismaの制約違反で500エラーになってしまう問題が検証中に見つかった。これを避けるため、`linkLineFriend`(`app/actions/line-friends.ts`)ではリンク処理をトランザクション化し、同じ顧客を指している他の`LineFriend`行があれば先に`linkedClientId`/`linkedAt`/`linkedByStaffId`をクリアしてから新しいリンクを張るようにした。結果として、顧客を別の友だちに付け替えると元の友だちは自動的に「未紐づけ」に戻る(古いリンクが表示上残ったままになることはない)
- LIFF等による顧客自身のセルフリンクは、今回のスコープ外(Webhook+スタッフ手動リンクのみ)
