import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { logout } from "@/app/actions/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "はぐくまCRM",
  description: "顧客管理・電子カルテ・気づきチェック・自動集計",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-3 flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold tracking-tight text-emerald-800">
              はぐくま CRM
            </Link>
            {session?.user && (
              <>
                <nav className="flex gap-4 text-sm text-stone-600">
                  <Link href="/dashboard" className="hover:text-emerald-800">
                    ダッシュボード
                  </Link>
                  <Link href="/clients" className="hover:text-emerald-800">
                    顧客一覧
                  </Link>
                  <Link href="/clients/new" className="hover:text-emerald-800">
                    新規顧客登録
                  </Link>
                  <Link href="/reminders" className="hover:text-emerald-800">
                    予約リマインド
                  </Link>
                  <Link href="/followups" className="hover:text-emerald-800">
                    フォローアップ
                  </Link>
                  <Link href="/reservations/import" className="hover:text-emerald-800">
                    予約CSV取り込み
                  </Link>
                  <Link href="/clients/import" className="hover:text-emerald-800">
                    顧客CSV取り込み
                  </Link>
                  <Link href="/products" className="hover:text-emerald-800">
                    物販売上
                  </Link>
                </nav>
                <div className="ml-auto flex items-center gap-3 text-sm text-stone-500">
                  <span>{session.user.name} さん</span>
                  <form action={logout}>
                    <button className="text-stone-400 hover:text-stone-700 underline">ログアウト</button>
                  </form>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
