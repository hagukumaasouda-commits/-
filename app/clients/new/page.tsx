import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/app/actions/clients";
import { RANK_OPTIONS } from "@/lib/tags";
import { IntakeAnswersView } from "@/app/intake-responses/intake-answers-view";
import { CounselingScript } from "./counseling-script";

export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ intakeResponseId?: string }> }) {
  const { intakeResponseId } = await searchParams;

  const [channels, staff, clients, intake] = await Promise.all([
    prisma.acquisitionChannel.findMany({ orderBy: { name: "asc" } }),
    prisma.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    intakeResponseId
      ? prisma.intakeResponse.findFirst({ where: { id: intakeResponseId, linkedClientId: null } })
      : Promise.resolve(null),
  ]);

  const answers = (intake?.answers as Record<string, string | string[]>) ?? {};
  const asText = (key: string) => (typeof answers[key] === "string" ? (answers[key] as string) : "");
  // 問診票の選択肢表記は一部、来店経路マスタの名称と文言が異なるため別名で突合する
  const CHANNEL_ALIASES: Record<string, string> = { "ご家族・ご友人からのご紹介": "ご紹介" };
  const channelAnswer = asText("acquisitionChannel");
  const matchedChannel = channels.find((c) => c.name === (CHANNEL_ALIASES[channelAnswer] ?? channelAnswer));

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-stone-900 mb-2">新規顧客登録</h1>
      {intake && (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          事前問診の回答({intake.name})を読み込みました。内容を確認のうえ登録してください。
        </p>
      )}
      {intakeResponseId && !intake && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          指定された問診回答は見つからないか、すでに他の顧客に紐づけ済みです。
        </p>
      )}
      {!intake && (
        <p className="mb-4 text-xs text-stone-400">
          <Link href="/intake-responses" className="underline">
            事前問診の回答から登録する場合はこちら
          </Link>
        </p>
      )}
      <form action={createClient} className="flex flex-col gap-4">
        {intake && <input type="hidden" name="intakeResponseId" value={intake.id} />}
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-stone-600">
            登録区分<span className="text-rose-600"> *</span>
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-stone-200 bg-stone-50 p-3">
            <input
              type="radio"
              id="regTypeNew"
              name="registrationType"
              value="NEW"
              required
              defaultChecked
              className="peer/new accent-emerald-800"
            />
            <label htmlFor="regTypeNew">新規</label>
            <input
              type="radio"
              id="regTypeExisting"
              name="registrationType"
              value="EXISTING"
              required
              className="peer/existing accent-emerald-800"
            />
            <label htmlFor="regTypeExisting">既存(データ移行)</label>

            <div className="hidden w-full flex-col gap-1 peer-checked/existing:flex">
              <span className="text-xs text-stone-500">来院回数(これまでの実績)</span>
              <input type="number" name="initialVisitCount" min={0} step={1} defaultValue={0} className="input" />
            </div>
          </div>
        </div>

        <Field label="氏名" required>
          <input name="name" required defaultValue={intake?.name ?? ""} className="input" />
        </Field>
        <Field label="顧客番号">
          <input name="externalCustomerNo" className="input" placeholder="既存の顧客管理シートのID" />
        </Field>
        <Field label="カナ">
          <input name="kana" defaultValue={intake?.kana ?? ""} className="input" />
        </Field>
        <Field label="生年月日">
          <input type="date" name="dob" defaultValue={asText("dob")} className="input" />
        </Field>
        <Field label="性別">
          <select name="gender" defaultValue={asText("gender")} className="input">
            <option value="">未選択</option>
            <option value="女">女</option>
            <option value="男">男</option>
            <option value="その他">その他</option>
          </select>
        </Field>
        <Field label="電話番号">
          <input name="phone" defaultValue={intake?.phone ?? ""} className="input" />
        </Field>
        <Field label="郵便番号">
          <input name="postalCode" defaultValue={asText("postalCode")} className="input" />
        </Field>
        <Field label="住所">
          <input name="address" defaultValue={asText("address")} className="input" />
        </Field>
        <Field label="職業">
          <input name="occupation" defaultValue={asText("occupation")} className="input" />
        </Field>
        <Field label="初回来院日">
          <input type="date" name="firstVisitDate" className="input" />
        </Field>
        <Field label="来店きっかけ">
          <select name="acquisitionChannelId" defaultValue={matchedChannel?.id ?? ""} className="input">
            <option value="">未選択</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-stone-600">紹介元(誰の紹介か)</span>
          {asText("referralName") && (
            <p className="text-xs text-stone-500">問診票の回答:「{asText("referralName")}」</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-stone-200 bg-stone-50 p-3">
            <input
              type="radio"
              id="refSrcExisting"
              name="referralSourceType"
              value="EXISTING_CLIENT"
              className="peer/existing accent-emerald-800"
            />
            <label htmlFor="refSrcExisting">既存患者</label>
            <input type="radio" id="refSrcStaff" name="referralSourceType" value="STAFF" className="peer/staff accent-emerald-800" />
            <label htmlFor="refSrcStaff">スタッフ</label>
            <input type="radio" id="refSrcOther" name="referralSourceType" value="OTHER" className="peer/other accent-emerald-800" />
            <label htmlFor="refSrcOther">その他</label>

            <input
              type="text"
              list="referral-client-options"
              name="referralSourceClientQuery"
              placeholder="氏名を入力して選択"
              autoComplete="off"
              className="input hidden w-full peer-checked/existing:block"
            />
            <select name="referralSourceStaffId" className="input hidden w-full peer-checked/staff:block">
              <option value="">選択してください</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="referralSourceNote"
              placeholder="自由記述"
              className="input hidden w-full peer-checked/other:block"
            />
          </div>
          <datalist id="referral-client-options">
            {clients.map((c) => (
              <option key={c.id} value={`${c.name} #${c.id}`} />
            ))}
          </datalist>
        </div>

        <Field label="主担当スタッフ">
          <select name="primaryStaffId" className="input">
            <option value="">未選択</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ランク">
          <select name="rank" className="input" defaultValue="">
            <option value="">未選択</option>
            {RANK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <CounselingScript />

        <Field label="個人データ">
          <textarea name="personalData" rows={3} className="input" />
        </Field>
        <Field label="顕在ニーズ">
          <textarea name="manifestNeed" rows={2} className="input" placeholder="今困っていること" />
        </Field>
        <Field label="深層ニーズ">
          <textarea name="deepNeed" rows={2} className="input" placeholder="本当のお困りごと" />
        </Field>
        <Field label="ウォンツ">
          <textarea name="wants" rows={2} className="input" placeholder="どうなったら嬉しいか" />
        </Field>

        {intake && (
          <details className="rounded-md border border-stone-200 bg-stone-50 p-3">
            <summary className="cursor-pointer text-sm text-stone-600">事前問診の回答(全文)を見る</summary>
            <div className="mt-2">
              <IntakeAnswersView answers={answers} />
            </div>
          </details>
        )}

        <button type="submit" className="mt-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white w-fit">
          登録する
        </button>
      </form>
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
