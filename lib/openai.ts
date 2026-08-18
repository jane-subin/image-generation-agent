import OpenAI from "openai";

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

const DESCRIBE_SYSTEM_PROMPT = `당신은 화보/광고 사진을 분석해서 이미지 생성용 프롬프트를 작성하는 전문가입니다.
첨부된 레퍼런스 사진을 보고, 아래 항목을 모두 포함한 하나의 상세한 문단을 한국어로 작성하세요:
- 등장 인물의 외모(헤어, 피부톤, 표정)와 스타일링(의상, 액세서리)
- 인물의 포즈와 동작, 인물 간의 상호작용
- 배경/장소, 시간대
- 전체적인 분위기와 무드
- 사진의 색감(color grading), 조명의 방향과 질감(하이라이트/그림자)
- 카메라 촬영 각도와 프레이밍(예: 로우앵글, 미디엄샷)
- 카메라/렌즈 특성으로 보이는 요소(피사계심도, 필름 그레인 등)

**가장 중요한 제약: 인물이 들고 있거나 착용한 가방/캐리어 등 '제품'으로 보이는 물건의 디자인, 색상, 형태, 브랜드, 재질에 대해서는 절대 설명하지 마세요.**
그 물건에 대해서는 오직 위치와 들고/착용하고 있는 방식만 중립적으로 언급하세요 (예: "오른손으로 가슴 앞에 안고 있다", "한쪽 어깨에 메고 있다"). 이는 이후 다른 제품으로 대체되기 때문입니다.

다른 설명 없이 묘사 문단만 출력하세요.`;

async function fileToDataUrl(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

export async function describeReferenceScene(referenceFile: File): Promise<string> {
  const dataUrl = await fileToDataUrl(referenceFile);

  const response = await client().chat.completions.create({
    model: VISION_MODEL,
    messages: [
      { role: "system", content: DESCRIBE_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "이 레퍼런스 사진을 분석해서 위 지침대로 설명해줘." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  const description = response.choices[0]?.message?.content?.trim();
  if (!description) {
    throw new Error("레퍼런스 이미지 분석에 실패했습니다.");
  }
  return description;
}

function buildComposePrompt(sceneDescription: string): string {
  return `첨부된 제품 사진 속 제품을 그대로 활용하여, 아래 장면 묘사에 맞는 포토리얼리스틱 화보/광고 사진을 생성하라.
제품의 디자인, 색상, 형태, 로고, 브랜딩, 비율은 첨부 사진과 완전히 동일하게 유지하고 절대 바꾸지 마라.

[장면 묘사]
${sceneDescription}`;
}

export async function generateComposite(
  productFile: File,
  sceneDescription: string,
): Promise<Buffer> {
  const prompt = buildComposePrompt(sceneDescription);

  const params: OpenAI.ImageEditParamsNonStreaming = {
    model: IMAGE_MODEL,
    image: productFile,
    prompt,
    n: 1,
    size: "auto",
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
