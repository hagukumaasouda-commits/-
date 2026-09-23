// 見立てカンペ(東洋医学リファレンス)。docs/basic-exam-cheatsheet-spec-v2.md
// 編集不可の静的な参照コンテンツ。評価欄の直前に折りたたみ表示する。

const YIN_YANG_ROWS: { axis: string; yang: string; yin: string }[] = [
  { axis: "顔色・肌", yang: "赤み・つや・脂性寄り", yin: "青白い・くすみ・乾燥寄り" },
  { axis: "声・話し方", yang: "声が大きい・早口", yin: "声が小さい・話すのがゆっくり" },
  { axis: "痛みの性質", yang: "熱感を伴う・突き刺すような鋭い痛み", yin: "冷えを伴う・鈍く重だるい痛み" },
  { axis: "体温感覚", yang: "暑がり・手足がほてる", yin: "寒がり・手足が冷える" },
  { axis: "エネルギー", yang: "興奮気味・じっとしていられない", yin: "静か・億劫・横になりたがる" },
];

const QI_BLOOD_FLUID_ROWS: { type: string; sign: string; direction: string }[] = [
  { type: "気虚", sign: "疲れやすい・息切れ・声に力がない・汗をかきやすい", direction: "補気(元気を補う)。無理な発汗・過度な施術は避ける" },
  { type: "気滞", sign: "張った痛み・ため息が多い・イライラ・喉の詰まり感", direction: "疏肝理気(気の巡りを良くする)。呼吸・ストレッチ指導と相性が良い" },
  { type: "血虚", sign: "顔色が白い・めまい・爪が割れやすい・不眠", direction: "補血。強い刺激を避け、ゆるやかな施術で栄養を巡らせる" },
  { type: "瘀血", sign: "刺すような固定痛・shim(暗)い顔色・クマ・生理の塊", direction: "活血化瘀(血の巡りを良くする)。硬結部への丁寧なアプローチ" },
  { type: "津液不足", sign: "口や肌の乾燥・便が硬い・空咳", direction: "滋陰(潤いを補う)。水分摂取指導と合わせる" },
  { type: "痰湿", sign: "むくみ・体が重だるい・粘った痰や鼻水・舌苔が厚い", direction: "化痰利湿(余分な水分・老廃物を捌く)。リンパ・排水系の施術と相性が良い" },
];

const ZANGFU_ROWS: { organ: string; complaints: string }[] = [
  { organ: "肝", complaints: "肩こり・首こり・イライラ・眼精疲労・生理不順・PMS" },
  { organ: "心", complaints: "不眠・動悸・不安感・物忘れ" },
  { organ: "脾", complaints: "胃腸不良・食欲不振・むくみ・疲労感・軟便" },
  { organ: "肺", complaints: "冷えやすい・風邪をひきやすい・咳・肌の乾燥・呼吸の浅さ" },
  { organ: "腎", complaints: "腰痛・冷え・更年期症状・耳鳴り・老化に伴う不調・産前産後の不調" },
];

const EXAM_MAPPING_ROWS: { finding: string; frame: string }[] = [
  { finding: "重心軸のズレ・特定部位の筋緊張", frame: "気滞(気の巡りの偏り)。張り・こわばりが強い側を疏通する発想" },
  { finding: "全身の重さ・だるさ", frame: "気虚 または 痰湿。疲労感が強ければ気虚寄り、むくみ・重だるさが強ければ痰湿寄り" },
  { finding: "むくみ・関節や筋肉の硬さ", frame: "痰湿(水分代謝の停滞)。排水・巡りを促す施術方針と相性が良い" },
  { finding: "骨盤・仙腸関節のゆがみ", frame: "腎の弁証(腎は骨・生殖・老化と関連)。冷え・腰まわりの症状と合わせて確認する" },
];

export function MitateCheatsheet() {
  return (
    <details className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <summary className="cursor-pointer text-sm font-medium text-stone-700">見立てカンペを開く(東洋医学リファレンス)</summary>

      <div className="mt-3 flex flex-col gap-5 text-xs text-stone-700">
        <section>
          <h3 className="mb-1 font-semibold text-stone-800">陰陽:最初の10秒判断</h3>
          <CheatTable
            headers={["観点", "陽証寄り", "陰証寄り"]}
            rows={YIN_YANG_ROWS.map((r) => [r.axis, r.yang, r.yin])}
          />
        </section>

        <section>
          <h3 className="mb-1 font-semibold text-stone-800">気血津液弁証</h3>
          <CheatTable
            headers={["分類", "症状サイン", "施術方向性"]}
            rows={QI_BLOOD_FLUID_ROWS.map((r) => [r.type, r.sign, r.direction])}
          />
        </section>

        <section>
          <h3 className="mb-1 font-semibold text-stone-800">臓腑弁証</h3>
          <CheatTable
            headers={["臓腑", "関連する主訴例"]}
            rows={ZANGFU_ROWS.map((r) => [r.organ, r.complaints])}
          />
        </section>

        <section>
          <h3 className="mb-1 font-semibold text-stone-800">基本検査と見立てフレームのつながり</h3>
          <CheatTable
            headers={["基本検査所見", "対応する見立てフレーム"]}
            rows={EXAM_MAPPING_ROWS.map((r) => [r.finding, r.frame])}
          />
        </section>
      </div>
    </details>
  );
}

function CheatTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="text-left text-stone-500 border-b border-stone-200">
          {headers.map((h) => (
            <th key={h} className="py-1 pr-2 font-normal align-top">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-stone-100 last:border-0">
            {row.map((cell, j) => (
              <td key={j} className="py-1 pr-2 align-top">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
