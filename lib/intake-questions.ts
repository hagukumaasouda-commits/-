// LINE事前問診フォームの質問項目。既存のGoogleフォーム(【はぐくま】お身体の健康状態に関する事前問診票)の
// 内容をそのまま踏襲する。LIFF入力フォーム(app/intake/intake-form.tsx)と、スタッフ向けの回答表示
// (app/clients/[id]/intake-response-section.tsx)の両方がこの配列を単一の情報源として使う。
//
// type:
//   "text"     - 一行テキスト
//   "textarea" - 複数行テキスト
//   "date"     - 日付
//   "radio"    - 単一選択(optionsから1つ)
//   "checkbox" - 複数選択(optionsから複数)
// otherOption: trueの場合、「その他」選択時の自由記述を `${key}Other` として別途保存する
// acquisitionChannel: trueの場合、optionsの代わりにAcquisitionChannelマスタ(DB)を選択肢に使う

export type IntakeQuestionType = "text" | "textarea" | "date" | "radio" | "checkbox";

export type IntakeQuestion = {
  key: string;
  label: string;
  type: IntakeQuestionType;
  required?: boolean;
  options?: readonly string[];
  otherOption?: boolean;
  acquisitionChannel?: boolean;
  note?: string;
};

export const INTAKE_QUESTIONS: readonly IntakeQuestion[] = [
  { key: "name", label: "お名前(氏名)", type: "text", required: true },
  { key: "kana", label: "フリガナ", type: "text", required: true },
  { key: "dob", label: "生年月日(西暦)", type: "date", required: true },
  { key: "age", label: "年齢", type: "text", required: true },
  { key: "gender", label: "性別", type: "radio", required: true, options: ["男", "女"], otherOption: true },
  { key: "phone", label: "お電話番号(携帯)", type: "text", required: true },
  { key: "postalCode", label: "郵便番号", type: "text", required: true },
  { key: "address", label: "ご住所", type: "text", required: true },
  { key: "acquisitionChannel", label: "当院をお知りになったきっかけ", type: "radio", acquisitionChannel: true },
  { key: "referralName", label: "「ご紹介」とお答えの方へ:どなたのご紹介ですか?", type: "text" },
  { key: "occupation", label: "ご職業", type: "text", note: "身体の負担の傾向を知るきっかけになります" },
  {
    key: "postureHabits",
    label: "普段よくする動作や姿勢を教えてください",
    type: "textarea",
    note: "例:長時間のパソコン作業、立ちっぱなし、子供の抱っこ、重い荷物の持ち運びなど",
  },
  {
    key: "chiefComplaint",
    label: "今一番気になるお悩みや症状はどこですか?",
    type: "radio",
    required: true,
    options: [
      "肩こり",
      "腰痛",
      "頭痛",
      "姿勢改善",
      "股関節・膝・肘・手・足などの関節の不調",
      "女性特有のお悩み(PMS、生理痛、更年期など)",
      "不眠(ぐっすり眠れない・スッキリ起きられない)",
      "疲労感・だるさが抜けない",
      "自律神経症状(めまい、動悸、息苦しさ、不安など)",
      "産前・産後のトラブル(骨盤のゆがみ、尿漏れ、身体の疲れなど)",
      "ダイエット・体質改善",
      "顔周辺のお悩み",
    ],
    otherOption: true,
  },
  {
    key: "bowelSigns",
    label: "現在の身体の状態【お腹・お通じのサイン】",
    type: "checkbox",
    options: ["便秘がち(週に数回程度)", "軟便・下痢になりやすい", "胃腸不良(胃もたれ、お腹が張るなど)"],
    otherOption: true,
  },
  {
    key: "circulationSigns",
    label: "【血流不足・自律神経のサイン】",
    type: "checkbox",
    options: ["冷えやむくみが強い", "目の疲れ・かすみ", "耳鳴り・めまい", "生理痛、生理不順、PMS(月経前症候群)", "尿漏れ"],
    otherOption: true,
  },
  {
    key: "fatigueMentalSigns",
    label: "【疲労・メンタルのサイン】",
    type: "checkbox",
    options: [
      "スッキリ起きられない",
      "眠りが浅い・よく眠れない",
      "疲れやすい、だるい",
      "ゆううつな気分になる、働く意欲がおきない",
      "思考力・集中力の低下、最近忘れっぽい",
      "毎日鬱々とした状態",
      "更年期症状",
    ],
    otherOption: true,
  },
  {
    key: "bodyShapeSigns",
    label: "【体型・お肌・その他のサイン】",
    type: "checkbox",
    options: ["つまずきやすい、力が入りにくい", "太りやすい", "痩せやすい", "肌トラブル"],
    otherOption: true,
  },
  {
    key: "pregnancy",
    label: "女性の方に質問です。現在妊娠している可能性はありますか。また出産経験はありますか。",
    type: "checkbox",
    options: ["妊娠中", "妊娠していない", "出産経験なし", "出産経験あり", "出産経験あり(難産)", "出産経験あり(帝王切開)"],
  },
  { key: "sleepHours", label: "普段の「平均睡眠時間」は何時間ですか?", type: "text" },
  {
    key: "drinks",
    label: "普段の「飲み物」でよく飲むものを教えてください",
    type: "checkbox",
    options: ["水(麦茶・ルイボスティーなどノンカフェイン含む)", "お茶(緑茶・ウーロン茶など)", "コーヒー", "ジュース・清涼飲料水", "アルコール"],
    otherOption: true,
  },
  {
    key: "waterIntake",
    label: "普段、1日に飲む「純粋なお水(ノンカフェインの麦茶・ルイボスティー含む)」の量はどのくらいですか?",
    type: "radio",
    options: ["500ml未満(コップ2杯以下)", "500ml〜1L程度", "1L〜1.5L程度", "1.5L以上"],
  },
  {
    key: "diet",
    label: "普段よく食べるもの、好んで食べるものはありますか?",
    type: "checkbox",
    options: [
      "甘いもの(白砂糖・スイーツなど)",
      "コンビニ食や総菜(食品添加物の多いもの)",
      "お肉や乳製品(動物性タンパク質)",
      "白米",
      "白いパン・うどん・パスタ(小麦・グルテン)",
      "揚げ物・スナック菓子(酸化した油)",
    ],
  },
  { key: "smoking", label: "タバコについて教えてください", type: "radio", options: ["吸わない", "吸う"] },
  { key: "dominantHand", label: "利き手はどちらですか?", type: "radio", options: ["右", "左"] },
  {
    key: "injuryHistory",
    label: "過去のケガや病歴はありますか?",
    type: "textarea",
    note: "例:交通事故、捻挫、ヘルニア、内臓などの手術、女性疾患など、覚えている範囲でご記入ください",
  },
  {
    key: "currentTreatment",
    label: "現在、病院で治療中の病気や、服用しているお薬はありますか?",
    type: "checkbox",
    options: ["貧血", "リウマチ", "高血圧", "骨粗鬆症", "高脂血症", "糖尿病", "不整脈", "心臓疾患", "脳血管障害", "悪性腫瘍"],
    otherOption: true,
  },
  {
    key: "preferredVisitDay",
    label: "来院しやすい曜日は何曜日ですか?",
    type: "checkbox",
    options: ["月曜日", "火曜日", "水曜日", "木曜日", "土曜日", "日曜日"],
  },
  {
    key: "otherClinicExperience",
    label: "これまでに他の整体院や整骨院、マッサージ等に行かれたことはありますか?",
    type: "textarea",
    note: "そこでの不安や「もっとこうして欲しかった」という経験、当店へ期待していることなどがあれば教えてください",
  },
] as const;
