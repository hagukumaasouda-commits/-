import { prisma } from "@/lib/prisma";
import { updateClient } from "@/app/actions/clients";
import { notFound } from "next/navigation";
import { RANK_OPTIONS } from "@/lib/tags";
import { DeleteClientButton } from "./delete-client-button";
import { MergeClientForm } from "./merge-client-form";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [client, channels, staff, clients, visitCount, productSaleCount] = await Promise.all([
    prisma.client.findUnique({ where: { id }, include: { prepaidCard: true } }),
    prisma.acquisitionChannel.findMany({ orderBy: { name: "asc" } }),
    prisma.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: { id: { not: id } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.visit.count({ where: { clientId: id } }),
    prisma.productSale.count({ where: { clientId: id } }),
  ]);
  if (!client) notFound();

  const prepaidBalance = client.prepaidCard
    ? (
        await prisma.prepaidTransaction.aggregate({
          where: { cardId: client.prepaidCard.id },
          _sum: { amount: true },
        })
      )._sum.amount ?? 0
    : null;

  const action = updateClient.bind(null, client.id);
  const referralSourceClientName = client.referralSourceClientId
    ? (clients.find((c) => c.id === client.referralSourceClientId)?.name ?? null)
    : null;

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-stone-900 mb-6">顧客情報を編集</h1>
      <form action={action} className="flex flex-col gap-4">
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
              defaultChecked={client.registrationType === "NEW"}
              className="accent-emerald-800"
            />
            <label htmlFor="regTypeNew">新規</label>
            <input
              type="radio"
              id="regTypeExisting"
              name="registrationType"
              value="EXISTING"
              required
              defaultChecked={client.registrationType === "EXISTING"}
              className="accent-emerald-800"
            />
            <label htmlFor="regTypeExisting">既存(データ移行)</label>
          </div>
        </div>
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
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-stone-600">紹介元(誰の紹介か)</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-stone-200 bg-stone-50 p-3">
            <input
              type="radio"
              id="refSrcExisting"
              name="referralSourceType"
              value="EXISTING_CLIENT"
              defaultChecked={client.referralSourceType === "EXISTING_CLIENT"}
              className="peer/existing accent-emerald-800"
            />
            <label htmlFor="refSrcExisting">既存患者</label>
            <input
              type="radio"
              id="refSrcStaff"
              name="referralSourceType"
              value="STAFF"
              defaultChecked={client.referralSourceType === "STAFF"}
              className="peer/staff accent-emerald-800"
            />
            <label htmlFor="refSrcStaff">スタッフ</label>
            <input
              type="radio"
              id="refSrcOther"
              name="referralSourceType"
              value="OTHER"
              defaultChecked={client.referralSourceType === "OTHER"}
              className="peer/other accent-emerald-800"
            />
            <label htmlFor="refSrcOther">その他</label>

            <input
              type="text"
              list="referral-client-options"
              name="referralSourceClientQuery"
              placeholder="氏名を入力して選択"
              autoComplete="off"
              defaultValue={referralSourceClientName ? `${referralSourceClientName} #${client.referralSourceClientId}` : ""}
              className="input hidden w-full peer-checked/existing:block"
            />
            <select
              name="referralSourceStaffId"
              defaultValue={client.referralSourceStaffId ?? ""}
              className="input hidden w-full peer-checked/staff:block"
            >
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
              defaultValue={client.referralSourceNote ?? ""}
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
          <select name="primaryStaffId" defaultValue={client.primaryStaffId ?? ""} className="input">
            <option value="">未選択</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ランク">
          <select name="rank" defaultValue={client.rank ?? ""} className="input">
            <option value="">未選択</option>
            {RANK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="来院回数(これまでの実績)">
          <input
            type="number"
            name="initialVisitCount"
            min={0}
            step={1}
            defaultValue={client.initialVisitCount}
            className="input"
          />
          <span className="text-xs text-stone-400">真の新患は0のまま。既存患者を登録する場合はこれまでの来院回数を入力</span>
        </Field>
        <Field label="既往">
          <textarea name="medicalHistory" rows={3} defaultValue={client.medicalHistory ?? ""} className="input" />
        </Field>
        <Field label="家族データ">
          <textarea name="familyData" rows={3} defaultValue={client.familyData ?? ""} className="input" />
        </Field>
        <Field label="個人データ">
          <textarea name="personalData" rows={3} defaultValue={client.personalData ?? ""} className="input" />
        </Field>
        <Field label="顕在ニーズ">
          <textarea name="manifestNeed" rows={2} defaultValue={client.manifestNeed ?? ""} className="input" placeholder="今困っていること" />
        </Field>
        <Field label="深層ニーズ">
          <textarea name="deepNeed" rows={2} defaultValue={client.deepNeed ?? ""} className="input" placeholder="本当のお困りごと" />
        </Field>
        <Field label="ウォンツ">
          <textarea name="wants" rows={2} defaultValue={client.wants ?? ""} className="input" placeholder="どうなったら嬉しいか" />
        </Field>

        <button type="submit" className="mt-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white w-fit">
          保存する
        </button>
      </form>

      <section className="mt-10 rounded-lg border border-stone-200 bg-stone-50 p-5">
        <h2 className="font-semibold text-stone-800 mb-1">危険な操作</h2>
        <p className="text-xs text-stone-500 mb-4">
          顧客情報を誤って二重に作成してしまった場合に使います。既に来院記録・プリカ・物販などの実データが入っている場合は、削除ではなく統合を選んでください。
        </p>

        <div className="flex flex-col gap-2 mb-4">
          <span className="text-sm font-medium text-stone-700">重複した顧客情報をこの顧客に統合する</span>
          <MergeClientForm clientId={client.id} clientName={client.name} mergeableClients={clients} />
        </div>

        <div className="flex flex-col gap-2 border-t border-stone-200 pt-4">
          <span className="text-sm font-medium text-stone-700">この顧客情報を削除する</span>
          <DeleteClientButton
            clientId={client.id}
            clientName={client.name}
            visitCount={visitCount}
            prepaidBalance={prepaidBalance}
            productSaleCount={productSaleCount}
          />
        </div>
      </section>
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
