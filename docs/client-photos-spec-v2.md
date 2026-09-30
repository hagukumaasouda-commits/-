# 姿勢写真・インボディ結果 写真記録 仕様書 v2

「顧客管理の中に姿勢の写真やインボディの結果を写真に残せるようにしたい。お客様へも見せたいため蓄積して残せるようにしたい。」への対応。

## 1. 保存先: Supabase Storage(ユーザー確認済み)

身体の写真は要配慮個人情報にあたりうるため、既存のDB(Supabase・東京リージョン)と同じ配慮が必要と判断し、ユーザーに確認の上でSupabase Storageを採用した(Vercel Blobは保存リージョンの確約が無く、DBの方針と一貫しないため不採用)。

- バケット名: `client-photos`(非公開バケット。誰でもURLを知れば見られる公開バケットにはしない)
- アクセスはすべてサーバー側から**署名付きURL**(短時間のみ有効、既定60秒)を発行して行う。画像を直接公開URLとして埋め込むことはしない
- 環境変数(`.env.example`・READMEに追記): `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`(Storageの読み書きに使用。Postgresの`DATABASE_URL`とは別物)

## 2. データモデル

`ClientPhoto`モデルを新設(`Client`に1:多):
- `category`: `POSTURE`(姿勢) / `INBODY`(インボディ) / `OTHER`(その他)の3区分
- `storagePath`: Supabase Storage内のパス(`{clientId}/{cuid}.{ext}`形式)
- `takenAt`: 撮影日(スタッフが指定。既定は今日。過去に撮った写真をまとめて登録する場合を考慮し編集可能にする)
- `note`: 任意の自由記述メモ(例:「施術前」「3ヶ月後」など)
- `uploadedById`・`createdAt`: 記録者・登録日時

## 3. UI

顧客詳細ページに「写真記録(姿勢・インボディ)」セクションを新設する。
- アップロードフォーム: 区分(ラジオ)・撮影日(日付)・メモ(任意)・ファイル選択(`accept="image/*"`、スマホのカメラを直接起動できるよう`capture="environment"`を付与)
- 一覧: 区分ごとにグループ化し、撮影日の新しい順にサムネイル表示。同じ区分を並べることで、スタッフがお客様に見せながら経過を比較しやすくする(専用の比較UIは今回作らず、並び順で対応する)
- サムネイルをクリックすると原寸大の画像を新しいタブで開く(署名付きURL)
- 削除ボタン(確認ダイアログ付き)。削除時はSupabase Storage側のファイルとDBレコードの両方を消す

## 4. 顧客削除・統合(docs/client-delete-merge-spec-v2.md)との整合

`ClientPhoto`は`Client`への外部キーを持つため、既存の削除・統合機能を更新した:
- **削除(`deleteClient`)**: DB上の`ClientPhoto`レコードを削除した後、Supabase Storage側の実ファイルもベストエフォートで削除する(トランザクション外・失敗しても無視。DB上の紐付けは既に消えているため実害はない)
- **統合(`mergeClients`)**: 他の単純な付け替え対象(`ProductSale`・`TreatmentCourse`等)と同様、mergeの`ClientPhoto`をkeep側の`clientId`に付け替える(写真自体は失わない)

## 5. 実装上の注意

- Server Actionsのボディサイズ上限はNext.jsの既定で1MBのため、スマホカメラの写真(数MB〜十数MB)を受け付けられるよう`next.config.ts`の`experimental.serverActions.bodySizeLimit`を`15mb`に引き上げる
- 画像の縮小・圧縮は今回のスコープ外(将来的な改善候補。まずは蓄積・閲覧を優先する)
