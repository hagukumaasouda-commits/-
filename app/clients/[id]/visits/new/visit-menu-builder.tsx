"use client";

import { useState } from "react";
import type { MenuPlan } from "@/app/generated/prisma/client";

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function VisitMenuBuilder({
  menuPlanOptions,
  chiefComplaintTags,
  treatmentModalityItems,
}: {
  menuPlanOptions: { value: MenuPlan; label: string }[];
  chiefComplaintTags: readonly string[];
  treatmentModalityItems: readonly string[];
}) {
  const [menuPlan, setMenuPlan] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [modalities, setModalities] = useState<string[]>([]);
  const [override, setOverride] = useState("");

  const planLabel = menuPlanOptions.find((o) => o.value === menuPlan)?.label ?? "";
  const autoText = `${planLabel}(${tags.join(",")})+${modalities.join(",")}`;
  const finalText = override.trim() ? override : autoText;

  return (
    <div className="flex flex-col gap-4 rounded-md border border-stone-200 bg-stone-50 p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-600">本日のメニュー(プラン)</span>
        <select name="menuPlan" className="input" value={menuPlan} onChange={(e) => setMenuPlan(e.target.value)}>
          <option value="">未選択</option>
          {menuPlanOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-stone-600">主訴タグ</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-stone-200 bg-white p-3">
          {chiefComplaintTags.map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 text-sm text-stone-700">
              <input
                type="checkbox"
                name="chiefComplaintTags"
                value={opt}
                checked={tags.includes(opt)}
                onChange={() => setTags(toggle(tags, opt))}
                className="accent-emerald-800"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-stone-600">物療チェック</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-stone-200 bg-white p-3">
          {treatmentModalityItems.map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 text-sm text-stone-700">
              <input
                type="checkbox"
                name="treatmentModalities"
                value={opt}
                checked={modalities.includes(opt)}
                onChange={() => setModalities(toggle(modalities, opt))}
                className="accent-emerald-800"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-stone-600">表示テキスト(自動生成。下の欄に入力すると上書きされます)</span>
        <p className="rounded-md border border-stone-200 bg-white px-3 py-2 text-stone-700">{finalText}</p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-600">上書き(手動で微調整する場合)</span>
        <input
          className="input"
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          placeholder="入力するとこちらが優先されます"
        />
      </label>

      <input type="hidden" name="menu" value={finalText} />
    </div>
  );
}
