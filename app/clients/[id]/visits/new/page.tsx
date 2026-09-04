import { prisma } from "@/lib/prisma";
import { createVisit } from "@/app/actions/visits";
import { CHIEF_COMPLAINT_TAGS, BODY_PART_TAGS } from "@/lib/tags";
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

        <Field label="主訴タグ">
          <TagCheckboxes name="chiefComplaintTags" options={CHIEF_COMPLAINT_TAGS} />
        </Field>

        <Field label="施術部位タグ">
          <TagCheckboxes name="bodyPartTags" options={BODY_PART_TAGS} />
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

        <Field label="必要来院ペース">
          <select name="requiredVisitInterval" className="input" defaultValue="">
            <option value="">未設定</option>
            <option value="WEEKLY">週1回</option>
            <option value="BIWEEKLY">2週に1回</option>
            <option value="TRIWEEKLY">3週に1回</option>
            <option value="MONTHLY">月1回</option>
            <option value="MAINTENANCE">2ヶ月に1回(メンテナンス)</option>
          </select>
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
