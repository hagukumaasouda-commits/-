import { BODY_PART_TAGS, DISTORTION_TAGS, SPINE_DISTORTION_TAGS, TRI_STATE_OPTIONS } from "@/lib/tags";

export type TriState = "NONE" | "MILD" | "MARKED";
export type PresentAbsent = "PRESENT" | "ABSENT";

export type StandingExamDefaults = {
  distortion?: string[];
  transverseShift?: PresentAbsent | "";
  tripodArch?: "USED" | "NOT_USED" | "";
  weightAxis?: "NORMAL" | "DEVIATED" | "";
  muscleTensionAreas?: string[];
  muscleTensionNote?: string;
  flexionExtension?: TriState | "";
  flexionExtensionNote?: string;
  squatSingleLegNote?: string;
  sendanSuspected?: boolean;
  memo?: string;
};

export type SittingExamDefaults = {
  armWeight?: TriState | "";
  shoulderRom?: TriState | "";
  spineDistortionTags?: string[];
  pelvisStiffness?: TriState | "";
  distortion?: string[];
  transverseShift?: PresentAbsent | "";
  memo?: string;
};

export type SupineExamDefaults = {
  legWeight?: TriState | "";
  poplitealStagnation?: PresentAbsent | "";
  hipPelvisStiffness?: TriState | "";
  abdomenStiffness?: TriState | "";
  ribStiffness?: TriState | "";
  ribStiffnessNote?: string;
  neckStiffness?: TriState | "";
  headWeightTwist?: TriState | "";
  headWeightTwistNote?: string;
  memo?: string;
};

