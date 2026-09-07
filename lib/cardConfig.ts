// Shared between the client (rendering the upload cards, building FormData
// field names) and the server (parsing those same field names). `emoji` is
// UI decoration only — `label` (plain text) is what actually goes into the
// generation prompt, so it stays emoji-free.

export const CARD_GROUPS = [
  {
    aggregateKey: "model",
    aggregateLabel: "모델 전체",
    aggregateEmoji: "💃",
    aggregateHint: "외모+의상+포즈를 한 장으로 종합 분석",
    individual: [
      { key: "appearance", label: "모델 외모", emoji: "👩🏻", hint: "인종·성별·나이·구체적인 외모, 헤어스타일" },
      { key: "outfit", label: "모델 의상", emoji: "👕", hint: "상의/하의/아우터, 색상, 소재, 핏" },
      { key: "pose", label: "모델 포즈/시선/표정", emoji: "🚶🏻‍♀️", hint: "포즈, 시선, 표정, 소품, 상황 연출" },
    ],
  },
  {
    aggregateKey: "mood",
    aggregateLabel: "무드 전체",
    aggregateEmoji: "🌃",
    aggregateHint: "배경+촬영 기법+카메라 구도를 한 장으로 종합 분석",
    individual: [
      { key: "background", label: "배경", emoji: "🏢", hint: "장소, 시간대, 분위기" },
      { key: "technique", label: "촬영 기법", emoji: "📸", hint: "무드/조명/질감, 카메라 종류, 렌즈&심도" },
      { key: "composition", label: "카메라 구도", emoji: "🤳🏻", hint: "샷 사이즈, 앵글" },
    ],
  },
] as const;

export type StyleCardKey =
  | "placement"
  | (typeof CARD_GROUPS)[number]["aggregateKey"]
  | (typeof CARD_GROUPS)[number]["individual"][number]["key"];

export function fieldNameFor(key: StyleCardKey): string {
  return `${key}Image`;
}

// Flat list of every category with a label, for the API route's generic
// per-field validation/collection loop and section-label lookups.
export const ALL_STYLE_CARDS: { key: StyleCardKey; label: string }[] = [
  { key: "placement", label: "제품 위치" },
  ...CARD_GROUPS.flatMap((group) => [{ key: group.aggregateKey, label: group.aggregateLabel }, ...group.individual]),
];

// key -> label lookup, so the server can determine a section's display label
// from a category key sent by the client without trusting client-sent text.
export const CATEGORY_LABEL: Record<StyleCardKey, string> = Object.fromEntries(
  ALL_STYLE_CARDS.map((c) => [c.key, c.label]),
) as Record<StyleCardKey, string>;

// The 7 categories selectable as tags on a reference-image slot (the 모델
// 전체/무드 전체 aggregates aren't offered here). 제품 위치 is listed last.
export const SELECTABLE_CATEGORIES: { key: StyleCardKey; label: string; emoji: string }[] = [
  ...CARD_GROUPS.flatMap((group) => group.individual.map((c) => ({ key: c.key, label: c.label, emoji: c.emoji }))),
  { key: "placement", label: "제품 위치", emoji: "🎒" },
];

export const REFERENCE_SLOT_COUNT = 4;
