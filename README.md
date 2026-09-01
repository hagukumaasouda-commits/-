# はぐくま CRM・電子カルテ統合アプリ

顧客管理(プリカ残高含む)・電子カルテ・気づきチェック・自動集計を1つのデータ基盤にまとめる社内アプリです。
Next.js (App Router) + Prisma + PostgreSQL + Anthropic API(気づきチェックのAI気づき部分)で構成しています。

設計の背景・データベース設計の全体像は、要件整理時に作成したドラフトを参照してください(会話内の Artifact リンク)。

## 前提・設計思想

- AIは「答えを出す」役ではなく「気づきを人と人の対話につなげる」役。`awareness_checks` に保存されるだけで、
  顧客のランクやステータスを自動で書き換えることはしません。
- 事務チェック(記入漏れ、ルールベース `lib/awareness/office.ts`)と、関わりの質・離脱兆候の気づき(AI、`lib/awareness/ai-insight.ts`)は完全に分離しています。
- 集計ロジックは `lib/reports.ts` に、期間(週次・月次・任意範囲)を引数に取る関数としてまとめています。ダッシュボード(`/dashboard`)はこれを呼び出しているだけなので、将来 Google Sheets 書き出しや会議資料化を追加する際もこの層を再利用できます。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. データベースを用意する

`docker-compose.yml` に PostgreSQL の設定があります。Docker が使える環境では:

```bash
docker compose up -d
```

Docker が使えない場合はローカルの PostgreSQL 16 を使ってください(このセッションでの動作確認もこの方法で行いました)。
`hagukuma` ロール・`hagukuma_crm` データベースを作成し、`.env` の `DATABASE_URL` をそれに合わせます(`.env.example` がそのままのデフォルト値です)。

### 3. 環境変数

```bash
cp .env.example .env
```

| 変数 | 用途 | 未設定時の挙動 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL接続文字列 | 必須 |
| `AUTH_SECRET` | スタッフログイン(Auth.js)のセッション署名鍵 | 必須。環境ごとに `openssl rand -base64 32` で個別生成してください |
| `ANTHROPIC_API_KEY` | AI気づき(関わりの質・離脱兆候)の生成 | 未設定でもアプリは動きます。事務チェックのみ実行され、AI気づきは黙ってスキップされます |
| `ANTHROPIC_MODEL` | AI気づきに使うモデルID(省略時 `claude-opus-5`) | 省略可 |
| `LINE_CHANNEL_ACCESS_TOKEN` | 将来のLINEリマインド自動送信用(未実装、下記「未接続の連携」参照) | 未使用 |

### 4. マイグレーション・シード投入

```bash
npx prisma migrate dev
npx prisma db seed
```

シードデータは架空の顧客8名分(新規・リピーター・紹介・離脱・プリカ残高消化ペースの気づき対象などのケースを含む)です。実在の患者情報は含みません。

### 5. 開発サーバー起動

```bash
npm run dev
```

`http://localhost:3000` で以下にアクセスできます(未ログインの場合はすべて `/login` にリダイレクトされます)。

### ログイン(デモアカウント)

シードデータには全スタッフ共通パスワード `hagukuma-demo` でログインできるアカウントが入っています。**本番投入前に必ず全員のパスワードを変更してください**(現時点ではパスワード変更UIはないため、`Staff.passwordHash` を `bcryptjs` でハッシュ化して直接更新する必要があります)。

| ユーザー名 | 役割 |
|---|---|
| `inchou` | 院長(DIRECTOR) |
| `sato` / `suzuki` / `tanaka` | スタッフ |

- `/dashboard` — 数値集計ダッシュボード(週次・月次切り替え、12指標)
- `/clients` — 顧客一覧・検索
- `/clients/new` — 新規顧客登録
- `/clients/[id]` — 顧客詳細(基本情報・プリカ残高・予約・気づきチェック・来院タイムライン)
- `/clients/[id]/visits/new` — 来院記録・カルテ入力

## データモデル

`prisma/schema.prisma` が正。主なテーブルと役割:

- `Client` / `Staff` / `AcquisitionChannel` — マスタ
- `Visit` / `ChartRecord` — 来院記録と電子カルテ本体(1来院=1カルテ)
- `TreatmentCourse` / `PrepaidCard` / `PrepaidTransaction` — クール契約とプリカ入出金明細(残高は都度SUMで算出)
- `Reservation` — 予約(ホットペッパー/LINE/電話/手動を `source` で区別)
- `AwarenessCheck` / `AwarenessDialogue` — 気づきチェックの結果と、それに対するスタッフ・院長の対話ログ
- `StaffMindsetCheck` — 継続カルテにあった「施術者マインド・フロントトーク」の自己点検(監視用途ではなく振り返り用途)
- `ClientStatusSnapshot` — ランク・健康度幸福度などの時系列スナップショット

## 未接続の連携(要件整理時点で未確定)

以下は今回のスコープでは実装していません。実装する際は下記を確認してから着手してください。

- **ホットペッパービューティーの予約連携**: CSVでの取り込みが可能であることを確認済み(次のフォーマット確認待ち)。サロンボード等から出力できるCSVの列見出し(ヘッダー行)、または数行分のサンプルを共有いただければ、`Reservation.source = HOTPEPPER` として取り込む機能を実装します。列の対応関係を推測で実装すると来店日時などが誤って取り込まれるリスクがあるため、実データ確認後に着手します。
- **LINE公式アカウントのMessaging API(自動リマインド)**: チャネルアクセストークンの発行・友だち追加時のユーザーID連携が必要。`Client.lineUserId` フィールドと `LINE_CHANNEL_ACCESS_TOKEN` の環境変数は用意済みですが、送信処理自体は未実装です。有効なトークンをいただき次第、送信ロジックを実装します。
- **認証・アクセス制御**: Auth.js(next-auth v5)によるスタッフログインを実装済み(`auth.ts` / `proxy.ts`)。全ページがログイン必須です。院長(DIRECTOR)とスタッフ(STAFF)のロールは `Staff.role` に保持していますが、現時点ではロールによる画面・操作の出し分けはしていません(必要になれば追加します)。
- **AI気づきに送信するデータ**: `lib/awareness/ai-insight.ts` は氏名・来院履歴・タグ・プリカ残高・予約状況をAnthropic APIに送信します。住所・電話番号・生年月日は送信していません。外部送信の可否は院内のポリシーに合わせて調整してください。

## 集計ロジックの単体確認

`lib/reports.ts` の各関数は `ReportPeriod`(`{ start, end }`)を受け取る純粋な関数です。進行中の期間(今月・今週)を指定した場合、「期間終了時点」を問う指標(離脱数・リピーター数・スタッフ担当数など)は未来日を基準にしないよう `asOfNow()` で「今日」にクランプしています。
