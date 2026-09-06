import { prisma } from "@/lib/prisma";
import { createClient } from "@/app/actions/clients";
import { RANK_OPTIONS } from "@/lib/tags";

export default async function NewClientPage() {
  const [channels, staff, clients] = await Promise.all([
    prisma.acquisitionChannel.findMany({ orderBy: { name: "asc" } }),
    prisma.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-stone-900 mb-6">新規顧客登録</h1>
      <form action={createClient} className="flex flex-col gap-4">
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
          <input name="name" required className="input" />
        </Field>
        <Field label="顧客番号">
          <input name="externalCustomerNo" className="input" placeholder="既存の顧客管理シートのID" />
        </Field>
        <Field label="カナ">
          <input name="kana" className="input" />
        </Field>
        <Field label="性別">
          <select name="gender" className="input">
            <option value="">未選択</option>
            <option value="女">女</option>
            <option value="男">男</option>
            <option value="その他">その他</option>
          </select>
        </Field>
        <Field label="電話番号">
          <input name="phone" className="input" />
        </Field>
        <Field label="初回来院日">
          <input type="date" name="firstVisitDate" className="input" />
        </Field>
        <Field label="来店きっかけ">
          <select name="acquisitionChannelId" className="input">
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
        <Field label="個人データ">
          <textarea name="personalData" rows={3} className="input" />
        </Field>
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
