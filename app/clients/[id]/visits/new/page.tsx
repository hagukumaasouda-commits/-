import { prisma } from "@/lib/prisma";
import { createVisit } from "@/app/actions/visits";
import {
  CHIEF_COMPLAINT_TAGS,
  BODY_PART_TAGS,
  LIFESTYLE_SUPPORT_ITEMS,
  TREATMENT_MENU,
  VISIT_INTERVAL_OPTIONS,
  HEALTH_HAPPINESS_OPTIONS,
} from "@/lib/tags";
import { notFound } from "next/navigation";

export default async function NewVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!client) notFound();

  const staff = await prisma.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const action = createVisit.bind(null, client.id);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-stone-900 mb-1">来院記録・カルテ入力</h1>
      <p className="text-sm text-stone-500 mb-6">{client.name} 様</p>

      <form action={action} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="来院日" required>
            <input type="date" name="visitDate" required className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="担当スタッフ" required>
            <select name="staffId" required className="input">
              <option value="">選択してください</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="本日のメニュー">
          <input name="menu" className="input" placeholder="例: 全身調整" />
        </Field>

        <details className="rounded-md border border-stone-200 bg-stone-50 p-3">
          <summary className="cursor-pointer text-sm text-stone-600">施術メニュー表(参考価格。会計への連動はありません)</summary>
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200">
                <th className="py-1 font-normal">プラン</th>
                <th className="py-1 font-normal">会員価格</th>
                <th className="py-1 font-normal">一般価格</th>
              </tr>
            </thead>
            <tbody>
              {TREATMENT_MENU.map((m) => (
                <tr key={m.name} className="border-b border-stone-100 last:border-0">
                  <td className="py-1">{m.name}</td>
                  <td className="py-1">{m.memberPrice.toLocaleString()}円</td>
                  <td className="py-1">{m.generalPrice.toLocaleString()}円</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-stone-500">
            昔からの顧客は特別料金の場合があります。実際の請求額はプリカ台帳・物販記録にその都度手入力してください。
          </p>
        </details>

        <Field label="主訴タグ">
          <TagCheckboxes name="chiefComplaintTags" options={CHIEF_COMPLAINT_TAGS} />
        </Field>

        <Field label="施術部位タグ">
          <TagCheckboxes name="bodyPartTags" options={BODY_PART_TAGS} />
        </Field>

        <Field label="生活習慣サポート実施状況">
          <TagCheckboxes name="lifestyleSupportStatus" options={LIFESTYLE_SUPPORT_ITEMS} />
        </Field>

        <Field label="健康実践状況">
          <textarea name="healthPracticeNote" rows={2} className="input" placeholder="ストレッチ・トレーニングなど、今回の実践内容を自由に記入" />
        </Field>

        <Field label="評価(何が起きているか)">
          <textarea name="evaluation" rows={3} className="input" />
        </Field>

        <Field label="前回からの変化">
          <textarea name="changeFromLast" rows={2} className="input" />
        </Field>

        <Field label="お客様の声(自己認識)">
          <textarea name="clientVoice" rows={2} className="input" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="次回確認">
            <input name="nextCheck" className="input" />
          </Field>
          <Field label="次回必須">
            <input name="nextRequired" className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="必要来院ペース">
            <select name="requiredVisitInterval" className="input" defaultValue="">
              <option value="">未設定</option>
              {VISIT_INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="回復度(健康度幸福度)">
            <select name="healthHappinessScore" className="input" defaultValue="">
              <option value="">未設定</option>
              {HEALTH_HAPPINESS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="口コミ・紹介">
          <div className="flex flex-col gap-2 rounded-md border border-stone-200 bg-stone-50 p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" id="testimonialObtained" name="testimonialObtained" value="true" className="peer accent-emerald-800" />
              <label htmlFor="testimonialObtained">口コミを取得した</label>
              <span className="hidden items-center gap-1.5 text-stone-500 peer-checked:flex">
                取得日:
                <input type="date" name="testimonialObtainedDate" className="input py-1" />
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" id="referralGiven" name="referralGiven" value="true" className="peer accent-emerald-800" />
              <label htmlFor="referralGiven">紹介をしてくれた</label>
              <span className="hidden items-center gap-1.5 text-stone-500 peer-checked:flex">
                人数:
                <input type="number" name="referralCount" min={1} defaultValue={1} className="input py-1 w-20" />
              </span>
            </div>
          </div>
        </Field>

        <button type="submit" className="mt-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white w-fit">
          カルテを保存する
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

function TagCheckboxes({ name, options }: { name: string; options: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-stone-200 bg-stone-50 p-3">
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-1.5 text-sm text-stone-700">
          <input type="checkbox" name={name} value={opt} className="accent-emerald-800" />
          {opt}
        </label>
      ))}
    </div>
  );
}
