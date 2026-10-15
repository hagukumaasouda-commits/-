import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { IntakeForm } from "./intake-form";

export default async function IntakePage() {
  const [channels, session] = await Promise.all([
    prisma.acquisitionChannel.findMany({ orderBy: { name: "asc" } }),
    auth(),
  ]);
  const isStaff = !!session?.user;

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-lg font-semibold text-stone-900">【はぐくま】お身体の健康状態に関する事前問診票</h1>
      {isStaff && (
        <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          スタッフ入力モード: LINEをお持ちでない方の問診内容を、このページでそのまま代筆できます。
        </p>
      )}
      <p className="mt-3 text-sm text-stone-600 whitespace-pre-wrap">
        いつもはぐくまをご利用いただき、ありがとうございます。{"\n"}
        この問診票は、あなたの現在の健康状態を深く把握し、一時しのぎの痛みの緩和ではなく、「寝たら自然と治る、自己回復力の高いお身体」を一緒にはぐくむために使用します。
      </p>
      <p className="mt-2 text-xs text-stone-500">
        ※一部の項目はご来院時にスタッフが直接お伺いしますので、分かる範囲でお答えいただければ大丈夫です。
      </p>
      <div className="mt-6">
        <IntakeForm channels={channels} isStaff={isStaff} />
      </div>
    </div>
  );
}
