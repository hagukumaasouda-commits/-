import ImportForm from "./import-form";

export default function ImportReservationsPage() {
  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">予約CSVの取り込み(サロンボード)</h1>
        <p className="text-sm text-stone-500 mt-1">
          サロンボードから出力した予約CSVをアップロードします。お客様番号で既存顧客と自動的に突き合わせ、
          一致しない場合は新規顧客として登録します。同じ予約番号のCSVを再度取り込んだ場合は上書き更新されます。
        </p>
      </div>
      <ImportForm />
    </div>
  );
}
