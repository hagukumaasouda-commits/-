import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const clients = await prisma.client.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { kana: { contains: q } }] } : undefined,
    include: {
      primaryStaff: { select: { name: true } },
      acquisitionChannel: { select: { name: true } },
      _count: { select: { visits: true } },
      visits: { orderBy: { visitNo: "desc" }, take: 1, select: { visitDate: true } },
    },
    orderBy: { firstVisitDate: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-900">顧客一覧</h1>
        <form className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="氏名・カナで検索"
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm"
          />
          <button className="rounded-md bg-emerald-800 px-3 py-1.5 text-sm text-white">検索</button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="px-4 py-2 font-normal">氏名</th>
              <th className="px-4 py-2 font-normal">担当</th>
              <th className="px-4 py-2 font-normal">来店経路</th>
              <th className="px-4 py-2 font-normal text-right">来院回数</th>
              <th className="px-4 py-2 font-normal">最終来院</th>
              <th className="px-4 py-2 font-normal">初回来院</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                <td className="px-4 py-2">
                  <Link href={`/clients/${c.id}`} className="font-medium text-emerald-800 hover:underline">
                    {c.name}
                  </Link>
                  {!c.isActive && <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">離脱</span>}
                </td>
                <td className="px-4 py-2 text-stone-600">{c.primaryStaff?.name ?? "—"}</td>
                <td className="px-4 py-2 text-stone-600">{c.acquisitionChannel?.name ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{c._count.visits}</td>
                <td className="px-4 py-2 text-stone-600">
                  {c.visits[0] ? c.visits[0].visitDate.toISOString().slice(0, 10) : "—"}
                </td>
                <td className="px-4 py-2 text-stone-600">
                  {c.firstVisitDate ? c.firstVisitDate.toISOString().slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-stone-400">
                  該当する顧客がいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
