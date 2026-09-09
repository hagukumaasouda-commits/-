import Link from "next/link";
import { granularityToPeriod } from "@/lib/reports";
import { getMonthlyTreatmentModalityCounts } from "@/lib/treatment-modality-reports";

function fmtDate(d: Date) {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function shiftReference(ref: Date, granularity: "week" | "month", dir: -1 | 1) {
  const d = new Date(ref);
  if (granularity === "week") d.setDate(d.getDate() + dir * 7);
  else d.setMonth(d.getMonth() + dir);
  return d.toISOString().slice(0, 10);
}

export default async function TreatmentModalitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ granularity?: string; ref?: string }>;
}) {
  const sp = await searchParams;
  const granularity: "week" | "month" = sp.granularity === "week" ? "week" : "month";
  const reference = sp.ref ? new Date(sp.ref) : new Date();
  const period = granularityToPeriod(granularity, reference);

  const counts = await getMonthlyTreatmentModalityCounts(period);
  const totalCount = counts.reduce((s, c) => s + c.count, 0);

  const prevHref = `/treatment-modalities?granularity=${granularity}&ref=${shiftReference(reference, granularity, -1)}`;
  const nextHref = `/treatment-modalities?granularity=${granularity}&ref=${shiftReference(reference, granularity, 1)}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">物療集計</h1>
          <p className="text-sm text-stone-500 mt-1">
            {fmtDate(period.start)} 〜 {fmtDate(period.end)}(来院記録の物療チェックを来院日ベースで集計)
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex rounded-md border border-stone-300 overflow-hidden">
            <Link
              href={`/treatment-modalities?granularity=week`}
              className={`px-3 py-1.5 ${granularity === "week" ? "bg-emerald-800 text-white" : "bg-white text-stone-600"}`}
            >
              週次
            </Link>
            <Link
              href={`/treatment-modalities?granularity=month`}
              className={`px-3 py-1.5 ${granularity === "month" ? "bg-emerald-800 text-white" : "bg-white text-stone-600"}`}
            >
              月次
            </Link>
          </div>
          <Link href={prevHref} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100">
            ← 前
          </Link>
          <Link href={nextHref} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100">
            次 →
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-4 sm:w-64">
        <div className="text-xs text-stone-500">物療実施件数合計</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{totalCount}件</div>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-5 lg:w-96">
        <h2 className="font-semibold mb-3">項目別実施件数</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-200">
              <th className="py-1.5 font-normal">項目</th>
              <th className="py-1.5 font-normal text-right">件数</th>
            </tr>
          </thead>
          <tbody>
            {counts.map((c) => (
              <tr key={c.item} className="border-b border-stone-100 last:border-0">
                <td className="py-1.5">{c.item}</td>
                <td className="py-1.5 text-right tabular-nums">{c.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
