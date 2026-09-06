import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CheckType } from "@/app/generated/prisma/client";
import { runAwarenessCheck, resolveAwarenessCheck, submitDialogue } from "@/app/actions/awareness";
import { confirmDeparture, recordFollowupContact } from "@/app/actions/departures";
import { requestReassignment, resolveReassignment } from "@/app/actions/reassignments";
import { recordPrepaidTransaction } from "@/app/actions/prepaid";
import { recordProductSale } from "@/app/actions/products";
import { getClientPurchaseHistory } from "@/lib/product-reports";
import { VISIT_INTERVAL_LABEL as visitIntervalLabel, HEALTH_HAPPINESS_LABEL as healthHappinessScoreLabel } from "@/lib/tags";

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

function fmtDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

const severityStyle: Record<string, string> = {
  INFO: "bg-stone-100 text-stone-600",
  NOTICE: "bg-sky-100 text-sky-800",
  IMPORTANT: "bg-rose-100 text-rose-800",
};
const statusLabel: Record<string, string> = {
  OPEN: "未対応",
  DISCUSSED: "対話中",
  RESOLVED: "対応済み",
};

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      primaryStaff: true,
      acquisitionChannel: true,
      referredBy: { select: { id: true, name: true } },
      referrals: { select: { id: true, name: true } },
      prepaidCard: { include: { transactions: { orderBy: { txDate: "desc" }, take: 10, include: { staff: true } } } },
      treatmentCourses: { orderBy: { courseNo: "desc" } },
      reservations: { orderBy: { reservedAt: "desc" }, take: 5 },
      visits: {
        orderBy: { visitNo: "desc" },
        include: { staff: true, chartRecord: true, awarenessChecks: { include: { dialogue: { include: { authorStaff: true } } } } },
      },
      departureRecords: {
        orderBy: { confirmedAt: "desc" },
        include: { confirmedBy: true, checkpoints: { orderBy: { scheduledDate: "asc" }, include: { contactedBy: true } } },
      },
      reassignmentRequests: {
        orderBy: { createdAt: "desc" },
        include: { currentStaff: true, newStaff: true, requestedByStaff: true },
      },
    },
  });
  if (!client) notFound();

  const purchaseHistory = await getClientPurchaseHistory(client.id);
  const allStaff = await prisma.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const latestSnapshot = await prisma.clientStatusSnapshot.findFirst({
    where: { clientId: client.id },
    orderBy: { snapshotDate: "desc" },
  });
  const activeProducts = await prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const openReassignment = client.reassignmentRequests.find((r) => r.status === "IN_DISCUSSION");

  const balance = client.prepaidCard
    ? (
        await prisma.prepaidTransaction.aggregate({
          where: { cardId: client.prepaidCard.id },
          _sum: { amount: true },
        })
      )._sum.amount ?? 0
    : null;

  const officeChecks = client.visits.flatMap((v) =>
    v.awarenessChecks.filter((c) => c.checkType === CheckType.OFFICE).map((c) => ({ ...c, visit: v }))
  );
  const aiChecks = client.visits.flatMap((v) =>
    v.awarenessChecks.filter((c) => c.checkType === CheckType.AI_INSIGHT).map((c) => ({ ...c, visit: v }))
  );

  const latestVisit = client.visits[0];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">
            {client.name}
            {!client.isActive && <span className="ml-2 rounded bg-stone-100 px-2 py-0.5 text-xs align-middle text-stone-500">離脱</span>}
          </h1>
          <p className="text-sm text-stone-500 mt-1">{client.kana}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/clients/${client.id}/edit`} className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            顧客情報を編集
          </Link>
          <Link href={`/clients/${client.id}/visits/new`} className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white">
            来院を記録する
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-stone-200 bg-white p-5 lg:col-span-1">
          <h2 className="font-semibold mb-3">基本情報</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="顧客番号" value={client.externalCustomerNo ?? "—"} />
            <Row label="ランク" value={latestSnapshot?.rank ?? "—"} />
            <Row label="性別" value={client.gender ?? "—"} />
            <Row label="電話" value={client.phone ?? "—"} />
            <Row label="住所" value={client.address ? `${client.postalCode ? `〒${client.postalCode} ` : ""}${client.address}` : "—"} />
            <Row label="職業" value={client.occupation ?? "—"} />
            <Row label="来店きっかけ" value={client.acquisitionChannel?.name ?? "—"} />
            <Row
              label="紹介元"
              value={client.referredBy ? <Link href={`/clients/${client.referredBy.id}`} className="text-emerald-800 underline">{client.referredBy.name}</Link> : "—"}
            />
            <Row label="主担当" value={client.primaryStaff?.name ?? "—"} />
            <Row label="初回来院" value={fmtDate(client.firstVisitDate)} />
            <Row label="来院回数" value={`${client.visits.length}回`} />
            <Row
              label="必要来院ペース"
              value={
                latestVisit?.chartRecord?.requiredVisitInterval
                  ? visitIntervalLabel[latestVisit.chartRecord.requiredVisitInterval]
                  : "未設定"
              }
            />
            <Row
              label="回復度"
              value={
                latestVisit?.chartRecord?.healthHappinessScore
                  ? healthHappinessScoreLabel[latestVisit.chartRecord.healthHappinessScore]
                  : "未設定"
              }
            />
            {client.referrals.length > 0 && (
              <Row
                label="紹介した人"
                value={client.referrals.map((r) => (
                  <Link key={r.id} href={`/clients/${r.id}`} className="mr-2 text-emerald-800 underline">
                    {r.name}
                  </Link>
                ))}
              />
            )}
          </dl>
          {(client.medicalHistory || client.familyData) && (
            <div className="mt-3 flex flex-col gap-2 border-t border-stone-100 pt-3 text-sm">
              {client.medicalHistory && (
                <p>
                  <span className="text-stone-500">既往: </span>
                  {client.medicalHistory}
                </p>
              )}
              {client.familyData && (
                <p>
                  <span className="text-stone-500">家族データ: </span>
                  {client.familyData}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5 lg:col-span-1">
          <h2 className="font-semibold mb-3">プリカ残高</h2>
          {client.prepaidCard ? (
            <>
              <div className="text-2xl font-semibold tabular-nums text-stone-900">{balance?.toLocaleString()}円</div>
              <div className="text-xs text-stone-500 mb-3">プラン: {client.prepaidCard.planType ?? "—"}</div>
              <ul className="flex flex-col gap-1 text-sm">
                {client.prepaidCard.transactions.map((t) => (
                  <li key={t.id} className="flex flex-col text-stone-600">
                    <div className="flex justify-between">
                      <span>
                        {fmtDate(t.txDate)} {t.txType === "CHARGE" ? "入金" : t.txType === "USE" ? "使用" : "訂正"}
                        {t.staff && <span className="text-xs text-stone-400"> ・ {t.staff.name}</span>}
                      </span>
                      <span className="tabular-nums">{t.amount > 0 ? "+" : ""}{t.amount.toLocaleString()}円</span>
                    </div>
                    {t.note && <span className="text-xs text-stone-400">{t.note}</span>}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-stone-400 mb-3">プリカ未発行(下のフォームから記録すると発行されます)</p>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-stone-700">入出金を記録する</summary>
            <form action={recordPrepaidTransaction.bind(null, client.id)} className="mt-2 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <select name="txType" required className="input py-1.5 text-sm">
                  <option value="CHARGE">入金</option>
                  <option value="USE">使用</option>
                  <option value="ADJUST">訂正(±そのまま入力)</option>
                </select>
                <input type="number" name="amount" required placeholder="金額" className="input py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" name="txDate" defaultValue={new Date().toISOString().slice(0, 10)} className="input py-1.5 text-sm" />
                <select name="staffId" className="input py-1.5 text-sm">
                  <option value="">担当スタッフ</option>
                  {allStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <input name="note" placeholder="メモ(例: ポイント2倍イベントで22,000円付与)" className="input py-1.5 text-sm" />
              <button type="submit" className="rounded-md bg-stone-800 px-3 py-1.5 text-sm font-medium text-white w-fit">
                記録する
              </button>
            </form>
          </details>

          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-stone-500">ポイント付与の早見表(参考・入力には連動しません)</summary>
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-left text-stone-500 border-b border-stone-200">
                  <th className="py-1 font-normal">入金額</th>
                  <th className="py-1 font-normal">通常付与</th>
                  <th className="py-1 font-normal">ポイント2倍時</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-stone-100">
                  <td className="py-1">10,000円</td>
                  <td className="py-1">ボーナスなし</td>
                  <td className="py-1">ー</td>
                </tr>
                <tr className="border-b border-stone-100">
                  <td className="py-1">20,000円</td>
                  <td className="py-1">21,000円</td>
                  <td className="py-1">22,000円</td>
                </tr>
                <tr className="border-b border-stone-100">
                  <td className="py-1">30,000円</td>
                  <td className="py-1">32,000円</td>
                  <td className="py-1">34,000円</td>
                </tr>
                <tr>
                  <td className="py-1">50,000円</td>
                  <td className="py-1">54,000円</td>
                  <td className="py-1">58,000円</td>
                </tr>
              </tbody>
            </table>
          </details>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5 lg:col-span-1">
          <h2 className="font-semibold mb-3">予約</h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {client.reservations.map((r) => (
              <li key={r.id} className="flex justify-between text-stone-600">
                <span>{r.reservedAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                <span className="text-xs">{r.status}</span>
              </li>
            ))}
            {client.reservations.length === 0 && <p className="text-stone-400">予約なし</p>}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">離脱・担当変更</h2>

        <div className="flex flex-wrap gap-4">
          {client.isActive && (
            <details className="flex-1 min-w-[280px]">
              <summary className="cursor-pointer text-sm font-medium text-stone-700">離脱を記録する</summary>
              <form action={confirmDeparture.bind(null, client.id)} className="mt-3 flex flex-col gap-3">
                <Field label="離脱理由" required>
                  <select name="reason" required className="input">
                    <option value="">選択してください</option>
                    {Object.entries(departureReasonLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="補足メモ">
                  <textarea name="reasonNote" rows={2} className="input" />
                </Field>
                <button type="submit" className="rounded-md bg-stone-800 px-3 py-1.5 text-sm font-medium text-white w-fit">
                  離脱を記録する
                </button>
              </form>
            </details>
          )}

          {!openReassignment && (
            <details className="flex-1 min-w-[280px]">
              <summary className="cursor-pointer text-sm font-medium text-stone-700">担当変更を相談する</summary>
              <form action={requestReassignment.bind(null, client.id)} className="mt-3 flex flex-col gap-3">
                <Field label="相談メモ">
                  <textarea
                    name="note"
                    rows={2}
                    className="input"
                    placeholder="〇〇さんとの関わり、少し一人で抱え込んでいませんか?"
                  />
                </Field>
                <button type="submit" className="rounded-md bg-stone-800 px-3 py-1.5 text-sm font-medium text-white w-fit">
                  相談する
                </button>
              </form>
            </details>
          )}
        </div>

        {openReassignment && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/40 p-3">
            <p className="text-sm text-stone-800">
              担当変更を相談中(現在の担当: {openReassignment.currentStaff.name}
              {openReassignment.requestedByStaff && ` ・ 起票: ${openReassignment.requestedByStaff.name}`})
            </p>
            {openReassignment.note && <p className="mt-1 text-sm text-stone-600">{openReassignment.note}</p>}

            <form action={resolveReassignment.bind(null, openReassignment.id, "confirm")} className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="新しい担当">
                <select name="newStaffId" required className="input">
                  <option value="">選択してください</option>
                  {allStaff
                    .filter((s) => s.id !== openReassignment.currentStaffId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="引き継ぎメモ">
                <input name="handoverNote" className="input" placeholder="何を伝えたか・注意点" />
              </Field>
              <button type="submit" className="rounded-md bg-emerald-800 px-3 py-1.5 text-sm font-medium text-white">
                変更を確定する
              </button>
            </form>
            <form action={resolveReassignment.bind(null, openReassignment.id, "decline")} className="mt-2">
              <button type="submit" className="text-xs text-stone-400 hover:text-stone-600 underline">
                今回は見送る
              </button>
            </form>
          </div>
        )}

        {client.departureRecords.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            {client.departureRecords.map((d) => (
              <div key={d.id} className="rounded-md border border-stone-200 p-3">
                <p className="text-sm text-stone-800">
                  {fmtDate(d.confirmedAt)} ・ {d.reason ? departureReasonLabel[d.reason] : "理由未確定"}
                  {d.triggeredByCancellation && (
                    <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">キャンセル後未予約</span>
                  )}
                  <span className="ml-2 text-xs text-stone-400">記録: {d.confirmedBy.name}</span>
                </p>
                {d.reasonNote && <p className="mt-1 text-xs text-stone-600">{d.reasonNote}</p>}

                <ul className="mt-2 flex flex-col divide-y divide-stone-100 border-t border-stone-100">
                  {d.checkpoints.map((cp) => (
                    <li key={cp.id} className="py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>
                          {checkpointStageLabel[cp.stage]}(予定: {fmtDate(cp.scheduledDate)})
                        </span>
                        <span className="text-xs text-stone-500">
                          {cp.status === "CONTACTED"
                            ? `連絡済み ・ ${cp.response ? followupResponseLabel[cp.response] : ""}`
                            : "未対応"}
                        </span>
                      </div>
                      {cp.status === "CONTACTED" ? (
                        cp.note && <p className="mt-1 text-xs text-stone-500">{cp.note}</p>
                      ) : (
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
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {latestVisit && (
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold">気づきチェック</h2>
            <form action={runAwarenessCheck.bind(null, latestVisit.id)}>
              <button className="rounded-md border border-emerald-800 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50">
                最新来院(第{latestVisit.visitNo}回)を気づきチェックする
              </button>
            </form>
          </div>
          <p className="text-xs text-stone-500">
            事務チェック(記入漏れ)とAI気づき(関わりの質・離脱兆候)は別々に走ります。AIは判断を下すのではなく、対話のきっかけを提示するだけです。
          </p>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <AwarenessLane title="事務チェック(記入漏れ)" tone="office" checks={officeChecks} />
        <AwarenessLane title="AI気づき(関わりの質・離脱兆候)" tone="ai" checks={aiChecks} />
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">購入履歴(物販)</h2>
        {purchaseHistory.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200">
                <th className="py-1.5 font-normal">日付</th>
                <th className="py-1.5 font-normal">商品</th>
                <th className="py-1.5 font-normal">区分</th>
                <th className="py-1.5 font-normal text-right">金額</th>
              </tr>
            </thead>
            <tbody>
              {purchaseHistory.map((p) => (
                <tr key={p.id} className="border-b border-stone-100 last:border-0">
                  <td className="py-1.5 text-stone-600">{fmtDate(p.saleDate)}</td>
                  <td className="py-1.5">{p.productName}</td>
                  <td className="py-1.5 text-stone-500 text-xs">
                    {p.itemType === "FULL" ? "本品" : "バラ"} ・ {p.purchaseType === "NEW" ? "新規" : "リピート"}
                    {p.isGift && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">プレゼント</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{p.amount.toLocaleString()}円</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-stone-400">購入履歴なし</p>
        )}

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-stone-700">物販購入を記録する</summary>
          <form action={recordProductSale.bind(null, client.id)} className="mt-2 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <select name="productId" required className="input py-1.5 text-sm">
                <option value="">商品を選択</option>
                {activeProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.defaultPrice != null ? `(参考: ${p.defaultPrice.toLocaleString()}円)` : ""}
                  </option>
                ))}
              </select>
              <input type="number" name="amount" placeholder="金額(プレゼント品は0のままでOK)" className="input py-1.5 text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" name="quantity" placeholder="個数" className="input py-1.5 text-sm" />
              <select name="itemType" className="input py-1.5 text-sm">
                <option value="FULL">本品</option>
                <option value="LOOSE">バラ</option>
              </select>
              <select name="purchaseType" className="input py-1.5 text-sm">
                <option value="NEW">新規</option>
                <option value="REPEAT">リピート</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" name="saleDate" defaultValue={new Date().toISOString().slice(0, 10)} className="input py-1.5 text-sm" />
              <select name="staffId" className="input py-1.5 text-sm">
                <option value="">担当スタッフ</option>
                {allStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-sm text-stone-700">
              <input type="checkbox" name="isGift" value="true" className="accent-emerald-800" />
              プレゼント品(無料配布)
            </label>
            <button type="submit" className="rounded-md bg-stone-800 px-3 py-1.5 text-sm font-medium text-white w-fit">
              記録する
            </button>
          </form>
          <p className="mt-1 text-xs text-stone-500">
            商品の追加・価格の修正は<Link href="/products/manage" className="underline">商品マスタを管理</Link>から行えます。
          </p>
        </details>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="font-semibold mb-3">来院タイムライン</h2>
        <ul className="flex flex-col divide-y divide-stone-100">
          {client.visits.map((v) => (
            <li key={v.id} className="py-3">
              <details>
                <summary className="cursor-pointer flex items-center justify-between text-sm">
                  <span>
                    第{v.visitNo}回 ・ {fmtDate(v.visitDate)} ・ 担当: {v.staff.name}
                    {v.menu && <span className="ml-2 text-stone-500">{v.menu}</span>}
                  </span>
                  {v.awarenessChecks.length > 0 && (
                    <span className="text-xs text-stone-400">気づき{v.awarenessChecks.length}件</span>
                  )}
                </summary>
                {v.chartRecord && (
                  <div className="mt-2 grid gap-1 pl-2 text-xs text-stone-600 border-l-2 border-stone-100">
                    {v.chartRecord.chiefComplaintTags.length > 0 && <p>主訴: {v.chartRecord.chiefComplaintTags.join("、")}</p>}
                    {v.chartRecord.bodyPartTags.length > 0 && <p>部位: {v.chartRecord.bodyPartTags.join("、")}</p>}
                    {v.chartRecord.evaluation && <p>評価: {v.chartRecord.evaluation}</p>}
                    {v.chartRecord.changeFromLast && <p>前回からの変化: {v.chartRecord.changeFromLast}</p>}
                    {v.chartRecord.clientVoice && <p>お客様の声: {v.chartRecord.clientVoice}</p>}
                    {v.chartRecord.nextCheck && <p>次回確認: {v.chartRecord.nextCheck}</p>}
                    {v.chartRecord.healthPracticeNote && <p>健康実践状況: {v.chartRecord.healthPracticeNote}</p>}
                    {v.chartRecord.lifestyleSupportStatus != null && (
                      <p>
                        生活習慣サポート:{" "}
                        {Object.entries(v.chartRecord.lifestyleSupportStatus as Record<string, boolean>)
                          .filter(([, done]) => done)
                          .map(([item]) => item)
                          .join("、") || "実施項目なし"}
                      </p>
                    )}
                    {v.chartRecord.healthHappinessScore && (
                      <p>回復度: {healthHappinessScoreLabel[v.chartRecord.healthHappinessScore]}</p>
                    )}
                    {v.chartRecord.testimonialObtained && (
                      <p>
                        口コミ取得
                        {v.chartRecord.testimonialObtainedDate && `(${fmtDate(v.chartRecord.testimonialObtainedDate)})`}
                      </p>
                    )}
                    {v.chartRecord.referralGiven && <p>紹介あり({v.chartRecord.referralCount ?? 1}人)</p>}
                  </div>
                )}
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right text-stone-800">{value}</dd>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-stone-600">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </span>
      {children}
    </label>
  );
}

type CheckWithVisit = {
  id: string;
  category: string;
  message: string;
  severity: string;
  status: string;
  visit: { visitNo: number };
  dialogue: { id: string; comment: string; createdAt: Date; authorStaff: { name: string } }[];
};

function AwarenessLane({
  title,
  tone,
  checks,
}: {
  title: string;
  tone: "office" | "ai";
  checks: CheckWithVisit[];
}) {
  return (
    <section className={`rounded-lg border p-5 ${tone === "ai" ? "border-amber-200 bg-amber-50/40" : "border-stone-200 bg-white"}`}>
      <h2 className="font-semibold mb-3">{title}</h2>
      {checks.length === 0 && <p className="text-sm text-stone-400">まだありません</p>}
      <ul className="flex flex-col gap-4">
        {checks.map((c) => (
          <li key={c.id} className="rounded-md border border-stone-200 bg-white p-3">
            <div className="flex items-center gap-2 text-xs">
              <span className={`rounded px-1.5 py-0.5 ${severityStyle[c.severity]}`}>{c.category}</span>
              <span className="text-stone-400">第{c.visit.visitNo}回</span>
              <span className="ml-auto text-stone-500">{statusLabel[c.status]}</span>
            </div>
            <p className="mt-2 text-sm text-stone-800">{c.message}</p>

            {c.dialogue.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 border-t border-stone-100 pt-2">
                {c.dialogue.map((d) => (
                  <li key={d.id} className="text-xs text-stone-600">
                    <span className="font-medium text-stone-700">{d.authorStaff.name}</span>: {d.comment}
                  </li>
                ))}
              </ul>
            )}

            <form action={submitDialogue} className="mt-2 flex items-center gap-2">
              <input type="hidden" name="awarenessCheckId" value={c.id} />
              <input name="comment" placeholder="コメントする" className="input flex-1 py-1 text-xs" />
              <button className="rounded-md bg-stone-800 px-2.5 py-1 text-xs text-white">送信</button>
            </form>
            {c.status !== "RESOLVED" && (
              <form action={resolveAwarenessCheck.bind(null, c.id)} className="mt-1">
                <button className="text-xs text-stone-400 hover:text-stone-600 underline">対応済みにする</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
