import { VisitInterval, HealthHappinessScore } from "@/app/generated/prisma/client";

// カルテのタグ選択肢。集計(来院理由・部位別分布)の粒度をここで揃える。
export const CHIEF_COMPLAINT_TAGS = [
  "肩こり",
  "腰痛",
  "頭痛",
  "自律神経症状",
  "姿勢改善",
  "冷えやむくみ",
  "関節の不調",
  "産前・産後のトラブル",
  "女性特有のお悩み",
  "胃腸不良",
  "不眠",
  "疲労感",
  "便秘・腸の不調",
  "しびれ・坐骨神経痛",
  "顎関節の不調",
  "交通事故・むち打ち",
  "スポーツ障害",
  "更年期",
  "生理痛・PMS",
] as const;

export const BODY_PART_TAGS = [
  "頭蓋",
  "内臓",
  "頸部",
  "胸椎",
  "腰椎",
  "骨盤",
  "上肢",
  "下肢",
  "脊椎",
  "体幹",
  "足",
  "手",
] as const;

// 施術メニュー表(参考価格。表示のみ、会計計算には連動させない)。
export const TREATMENT_MENU = [
  { name: "ベーシックケア", memberPrice: 4200, generalPrice: 4600 },
  { name: "リペアネスプラン", memberPrice: 5500, generalPrice: 6000 },
  { name: "コンディショニングプラン", memberPrice: 6800, generalPrice: 7300 },
  { name: "ウェルネスプラン", memberPrice: 8200, generalPrice: 8700 },
] as const;

// 必要来院ペース(docs/departure-followup-spec-v2.md v3、顧客管理シートの実際の選択肢と一致)。
// 表示名・enum・CSVインポートでのラベル逆引きの単一の情報源。
export const VISIT_INTERVAL_OPTIONS: { value: VisitInterval; label: string }[] = [
  { value: "TWICE_OR_THRICE_WEEKLY", label: "週2,3回" },
  { value: "WEEK1", label: "1週間" },
  { value: "DAY10", label: "10日" },
  { value: "WEEK2", label: "2週間" },
  { value: "WEEK3", label: "3週間" },
  { value: "WEEK4", label: "4週間" },
  { value: "MONTH2", label: "2か月" },
  { value: "MONTH3", label: "3か月" },
];
export const VISIT_INTERVAL_LABEL: Record<VisitInterval, string> = Object.fromEntries(
  VISIT_INTERVAL_OPTIONS.map((o) => [o.value, o.label])
) as Record<VisitInterval, string>;

// 回復度(健康度幸福度)。
export const HEALTH_HAPPINESS_OPTIONS: { value: HealthHappinessScore; label: string }[] = [
  { value: "ABOVE_80", label: "80%以上" },
  { value: "PCT_70", label: "70%" },
  { value: "PCT_60", label: "60%" },
  { value: "PCT_55", label: "55%" },
  { value: "PCT_50", label: "50%" },
  { value: "PCT_40", label: "40%" },
  { value: "BELOW_40", label: "40%以下" },
];
export const HEALTH_HAPPINESS_LABEL: Record<HealthHappinessScore, string> = Object.fromEntries(
  HEALTH_HAPPINESS_OPTIONS.map((o) => [o.value, o.label])
) as Record<HealthHappinessScore, string>;

// 生活習慣サポート実施状況(初回カルテVer1.0の項目をそのまま踏襲。社内略称のまま表示する)。
export const LIFESTYLE_SUPPORT_ITEMS = [
  "てる1",
  "てる2",
  "てる3",
  "水",
  "呼吸",
  "食分析",
  "酵素",
  "OK・NG",
  "コアレ",
  "ブースタ",
  "セラゼム",
  "ニュースキャン",
  "陰陽食",
  "靴・靴ひも",
  "睡眠",
  "姿勢",
  "立ち方",
  "座位",
  "デスク",
  "Bトレ",
] as const;
