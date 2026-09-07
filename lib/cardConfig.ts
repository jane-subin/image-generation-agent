// Shared between the client (rendering the upload cards, building FormData
// field names) and the server (parsing those same field names).
export const STYLE_CARDS = [
  { key: "appearance", label: "모델 외모", hint: "인종·성별·나이·구체적인 외모, 헤어스타일" },
  { key: "outfit", label: "모델 의상", hint: "상의/하의/아우터, 색상, 소재, 핏" },
  { key: "pose", label: "모델 포즈/시선/표정", hint: "포즈, 시선, 표정, 소품, 상황 연출" },
  { key: "background", label: "배경", hint: "장소, 시간대, 분위기" },
  { key: "technique", label: "촬영 기법", hint: "무드/조명/질감, 카메라 종류, 렌즈&심도" },
  { key: "composition", label: "카메라 구도", hint: "샷 사이즈, 앵글" },
] as const;

export type StyleCardKey = (typeof STYLE_CARDS)[number]["key"];

export function fieldNameFor(key: StyleCardKey): string {
  return `${key}Image`;
}
