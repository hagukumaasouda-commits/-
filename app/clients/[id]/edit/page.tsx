import { prisma } from "@/lib/prisma";
import { updateClient } from "@/app/actions/clients";
import { notFound } from "next/navigation";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [client, channels, staff, clients] = await Promise.all([
    prisma.client.findUnique({ where: { id } }),
    prisma.acquisitionChannel.findMany({ orderBy: { name: "asc" } }),
    prisma.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: { id: { not: id } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!client) notFound();

  const action = updateClient.bind(null, client.id);

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-stone-900 mb-6">顧客情報を編集</h1>
      <form action={action} className="flex flex-col gap-4">
        <Field label="氏名" required>
          <input name="name" required defaultValue={client.name} className="input" />
        </Field>
        <Field label="顧客番号">
          <input name="externalCustomerNo" defaultValue={client.externalCustomerNo ?? ""} className="input" placeholder="既存の顧客管理シートのID" />
        </Field>
        <Field label="カナ">
          <input name="kana" defaultValue={client.kana ?? ""} className="input" />
        </Field>
        <Field label="生年月日">
          <input type="date" name="dob" defaultValue={client.dob ? client.dob.toISOString().slice(0, 10) : ""} className="input" />
        </Field>
        <Field label="性別">
          <select name="gender" defaultValue={client.gender ?? ""} className="input">
            <option value="">未選択</option>
            <option value="女">女</option>
            <option value="男">男</option>
            <option value="その他">その他</option>
          </select>
        </Field>
        <Field label="電話番号">
          <input name="phone" defaultValue={client.phone ?? ""} className="input" />
        </Field>
        <Field label="郵便番号">
          <input name="postalCode" defaultValue={client.postalCode ?? ""} className="input" />
        </Field>
        <Field label="住所">
          <input name="address" defaultValue={client.address ?? ""} className="input" />
        </Field>
        <Field label="職業">
          <input name="occupation" defaultValue={client.occupation ?? ""} className="input" />
        </Field>
        <Field label="初回来院日">
          <input
            type="date"
            name="firstVisitDate"
            defaultValue={client.firstVisitDate ? client.firstVisitDate.toISOString().slice(0, 10) : ""}
            className="input"
          />
        </Field>
        <Field label="来店きっかけ">
          <select name="acquisitionChannelId" defaultValue={client.acquisitionChannelId ?? ""} className="input">
            <option value="">未選択</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="紹介元(誰の紹介か)">
          <select name="referredById" defaultValue={client.referredById ?? ""} className="input">
            <option value="">なし</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="主担当スタッフ">
          <select name="primaryStaffId" defaultValue={client.primaryStaffId ?? ""} className="input">
            <option value="">未選択</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="既往">
          <textarea name="medicalHistory" rows={3} defaultValue={client.medicalHistory ?? ""} className="input" />
        </Field>
        <Field label="家族データ">
          <textarea name="familyData" rows={3} defaultValue={client.familyData ?? ""} className="input" />
        </Field>

        <button type="submit" className="mt-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white w-fit">
          保存する
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
