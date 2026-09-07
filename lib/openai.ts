import OpenAI from "openai";
import type { StyleCardKey } from "@/lib/cardConfig";

// Lazily constructed so importing this module (e.g. Next.js collecting route
// config at build time) never fails just because env vars aren't loaded yet.
let _openai: OpenAI | null = null;
function client(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-5.6-luna";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";

const SHARED_GUARD = `이 사진 속 인물이 들고 있거나 착용한 가방·캐리어 등 '제품'으로 보이는 물건이 있어도, 그 물건의 디자인·색상·형태·브랜드·재질은 절대 설명하지 마라 (실제 제품은 별도 사진으로 제공된다).
다른 설명 없이 묘사 문장만 한국어로 출력하라. 아래 지정된 항목 외의 요소(다른 카테고리에 해당하는 내용)는 언급하지 마라.`;

const CATEGORY_SYSTEM_PROMPTS: Record<StyleCardKey, string> = {
  appearance: `당신은 화보 촬영을 위해 사진 속 인물의 '외모'만 분석하는 전문가입니다.
아래 항목만 상세히 묘사하라: 인종/민족적 특징, 성별, 추정 연령대, 얼굴 생김새(눈·코·입·얼굴형 등 구체적 특징), 헤어스타일과 헤어 컬러.
의상, 포즈, 배경, 조명, 카메라 앵글 등 외모 이외의 요소는 절대 언급하지 마라.
${SHARED_GUARD}`,

  outfit: `당신은 화보 촬영을 위해 사진 속 인물의 '의상'만 분석하는 전문가입니다.
아래 항목만 상세히 묘사하라: 상의/하의/아우터의 종류, 색상, 소재, 핏, 액세서리.
인물의 얼굴 생김새, 헤어스타일, 포즈, 배경, 조명 등 의상 이외의 요소는 절대 언급하지 마라.
${SHARED_GUARD}`,

  pose: `당신은 화보 촬영을 위해 사진 속 인물의 '포즈/시선/표정'만 분석하는 전문가입니다.
아래 항목만 상세히 묘사하라: 신체 자세와 포즈, 시선 방향, 표정, 함께 등장하는 소품, 연출된 상황(예: 걷는 중, 웃는 중, 무언가를 가리키는 중 등).
인물의 외모, 의상, 배경, 조명, 카메라 앵글 등 포즈 이외의 요소는 절대 언급하지 마라.
${SHARED_GUARD}`,

  background: `당신은 화보 촬영을 위해 사진의 '배경'만 분석하는 전문가입니다.
아래 항목만 상세히 묘사하라: 장소/공간, 시간대, 그 장소가 자아내는 전체적인 분위기.
인물의 외모, 의상, 포즈, 조명 디테일, 카메라 구도 등 배경 이외의 요소는 절대 언급하지 마라.
${SHARED_GUARD}`,

  technique: `당신은 화보 촬영을 위해 사진의 '촬영 기법'만 분석하는 전문가입니다.
아래 항목만 상세히 묘사하라: 조명의 방향과 질감(하이라이트/그림자), 사진의 색감과 톤앤매너, 카메라 종류로 추정되는 특성(예: 필름카메라 느낌, 디지털 느낌, 휴대폰 카메라 느낌), 렌즈 특성(피사계심도, 보케 등).
인물의 외모, 의상, 포즈, 배경 장소 등 촬영 기법 이외의 요소는 절대 언급하지 마라.
${SHARED_GUARD}`,

  composition: `당신은 화보 촬영을 위해 사진의 '카메라 구도'만 분석하는 전문가입니다.
아래 항목만 상세히 묘사하라: 샷 사이즈(클로즈업/상반신/전신 등), 카메라 앵글(하이앵글/로우앵글/아이레벨), 프레이밍 방식.
인물의 외모, 의상, 포즈, 배경, 조명 등 구도 이외의 요소는 절대 언급하지 마라.
${SHARED_GUARD}`,

  model: `당신은 화보 촬영을 위해 사진 속 인물의 '외모', '의상', '포즈/시선/표정'을 종합적으로 분석하는 전문가입니다.
아래 세 항목을 모두 포함해 하나의 문단으로 상세히 묘사하라:
- 외모: 인종/민족적 특징, 성별, 추정 연령대, 얼굴 생김새(눈·코·입·얼굴형 등 구체적 특징), 헤어스타일과 헤어 컬러
- 의상: 상의/하의/아우터의 종류, 색상, 소재, 핏, 액세서리
- 포즈/시선/표정: 신체 자세와 포즈, 시선 방향, 표정, 함께 등장하는 소품, 연출된 상황
배경, 장소, 조명, 카메라 앵글/구도 등 위 세 항목 이외의 요소는 절대 언급하지 마라.
${SHARED_GUARD}`,

  mood: `당신은 화보 촬영을 위해 사진의 '배경', '촬영 기법', '카메라 구도'를 종합적으로 분석하는 전문가입니다.
아래 세 항목을 모두 포함해 하나의 문단으로 상세히 묘사하라:
- 배경: 장소/공간, 시간대, 전체적인 분위기
- 촬영 기법: 조명의 방향과 질감, 사진의 색감과 톤앤매너, 카메라 종류로 추정되는 특성, 렌즈 특성(피사계심도 등)
- 카메라 구도: 샷 사이즈, 카메라 앵글, 프레이밍 방식
인물의 외모, 의상, 포즈 등 위 세 항목 이외의 요소는 절대 언급하지 마라.
${SHARED_GUARD}`,
};

async function fileToDataUrl(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

export async function describeCard(file: File, category: StyleCardKey): Promise<string> {
  const dataUrl = await fileToDataUrl(file);

  const response = await client().chat.completions.create({
    model: VISION_MODEL,
    messages: [
      { role: "system", content: CATEGORY_SYSTEM_PROMPTS[category] },
      {
        role: "user",
        content: [
          { type: "text", text: "이 사진을 분석해서 위 지침대로 설명해줘." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  const description = response.choices[0]?.message?.content?.trim();
  if (!description) {
    throw new Error("이미지 분석에 실패했습니다.");
  }
  return description;
}

const REALISM_KEYWORDS = [
  "iPhone camera",
  "skin pores",
  "vellus hair",
  "subsurface scattering",
  "micro-imperfections",
  "natural lighting",
  "depth of field",
  "film grain/noise",
];

export type PromptSection = { label: string; text: string };

function buildComposePrompt(sections: PromptSection[]): string {
  const sceneBlock = sections.length
    ? sections.map((s) => `- ${s.label}: ${s.text}`).join("\n")
    : "- 별도로 명시된 요소가 없으므로, 심플하고 자연스러운 라이프스타일/스튜디오 화보 스타일로 자유롭게 구성하라.";

  return `첨부된 제품 사진 속 제품을 정확히 그대로 활용하여, 포토리얼리스틱한 화보/광고 사진 한 장을 생성하라.

[필수 규칙]
- 제품이 한눈에 잘 보이도록 화면 중앙 쪽에 배치하라.
- 배경 요소는 복잡하지 않게 단순화하거나 아웃포커싱(보케) 처리하라.
- 제품의 형태, 색상, 로고, 브랜딩, 비율은 첨부 사진과 완전히 동일하게 유지하고 절대 변형하지 마라.

[사실적 묘사 참고 키워드] (아래 장면 설정과 어울리는 것만 자연스럽게 반영하라, 전부 억지로 넣지 말 것)
${REALISM_KEYWORDS.join(", ")}

[장면 설정]
${sceneBlock}`;
}

export async function generateComposite(
  productFile: File,
  sections: PromptSection[],
): Promise<Buffer> {
  const prompt = buildComposePrompt(sections);

  const params: OpenAI.ImageEditParamsNonStreaming = {
    model: IMAGE_MODEL,
    image: productFile,
    prompt,
    n: 1,
    // 3:4 portrait ratio. gpt-image-2 requires both edges to be multiples of 16;
    // 1152x1536 = exactly 3:4 (1152/1536 = 0.75).
    size: "1152x1536",
    quality: "high",
    // gpt-image-2 has no input_fidelity knob (always high-fidelity) and rejects the
    // field if set; only gpt-image-1 needs this explicitly set to "high".
    input_fidelity: IMAGE_MODEL === "gpt-image-1" ? "high" : undefined,
  };

  const response = await client().images.edit(params);
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("이미지 생성에 실패했습니다.");
  }
  return Buffer.from(b64, "base64");
}
