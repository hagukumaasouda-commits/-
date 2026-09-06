# 次回予約・キャンセル記録 仕様書 v2

v1(アップロード文書)を実装のためレビューし、既存コード(`docs/departure-followup-spec-v2.md` 2.5節、`lib/departures.ts`、`app/clients/[id]/page.tsx`)との統合方法を確定する。

## 1. データモデル

v1のまま、`Client`に以下を追加する。

| フィールド | 型 | 説明 |
|---|---|---|
| `nextAppointmentDate` | `DateTime?` | 次回予約日 |
| `appointmentStatus` | `AppointmentStatus`(enum、既定`NONE`) | `BOOKED`(予約あり) / `CANCELLED`(キャンセル) / `NONE`(予約なし) |
| `cancelledAt` | `DateTime?` | キャンセルが記録された日 |

命名は既存スキーマの規則(PascalCase enum・camelCaseフィールド)に合わせ、`appointment_status`の選択肢`予約あり/キャンセル/予約なし`は`BOOKED/CANCELLED/NONE`とする。

## 2. UI(顧客詳細ページ「予約」カード)

**[v2で簡略化]** v1は状態ごとに「予約あり:編集リンク」「キャンセル・予約なし:直接入力欄」と表示を出し分ける想定だったが、本アプリの他カード(プリカ残高・物販など)は入力フォームを常時表示するUIで統一されているため、一貫性のため次回予約日の入力欄は状態によらず常時表示する(リンクで折りたたむ実装はしない)。

- 状態表示テキストを常に表示: 「次回予約: ◯月◯日」/「キャンセル済み(◯月◯日)」/「予約なし」
- その下に次回予約日の入力欄+更新ボタンを常時表示(どの状態からでも入力すると`appointmentStatus`が`BOOKED`になる)
- 「キャンセルする」ボタンは`appointmentStatus`が`BOOKED`のときのみ表示(予約が無い状態でキャンセルする操作は意味を持たないため)
- 押すと`appointmentStatus = CANCELLED`、`cancelledAt =` 本日、`nextAppointmentDate = null`
- 既存の「予約CSV取り込み」による予約履歴リスト(`client.reservations`)は変更せず、このカードの下部にそのまま維持する(両機能は別物として併存)

## 3. 離脱フォローアップとの連携

`docs/departure-followup-spec-v2.md` 2.5節と同じ「(a)都度計算方式」(`DepartureRecord`を自動生成しない、`lib/departures.ts`の候補一覧に都度算出して表示する)を踏襲する。

**[v2で確定] 既存のキャンセル検知(予約CSV取り込み由来)との関係**: 既存の`getCancellationBasedCandidates()`は`Reservation.status = CANCELLED`(サロンボード等の外部予約データ)を起点に候補を算出しており、今回追加する手動記録(`Client.appointmentStatus`)とはデータソースが異なる。どちらの運用でキャンセルが記録されても離脱フォローの候補に上がるべきなので、**両方のソースを候補生成に使う**(統合はデータレベルではなくロジックレベルで行う):

- 新設: `getManualCancellationCandidates()` — `appointmentStatus = CANCELLED` かつ `cancelledAt`が21日(`CANCELLATION_FOLLOWUP_DAYS`)以上前かつ`isActive = true`の顧客を抽出
- `DepartureCandidate`型に`source: "reservation" | "manual"`を追加し、`trigger: "cancellation"`のどちらの経路かを区別できるようにする
- `getDepartureCandidates()`は `[...pace, ...reservationCancellation, ...manualCancellation]` の順で返す。`/followups`ページの既存の重複排除ロジック(同一顧客が複数候補に該当する場合、後に処理された`cancellation`系が勝つ)により、両方に該当する場合は手動記録(`manual`)を優先表示する(スタッフが直接入力した情報の方が正確なため)
- 起点日として、予約CSV由来は引き続き`reservedAt`(キャンセルされた予約の予定日、既存の近似)を使い、手動記録は`cancelledAt`(実際にキャンセルが記録された日)を使う。手動記録の方が正確な起点日を持つ
- `/followups`ページの表示テキストを、`source`に応じて「予約日: X」(予約CSV由来)/「キャンセル日: X」(手動記録)に出し分ける

離脱を実際に記録する操作(`confirmDeparture`)は変更不要(`triggeredByCancellation`フラグを渡す既存の仕組みをそのまま使う)。

## 4. 予約CSV取り込みとの違い

v1の整理どおり。データは統合せず、両方が独立して離脱フォロー候補の算出に寄与する(3節)。
