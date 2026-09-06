import ClientImportForm from "./import-form";

export default function ImportClientsPage() {
  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">顧客CSVの一括インポート(データ移行)</h1>
        <p className="text-sm text-stone-500 mt-1">
          既存の顧客管理シートから、顧客番号・ランク・来院回数などを一括で取り込みます。列は
          <code className="mx-1 rounded bg-stone-100 px-1 py-0.5 font-mono text-xs">
            client_number, name, first_visit_date, visit_count, last_visit_date, primary_staff, rank, required_visit_interval
          </code>
          をこの順に含むCSVを用意してください(顧客番号で既存顧客と突き合わせます)。
        </p>
        <p className="text-xs text-stone-500 mt-2">
          来院回数(visit_count)・最終来院日(last_visit_date)・必要来院ペースは、まだ来院記録が1件も無い顧客にのみ反映されます。
          担当スタッフ(primary_staff)は既存のスタッフ名と完全一致した場合のみ設定されます。
        </p>
      </div>
      <ClientImportForm />
    </div>
  );
}
