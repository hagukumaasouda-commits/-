import { prisma } from "@/lib/prisma";
import { createClient } from "@/app/actions/clients";

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
        <Field label="氏名" required>
          <input name="name" required className="input" />
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
        <Field label="紹介元(誰の紹介か)">
          <select name="referredById" className="input">
            <option value="">なし</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
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
