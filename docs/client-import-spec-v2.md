# 顧客番号・ランク・月次集計・データ移行 仕様書 v2(実装用整理)

「顧客番号・ランク・月次集計・データ移行 仕様書 v1」はこのセッションでは受領していない。以下は、依頼メッセージでいただいたカラム定義(`client_number`, `name`, `first_visit_date`, `visit_count`, `last_visit_date`, `primary_staff`, `rank`, `required_visit_interval`)と既存スキーマから、実装のために私が補った設計判断のまとめ。**元の仕様書と食い違う箇所があれば教えてください。**

## 1. 顧客番号(`client_number`)

新規登録・編集フォームの両方に追加。既存スキーマの`Client.externalCustomerNo`(サロンボード予約CSV取り込みの突合キーとしてすでに存在)をそのまま使う。新規フィールドの追加は不要だった。

## 2. CSVインポート(`/clients/import`)のカラムごとの扱い

| CSV列 | 保存先 | 補足 |
|---|---|---|
| `client_number` | `Client.externalCustomerNo` | **突合キー**。一致する既存顧客がいれば更新、無ければ新規作成 |
| `name` | `Client.name` | |
| `first_visit_date` | `Client.firstVisitDate` | `YYYY-MM-DD` / `YYYY/MM/DD` / `YYYYMMDD`を許容 |
| `primary_staff` | `Client.primaryStaffId` + `ClientStaff` | スタッフ名の完全一致で既存`Staff`と照合。一致しなければ主担当は未設定のまま、警告として報告 |
| `rank` | `ClientStatusSnapshot`(新規作成) | 値は既存スキーマの想定通り`AS / A / B / C1 / C2 / C3`のみ許可。今日の日付でスナップショットを1件作成(同日に既存があれば上書き)。**[要確認]** 元の仕様書に月次集計の詳細があるはずだが、今回はランクの記録のみ実装し、月次集計自体は別途実装が必要 |
| `visit_count` + `last_visit_date` + `required_visit_interval` | 下記参照 | |

### `visit_count` / `last_visit_date` / `required_visit_interval` の扱い

この3項目は本来カルテ(`Visit`/`ChartRecord`)側の情報だが、過去の来院を1件ずつ再現するデータが無いため、**移行専用の「まとめ来院」を1件だけ作成する**方式にした:

- 対象は**現時点で`Visit`が1件も無い顧客のみ**(実運用が始まっていない/CSVで初めて作る顧客)。既に来院記録がある顧客は、実データを壊さないよう`visit_count`以降の処理をスキップし、その旨を警告として報告する
- `primary_staff`が既存スタッフと一致した場合のみ実行(`Visit.staffId`は必須のため、担当が特定できない行は来院回数の初期化ができない)
- 実行内容: `visitNo = visit_count`、`visitDate = last_visit_date`の`Visit`を1件作成し、`ChartRecord.requiredVisitInterval`に`required_visit_interval`の値(日本語ラベルをenumに変換)を設定する
- これにより、以後スタッフが「来院を記録する」を押すと`visitNo = visit_count + 1`から自然に続き、離脱判定(`getChurnedClientIds`)も`last_visit_date`を起点に正しく動く
- `required_visit_interval`の値は`docs/departure-followup-spec-v2.md`の8択の表示ラベル(「週2,3回」「1週間」等)と完全一致する文字列を期待する。一致しなければ空欄のまま警告

## 3. ランクの表示

`ClientStatusSnapshot`はこれまでどの画面からも参照されていなかった(未使用のテーブルだった)。今回のインポートで初めて実データが入るため、顧客詳細ページの基本情報に「ランク」として最新のスナップショット値を表示するようにした。
