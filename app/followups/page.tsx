import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FollowupStatus } from "@/app/generated/prisma/client";
import { getDepartureCandidates } from "@/lib/departures";
import { recordFollowupContact, confirmDeparture } from "@/app/actions/departures";

const checkpointStageLabel: Record<string, string> = {
  WEEK3: "3週後",
  WEEK6: "6週後",
  MONTH3: "3ヶ月後",
  MONTH6: "6ヶ月後",
  YEAR1: "1年後",
};

const followupResponseLabel: Record<string, string> = {
  WILLING_TO_CONTINUE: "反応あり(継続の意思)",
  NOT_CONTINUING: "反応あり(継続なし)",
  NO_RESPONSE: "反応なし",
  NOT_DONE: "未実施",
};

const departureReasonLabel: Record<string, string> = {
  GRADUATED: "症状改善による卒業(満足)",
  TRIAL_ONLY: "お試し利用(元々継続意思なし)",
  TEMPORARY_VISITOR: "遠方からの一時利用(帰省・出張等)",
  SWITCHED_BRANCH: "砥部店(他店舗)へ変更",
  NO_PERCEIVED_EFFECT: "効果を実感できなかった",
  LIFE_CHANGE: "体調・環境の変化(妊娠・出産・病気・怪我等)",
  STAFF_MINDSET_LACK: "こちら側のマインド不足",
  OTHER: "その他",
};

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function FollowupsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;

  const [checkpoints, candidates] = await Promise.all([
    prisma.followupCheckpoint.findMany({
      where: { status: FollowupStatus.PENDING },
      orderBy: { scheduledDate: "asc" },
      include: {
        departureRecord: { include: { client: { select: { id: true, name: true } } } },
      },
    }),
    getDepartureCandidates(),
  ]);

  const filteredCheckpoints =
    filter === "cancellation"
      ? checkpoints.filter((c) => c.departureRecord.triggeredByCancellation)
      : filter === "departure"
        ? checkpoints.filter((c) => !c.departureRecord.triggeredByCancellation)
        : checkpoints;

  // 同じ顧客がペース基準・キャンセル基準の両方に該当する場合は、より具体的なキャンセル基準を優先して1件にまとめる
  const dedupedCandidates = Array.from(
    candidates
      .reduce((map, c) => {
        const existing = map.get(c.clientId);
        if (!existing || c.trigger === "cancellation") map.set(c.clientId, c);
        return map;
      }, new Map<string, (typeof candidates)[number]>())
      .values()
  );
  const filteredCandidates =
    filter === "cancellation"
      ? dedupedCandidates.filter((c) => c.trigger === "cancellation")
      : filter === "departure"
        ? dedupedCandidates.filter((c) => c.trigger === "pace")
        : dedupedCandidates;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">フォローアップ管理</h1>
        <p className="text-sm text-stone-500 mt-1">
          離脱フォローの対応予定と、まだ離脱として記録していない候補(来院ペースの乖離・キャンセル後未予約)を確認できます。
        </p>
      </div>

      <div className="flex gap-2 text-sm">
        <FilterLink filter={filter} value={undefined} label="すべて" />
        <FilterLink filter={filter} value="departure" label="離脱" />
        <FilterLink filter={filter} value="cancellation" label="キャンセル後未予約" />
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">対応予定(予定日が近い順)</h2>
        {filteredCheckpoints.length === 0 && <p className="text-sm text-stone-400">対応予定はありません</p>}
        <ul className="flex flex-col divide-y divide-stone-100">
          {filteredCheckpoints.map((cp) => {
            const overdue = cp.scheduledDate < today;
            return (
              <li key={cp.id} className="py-3">
                <div className="flex items-center justify-between text-sm">
                  <Link href={`/clients/${cp.departureRecord.client.id}`} className="font-medium text-emerald-800 underline">
                    {cp.departureRecord.client.name}
                  </Link>
                  <span className={overdue ? "text-rose-600" : "text-stone-500"}>
                    {checkpointStageLabel[cp.stage]} ・ 予定: {fmtDate(cp.scheduledDate)}
                    {overdue && "(期限超過)"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  {cp.departureRecord.reason ? departureReasonLabel[cp.departureRecord.reason] : "理由未確定"}
                  {cp.departureRecord.triggeredByCancellation && (
                    <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-stone-500">キャンセル後未予約</span>
                  )}
                </p>
                <form action={recordFollowupContact.bind(null, cp.id)} className="mt-2 flex flex-wrap items-end gap-2">
                  <select name="contactMethod" required className="input py-1 text-xs">
                    <option value="">連絡方法</option>
                    <option value="LINE">LINE</option>
                    <option value="PHONE">電話</option>
                    <option value="LETTER">手紙・はがき</option>
                    <option value="IN_PERSON">対面(来店時)</option>
                    <option value="OTHER">その他</option>
                  </select>
                  <select name="response" required className="input py-1 text-xs">
                    <option value="">反応</option>
                    {Object.entries(followupResponseLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input name="note" placeholder="メモ" className="input py-1 text-xs flex-1 min-w-[120px]" />
                  <button type="submit" className="rounded-md bg-stone-800 px-2.5 py-1 text-xs text-white">
                    記録する
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">離脱候補(まだ記録されていません)</h2>
        <p className="text-xs text-stone-500 mb-3">
          来院ペースの乖離、またはキャンセル後3週間以上新規予約が無い顧客です。実際に来院・予約済みの場合はそのままで問題ありません。
        </p>
        {filteredCandidates.length === 0 && <p className="text-sm text-stone-400">候補はありません</p>}
        <ul className="flex flex-col divide-y divide-stone-100">
          {filteredCandidates.map((c) => (
            <li key={c.clientId} className="py-3">
              <div className="flex items-center justify-between text-sm">
                <Link href={`/clients/${c.clientId}`} className="font-medium text-emerald-800 underline">
                  {c.clientName}
                </Link>
                <span className="text-xs text-stone-500">
                  {c.trigger === "cancellation"
                    ? `キャンセル後未予約(${c.source === "manual" ? "キャンセル日" : "予約日"}: ${c.cancelledReservedAt ? fmtDate(c.cancelledReservedAt) : "—"})`
                    : `最終来院: ${c.lastVisitDate ? fmtDate(c.lastVisitDate) : "—"}`}
                </span>
              </div>
              <form action={confirmDeparture.bind(null, c.clientId)} className="mt-2 flex flex-wrap items-end gap-2">
                <input type="hidden" name="triggeredByCancellation" value={c.trigger === "cancellation" ? "true" : "false"} />
                <select name="reason" required className="input py-1 text-xs">
                  <option value="">離脱理由</option>
                  {Object.entries(departureReasonLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input name="reasonNote" placeholder="補足メモ" className="input py-1 text-xs flex-1 min-w-[120px]" />
                <button type="submit" className="rounded-md bg-stone-800 px-2.5 py-1 text-xs text-white">
                  離脱を記録する
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FilterLink({ filter, value, label }: { filter: string | undefined; value: string | undefined; label: string }) {
  const active = filter === value || (!filter && !value);
  return (
    <Link
      href={value ? `/followups?filter=${value}` : "/followups"}
      className={`rounded-md px-3 py-1.5 ${active ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
    >
      {label}
    </Link>
  );
}