export function BasicExamSection({
  standing = {},
  sitting = {},
  supine = {},
}: {
  standing?: StandingExamDefaults;
  sitting?: SittingExamDefaults;
  supine?: SupineExamDefaults;
}) {
  return (
    <details className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <summary className="cursor-pointer text-sm font-medium text-stone-700">基本検査記録(立位・座位・背臥位)</summary>

      <div className="mt-3 flex flex-col gap-4">
        <details className="rounded-md border border-stone-200 bg-white p-3" open>
          <summary className="cursor-pointer text-sm text-stone-600">立位</summary>
          <div className="mt-3 flex flex-col gap-3">
            <TagField label="左右のゆがみ" name="standingDistortion" options={DISTORTION_TAGS} defaultValues={standing.distortion} />
            <RadioField
              label="トランズ(横ずれ)"
              name="standingTransverseShift"
              options={[
                { value: "PRESENT", label: "有" },
                { value: "ABSENT", label: "無" },
              ]}
              defaultValue={standing.transverseShift}
            />
            <RadioField
              label="三点アーチ"
              name="standingTripodArch"
              options={[
                { value: "USED", label: "使えている" },
                { value: "NOT_USED", label: "使えていない" },
              ]}
              defaultValue={standing.tripodArch}
            />
            <RadioField
              label="重心軸"
              name="standingWeightAxis"
              options={[
                { value: "NORMAL", label: "正常" },
                { value: "DEVIATED", label: "逸脱" },
              ]}
              defaultValue={standing.weightAxis}
            />
            <TagField label="筋緊張部位" name="standingMuscleTensionAreas" options={BODY_PART_TAGS} defaultValues={standing.muscleTensionAreas} />
            <TextField label="筋緊張部位 補足" name="standingMuscleTensionNote" defaultValue={standing.muscleTensionNote} />
            <RadioField label="前屈・後屈の所見" name="standingFlexionExtension" options={TRI_STATE_OPTIONS} defaultValue={standing.flexionExtension} />
            <TextField label="前屈・後屈の所見 補足" name="standingFlexionExtensionNote" defaultValue={standing.flexionExtensionNote} />
            <TextField label="しゃがみ動作・片足立ち(必要時)" name="standingSquatSingleLegNote" defaultValue={standing.squatSingleLegNote} />

            <div className="flex flex-wrap items-center gap-1.5 text-sm text-stone-700">
              <input
                type="checkbox"
                id="standingSendanSuspected"
                name="standingSendanSuspected"
                value="true"
                defaultChecked={standing.sendanSuspected}
                className="peer accent-emerald-800"
              />
              <label htmlFor="standingSendanSuspected">センダンの可能性あり(乳様突起・肩甲骨下角・腸骨稜の同側下がり)</label>
              <p className="hidden w-full rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 peer-checked:block">
                骨盤・仙骨・仙腸関節から整える方針を検討してください
              </p>
            </div>

            <TextField label="立位メモ" name="standingMemo" defaultValue={standing.memo} multiline />
          </div>
        </details>

        <details className="rounded-md border border-stone-200 bg-white p-3">
          <summary className="cursor-pointer text-sm text-stone-600">座位</summary>
          <div className="mt-3 flex flex-col gap-3">
            <RadioField label="腕の重さ" name="sittingArmWeight" options={TRI_STATE_OPTIONS} defaultValue={sitting.armWeight} />
            <RadioField label="肩の可動域" name="sittingShoulderRom" options={TRI_STATE_OPTIONS} defaultValue={sitting.shoulderRom} />
            <TagField
              label="脊椎のゆがみ・硬さ"
              name="sittingSpineDistortionTags"
              options={SPINE_DISTORTION_TAGS}
              defaultValues={sitting.spineDistortionTags}
            />
            <RadioField label="骨盤の硬さと歪み" name="sittingPelvisStiffness" options={TRI_STATE_OPTIONS} defaultValue={sitting.pelvisStiffness} />
            <TagField label="左右のゆがみ" name="sittingDistortion" options={DISTORTION_TAGS} defaultValues={sitting.distortion} />
            <RadioField
              label="トランズ(横ずれ)"
              name="sittingTransverseShift"
              options={[
                { value: "PRESENT", label: "有" },
                { value: "ABSENT", label: "無" },
              ]}
              defaultValue={sitting.transverseShift}
            />
            <TextField label="座位メモ" name="sittingMemo" defaultValue={sitting.memo} multiline />
          </div>
        </details>

        <details className="rounded-md border border-stone-200 bg-white p-3">
          <summary className="cursor-pointer text-sm text-stone-600">背臥位</summary>
          <div className="mt-3 flex flex-col gap-3">
            <RadioField label="下肢の重さ" name="supineLegWeight" options={TRI_STATE_OPTIONS} defaultValue={supine.legWeight} />
            <RadioField
              label="膝窩の滞り"
              name="supinePoplitealStagnation"
              options={[
                { value: "PRESENT", label: "有" },
                { value: "ABSENT", label: "無" },
              ]}
              defaultValue={supine.poplitealStagnation}
            />
            <RadioField
              label="股関節屈曲での硬さ・骨盤の硬さ"
              name="supineHipPelvisStiffness"
              options={TRI_STATE_OPTIONS}
              defaultValue={supine.hipPelvisStiffness}
            />
            <RadioField label="お腹の硬さ" name="supineAbdomenStiffness" options={TRI_STATE_OPTIONS} defaultValue={supine.abdomenStiffness} />
            <RadioField label="肋骨の硬さと開き" name="supineRibStiffness" options={TRI_STATE_OPTIONS} defaultValue={supine.ribStiffness} />
            <TextField label="肋骨の硬さと開き 補足" name="supineRibStiffnessNote" defaultValue={supine.ribStiffnessNote} />
            <RadioField label="頸部の硬さ" name="supineNeckStiffness" options={TRI_STATE_OPTIONS} defaultValue={supine.neckStiffness} />
            <RadioField label="頭の重さ・捻じれ" name="supineHeadWeightTwist" options={TRI_STATE_OPTIONS} defaultValue={supine.headWeightTwist} />
            <TextField label="頭の重さ・捻じれ 補足" name="supineHeadWeightTwistNote" defaultValue={supine.headWeightTwistNote} />
            <TextField label="背臥位メモ" name="supineMemo" defaultValue={supine.memo} multiline />
          </div>
        </details>
      </div>
    </details>
  );
}

function TagField({ label, name, options, defaultValues = [] }: { label: string; name: string; options: readonly string[]; defaultValues?: string[] }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-stone-600">{label}</span>
      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-stone-200 bg-stone-50 p-2">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-1.5 text-sm text-stone-700">
            <input type="checkbox" name={name} value={opt} defaultChecked={defaultValues.includes(opt)} className="accent-emerald-800" />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

function RadioField({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-stone-600">{label}</span>
      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-stone-200 bg-stone-50 p-2">
        <label className="flex items-center gap-1.5 text-sm text-stone-500">
          <input type="radio" name={name} value="" defaultChecked={!defaultValue} className="accent-emerald-800" />
          未選択
        </label>
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-1.5 text-sm text-stone-700">
            <input type="radio" name={name} value={opt.value} defaultChecked={defaultValue === opt.value} className="accent-emerald-800" />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function TextField({ label, name, defaultValue, multiline }: { label: string; name: string; defaultValue?: string; multiline?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-stone-600">{label}</span>
      {multiline ? (
        <textarea name={name} rows={2} className="input" defaultValue={defaultValue} />
      ) : (
        <input type="text" name={name} className="input" defaultValue={defaultValue} />
      )}
    </label>
  );
}
