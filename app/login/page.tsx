import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="text-xl font-semibold text-stone-900 mb-1">はぐくま CRM</h1>
      <p className="text-sm text-stone-500 mb-6">スタッフ用ログイン</p>
      <LoginForm callbackUrl={callbackUrl ?? "/dashboard"} />
    </div>
  );
}
