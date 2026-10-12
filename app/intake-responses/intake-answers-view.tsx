import { INTAKE_QUESTIONS } from "@/lib/intake-questions";

export function IntakeAnswersView({ answers }: { answers: Record<string, string | string[]> }) {
  return (
    <dl className="flex flex-col gap-3 text-sm">
      {INTAKE_QUESTIONS.map((q) => {
        const value = answers[q.key];
        const otherValue = q.otherOption ? (answers[`${q.key}Other`] as string | undefined) : undefined;
        if (!value && !otherValue) return null;
        const display = Array.isArray(value) ? value.join("、") : value;
        return (
          <div key={q.key}>
            <dt className="text-xs text-stone-500">{q.label}</dt>
            <dd className="text-stone-800 whitespace-pre-wrap">
              {display}
              {otherValue && `${display ? "・" : ""}その他: ${otherValue}`}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
