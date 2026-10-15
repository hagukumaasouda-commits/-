"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { submitIntakeResponse } from "@/app/actions/intake";
import { INTAKE_QUESTIONS, type IntakeQuestion } from "@/lib/intake-questions";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

export function IntakeForm({ channels, isStaff = false }: { channels: { id: string; name: string }[]; isStaff?: boolean }) {
  const [idToken, setIdToken] = useState("");
  // LIFF未設定、またはスタッフが代筆している場合は最初からready扱いにする(スタッフ自身のLINEログインに
  // リダイレクトされては困るため、スタッフ時はLIFF初期化自体を行わない)。その場合LINEとの自動突合はできない。
  const [liffReady, setLiffReady] = useState(!LIFF_ID || isStaff);
  const [liffError, setLiffError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!LIFF_ID || isStaff) return;
    import("@line/liff").then(async ({ default: liff }) => {
      try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        setIdToken(liff.getIDToken() ?? "");
      } catch {
        setLiffError("LINEとの連携に失敗しました。LINEアプリ内でこのページを開き直してください。");
      } finally {
        setLiffReady(true);
      }
    });
  }, [isStaff]);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    formData.set("idToken", idToken);
    const result = await submitIntakeResponse(formData);
    setSubmitting(false);
    if (result.ok) setSubmittedId(result.id);
    else setError(result.error);
  }

  if (submittedId) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-900">
        <p className="font-medium">問診票を送信しました。ご協力ありがとうございました。</p>
        <p className="mt-2 text-sm">ご来院時にスタッフが内容を確認いたします。</p>
        {isStaff && (
          <Link
            href={`/clients/new?intakeResponseId=${submittedId}`}
            className="mt-4 inline-block rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white"
          >
            この内容で新規顧客登録へ進む
          </Link>
        )}
      </div>
    );
  }

  if (!liffReady) {
    return <p className="text-sm text-stone-500">読み込み中…</p>;
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      {liffError && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{liffError}</p>
      )}
      {error && <p className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {INTAKE_QUESTIONS.map((q) => (
        <QuestionField key={q.key} question={q} channels={channels} />
      ))}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? "送信中…" : "送信する"}
      </button>
    </form>
  );
}

function QuestionField({ question: q, channels }: { question: IntakeQuestion; channels: { id: string; name: string }[] }) {
  const options = q.acquisitionChannel ? channels.map((c) => c.name) : (q.options ?? []);

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-stone-700">
        {q.label}
        {q.required && <span className="text-rose-600"> *</span>}
      </span>
      {q.note && <span className="text-xs text-stone-500">{q.note}</span>}

      {q.type === "text" && <input name={q.key} required={q.required} className="input" />}
      {q.type === "date" && <input type="date" name={q.key} required={q.required} className="input" />}
      {q.type === "textarea" && <textarea name={q.key} rows={3} required={q.required} className="input" />}

      {(q.type === "radio" || q.type === "checkbox") && (
        <div className="flex flex-col gap-1.5 rounded-md border border-stone-200 bg-stone-50 p-3">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2">
              <input type={q.type === "radio" ? "radio" : "checkbox"} name={q.key} value={opt} className="accent-emerald-800" />
              {opt}
            </label>
          ))}
          {q.otherOption && (
            <>
              <label className="flex items-center gap-2">
                <input type={q.type === "radio" ? "radio" : "checkbox"} name={q.key} value="その他" className="accent-emerald-800" />
                その他
              </label>
              <input name={`${q.key}Other`} placeholder="「その他」の場合はこちらにご記入ください" className="input" />
            </>
          )}
        </div>
      )}
    </div>
  );
}
