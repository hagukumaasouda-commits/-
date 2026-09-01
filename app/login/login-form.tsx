"use client";

import { useActionState } from "react";
import { authenticate } from "@/app/actions/auth";

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-600">ユーザー名</span>
        <input name="username" required className="input" autoComplete="username" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-600">パスワード</span>
        <input type="password" name="password" required className="input" autoComplete="current-password" />
      </label>
      {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isPending ? "ログイン中…" : "ログイン"}
      </button>
    </form>
  );
}
