// Shared between the client (rendering the upload cards, building FormData
// field names) and the server (parsing those same field names).
export const CARD_GROUPS = [
  {
    aggregateKey: "model",
    aggregateLabel: "모델 카드",
    aggregateHint: "외모+의상+포즈를 한 장으로 종합 분석",
    individual: [
      { key: "appearance", label: "모델 외모", hint: "인종·성별·나이·구체적인 외모, 헤어스타일" },
      { key: "outfit", label: "모델 의상", hint: "상의/하의/아우터, 색상, 소재, 핏" },
      { key: "pose", label: "모델 포즈/시선/표정", hint: "포즈, 시선, 표정, 소품, 상황 연출" },
    ],
  },
  {
    aggregateKey: "mood",
    aggregateLabel: "무드 카드",
    aggregateHint: "배경+촬영 기법+카메라 구도를 한 장으로 종합 분석",
    individual: [
      { key: "background", label: "배경", hint: "장소, 시간대, 분위기" },
      { key: "technique", label: "촬영 기법", hint: "무드/조명/질감, 카메라 종류, 렌즈&심도" },
      { key: "composition", label: "카메라 구도", hint: "샷 사이즈, 앵글" },
    ],
  },
] as const;

export type StyleCardKey =
  | (typeof CARD_GROUPS)[number]["aggregateKey"]
  | (typeof CARD_GROUPS)[number]["individual"][number]["key"];

export function fieldNameFor(key: StyleCardKey): string {
  return `${key}Image`;
}

// Flat list of every optional card (aggregate + individual) with a label, for
// the API route's generic per-field validation/collection loop.
export const ALL_STYLE_CARDS: { key: StyleCardKey; label: string }[] = CARD_GROUPS.flatMap(
  (group) => [{ key: group.aggregateKey, label: group.aggregateLabel }, ...group.individual],
);
