# 顧客の削除・統合 仕様書 v2

チャットでの依頼(「顧客情報を間違って二つ作成してしまうこともあるので、削除かお客様統合をできるようにしたい」)を実装するための整理。v1文書は無く、既存のリレーション構造の調査→設計→実装、という流れで進めた。スキーマ変更は無し(既存のリレーションのみで実現)。

## 1. 使い分け

- **削除**: 誤って作成した空の(または実データがほぼ無い)重複プロフィールをそのまま消す。関連データも含めて完全に削除する
- **統合**: 重複プロフィールの片方に既に来院記録・プリカ・物販などの実データが入ってしまっている場合に使う。データを失わずに1つのプロフィールにまとめる

両方とも顧客情報編集画面(`/clients/[id]/edit`)の末尾に「危険な操作」セクションとして置く。

## 2. 削除(`deleteClient`)

対象顧客に紐づく全データを削除する。確認ダイアログに来院数・プリカ残高・物販件数を表示し、実データがあることを知らずに削除しないようにする。

削除順序(外部キー制約を満たす順):
1. `AwarenessDialogue`(対象の`AwarenessCheck`経由)
2. `AwarenessCheck`(対象の`Visit`経由)
3. `StaffMindsetCheck`(対象の`Visit`経由)
4. `FollowupCheckpoint`(対象の`DepartureRecord`経由)
5. `DepartureRecord`
6. `ReassignmentRequest`
7. `Reservation`
8. `ClientStatusSnapshot`
9. `ProductSale`(この顧客の購入記録。実売上として集計に使われた実績があるため、削除する場合はその分の売上集計も減ることを確認ダイアログで示す)
10. `PrepaidTransaction`(対象の`PrepaidCard`経由)・`PrepaidCard`
11. `ChartRecord`(対象の`Visit`経由)
12. `Visit`
13. `TreatmentCourse`(現状アプリからは作成されない未使用のモデルだが念のため削除)
14. `LineFriend`: 削除ではなく`linkedClientId`等をnullに戻す(友だち自体の記録は残し、未紐づけ一覧に戻す)
15. 他の顧客の`referralSourceClientId`がこの顧客を指している場合、`referralSourceClientId`/`referralSourceType`をnullに戻す(紹介元が消えた顧客として扱う)
16. この顧客が誰かに紹介されていた場合(`referralSourceClientId`が設定されている場合)、その紹介元顧客の`referralCount`を1減算する
17. `ClientStaff`
18. `Client`本体を削除

## 3. 統合(`mergeClients`)

編集画面で開いている顧客(`keep`)に、別の顧客(`merge`、氏名検索で選択)のデータを取り込み、`merge`を削除する。

### 3.1 来院(`Visit`)の付け替え

`visitNo`は顧客ごとに`@@unique([clientId, visitNo])`のため、単純にclientIdだけ差し替えると衝突する。keep・merge両方の来院を`visitDate`昇順で並べ直し、来院日の実際の時系列に沿って1から振り直す(2段階更新: 一時的に大きな番号へ退避してから最終番号を振る。これは一意制約に同時に触れないための実装上の手順)。`ChartRecord`・`AwarenessCheck`・`AwarenessDialogue`・`StaffMindsetCheck`・来院に紐づく`PrepaidTransaction`は`visitId`経由なので、Visit行のclientId変更だけで自動的に付いてくる(追加の付け替え処理は不要)。

### 3.2 プリカ(`PrepaidCard`)の統合

- mergeにカードが無い: 何もしない
- keepにカードが無くmergeにある: カードごとkeepへ付け替え
- 両方にカードがある: mergeのカードの取引(`PrepaidTransaction`)を全てkeepのカードへ付け替えてから、mergeの空になったカードを削除する(残高は取引の合計で決まるため、自然に合算される)

### 3.3 その他のclientId付け替え

`Reservation`・`ClientStatusSnapshot`・`ProductSale`・`DepartureRecord`(`FollowupCheckpoint`は`departureRecordId`経由なので自動的に付いてくる)・`ReassignmentRequest`・`TreatmentCourse`は単純に`clientId`をmerge→keepに更新する(一意制約が絡まないため付け替えのみで良い)。

### 3.4 `ClientStaff`(複数担当)

mergeの担当スタッフ割り当てのうち、keepにまだ無いものだけkeepへ新規作成し、mergeの割り当ては全て削除する。

### 3.5 `LineFriend`(LINE友だち紐づけ)

- keepに紐づけが無くmergeにある: keepへ付け替え
- 両方に紐づけがある: mergeの紐づけは「未紐づけ」に戻す(LineFriendの`linkedClientId`をnull)。友だち自体の記録は残るため、後で手動で見直せる

### 3.6 紹介関係(`referralSourceClientId`/`referralCount`)

- 他の顧客からmergeへの`referralSourceClientId`参照は、keepを指すように更新する
- keep自身の紹介元情報(`referralSourceType`/`referralSourceClientId`/`referralSourceStaffId`/`referralSourceNote`)が未設定で、mergeに設定されていればmergeの値を採用する(keepに既に設定があればそちらを優先し上書きしない)
- `referralCount`(紹介人数の累計)はkeep・merge両方の値を合算する

### 3.7 その他のスカラー項目

自由記述・任意項目は「keepが未入力の場合のみmergeの値を採用する」方式(不足を埋める)で統一する: `kana`・`dob`・`gender`・`phone`・`postalCode`・`address`・`occupation`・`lifestyleTags`・`lineUserId`・`externalCustomerNo`・`acquisitionChannelId`・`primaryStaffId`・`rank`・`medicalHistory`・`familyData`・`personalData`・`manifestNeed`・`deepNeed`・`wants`・`nextAppointmentDate`/`appointmentStatus`/`cancelledAt`。

**[注意]** `lineUserId`・`externalCustomerNo`は一意制約があるため、両方に値がある場合はkeepの値を優先し、mergeの値は破棄する(自動では統合しない。もし本当は同一の値であるべきなら手動で確認・修正が必要)。

`firstVisitDate`は不足補完ではなく、keep・mergeのうち早い方(最古の初回来院日)を採用する。`initialVisitCount`(登録時点までの実績来院数)は両方の値を合算する(別々に管理されていた「アプリ導入前の来院実績」を両方とも保持するため)。`registrationType`・`isActive`はkeepの値をそのまま維持する(mergeの値では上書きしない)。

自由記述系フィールドで両方に異なる内容が入っていた場合、mergeの内容は失われる(keep優先)。件数が少ない運用を想定し、統合後にスタッフが目視で確認する運用を前提とする。

### 3.8 最終処理

上記の付け替え・書き込みがすべて終わった時点でmergeに紐づくデータは無くなっているため、`Client`本体を削除して完了する。
