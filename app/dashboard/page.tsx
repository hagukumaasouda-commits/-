import Link from "next/link";
import { getDashboardReport, granularityToPeriod } from "@/lib/reports";

function fmtDate(d: Date) {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
function fmtPct(n: number | null) {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}
function fmtNum(n: number | null) {
  return n === null ? "—" : n.toFixed(1);
}

function shiftReference(ref: Date, granularity: "week" | "month", dir: -1 | 1) {
  const d = new Date(ref);
  if (granularity === "week") d.setDate(d.getDate() + dir * 7);
  else d.setMonth(d.getMonth() + dir);
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ granularity?: string; ref?: string }>;
}) {
  const sp = await searchParams;
  const granularity: "week" | "month" = sp.granularity === "week" ? "week" : "month";
  const reference = sp.ref ? new Date(sp.ref) : new Date();
  const period = granularityToPeriod(granularity, reference);
  const report = await getDashboardReport(period);

  const prevHref = `/dashboard?granularity=${granularity}&ref=${shiftReference(reference, granularity, -1)}`;
  const nextHref = `/dashboard?granularity=${granularity}&ref=${shiftReference(reference, granularity, 1)}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">数値集計ダッシュボード</h1>
          <p className="text-sm text-stone-500 mt-1">
            {fmtDate(period.start)} 〜 {fmtDate(period.end)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex rounded-md border border-stone-300 overflow-hidden">
            <Link
              href={`/dashboard?granularity=week`}
              className={`px-3 py-1.5 ${granularity === "week" ? "bg-emerald-800 text-white" : "bg-white text-stone-600"}`}
            >
              週次
            </Link>
            <Link
              href={`/dashboard?granularity=month`}
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="新規来院数" value={report.newVisits} />
        <StatCard label="離脱数(6週間以上・予約なし)" value={report.churned} tone={report.churned > 0 ? "warn" : "default"} />
        <StatCard label="6回以上リピーター" value={report.repeaters6plus} />
        <StatCard label="15回以上リピーター" value={report.repeaters15plus} />
        <StatCard label="初回→2回目移行率" value={fmtPct(report.secondVisitConversion.rate)} sub={`${report.secondVisitConversion.converted}/${report.secondVisitConversion.cohortSize}人`} />
        <StatCard label="紹介率" value={fmtPct(report.referral.rate)} sub={`紹介 ${report.referral.referred}/${report.referral.cohortSize}人`} />
        <StatCard label="平均通院回数" value={fmtNum(report.averageVisitStats.avgVisitCount)} sub="回" />
        <StatCard label="平均通院期間" value={report.averageVisitStats.avgVisitSpanDays !== null ? Math.round(report.averageVisitStats.avgVisitSpanDays) : "—"} sub="日(2回目以降の顧客)" />
      </div>

      {report.prepaidDrain.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900">プリカ残高消化ペースの気づき</h2>
          <p className="text-sm text-amber-800 mt-1">
            残高が残っているのに離脱扱い(最終来院から6週間以上・次回予約なし)になっている顧客です。
          </p>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {report.prepaidDrain.map((c) => (
              <li key={c.clientId} className="flex justify-between">
                <Link href={`/clients/${c.clientId}`} className="text-amber-900 underline">
                  {c.clientName}
                </Link>
                <span className="tabular-nums text-amber-800">残高 {c.balance.toLocaleString()}円</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="font-semibold mb-3">スタッフ別担当患者数・リピート率</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200">
                <th className="py-1.5 font-normal">スタッフ</th>
                <th className="py-1.5 font-normal text-right">担当数</th>
                <th className="py-1.5 font-normal text-right">リピート率</th>
              </tr>
            </thead>
            <tbody>
              {report.staffCaseload.map((s) => {
                const rr = report.staffRepeatRate.find((r) => r.staffId === s.staffId);
                return (
                  <tr key={s.staffId} className="border-b border-stone-100 last:border-0">
                    <td className="py-1.5">{s.staffName}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.clientCount}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtPct(rr?.repeatRate ?? null)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="font-semibold mb-3">来店経路別(期間内新規)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200">
                <th className="py-1.5 font-normal">経路</th>
                <th className="py-1.5 font-normal text-right">人数</th>
              </tr>
            </thead>
            <tbody>
              {report.channelBreakdown.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-2 text-stone-400">
                    この期間の新規はありません
                  </td>
                </tr>
              )}
              {report.channelBreakdown.map((c) => (
                <tr key={c.channelId ?? "none"} className="border-b border-stone-100 last:border-0">
                  <td className="py-1.5">{c.channelName}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.clientCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="font-semibold mb-3">来院理由(主訴)分布</h2>
          <TagBars rows={report.distribution.chiefComplaints} />
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="font-semibold mb-3">施術部位分布</h2>
          <TagBars rows={report.distribution.bodyParts} />
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, tone = "default" }: { label: string; value: number | string; sub?: string; tone?: "default" | "warn" }) {
  return (
    <div className={`rounded-lg border p-4 ${tone === "warn" ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`}>
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-amber-900" : "text-stone-900"}`}>{value}</div>
      {sub && <div className="text-xs text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function TagBars({ rows }: { rows: { tag: string; count: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-stone-400">この期間のデータはありません</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.tag} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-stone-600">{r.tag}</span>
          <div className="h-2 flex-1 rounded-full bg-stone-100">
            <div className="h-2 rounded-full bg-emerald-700" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span className="w-6 text-right tabular-nums text-stone-500">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}
