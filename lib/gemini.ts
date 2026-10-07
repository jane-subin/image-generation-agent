import { GoogleGenAI, Modality } from "@google/genai";

// Lazily constructed so importing this module (e.g. Next.js collecting route
// config at build time) never fails just because env vars aren't loaded yet.
let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _client;
}

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3-pro-image";
const IMAGE_SIZE = process.env.GEMINI_IMAGE_SIZE ?? "2K";

// Nano Banana Pro (Gemini 3 Pro Image). Takes the product photo as the only
// input image plus the final prompt text — same contract as the previous
// OpenAI-based generateComposite it replaces.
export async function generateComposite(productFile: File, prompt: string): Promise<Buffer> {
  const arrayBuffer = await productFile.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const response = await client().models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: productFile.type || "image/jpeg", data: base64 } },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
      // 3:4 portrait ratio, matching the previous gpt-image-2 setup.
      imageConfig: { aspectRatio: "3:4", imageSize: IMAGE_SIZE },
    },
  });

  // Gemini 3 Pro Image emits up to two interim "thought" images (rough
  // composition drafts) before the final render, so the FIRST image part is
  // often a draft with cropped/unbalanced framing. The final render is the
  // last non-thought image part.
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imageParts = parts.filter((p) => p.inlineData?.data);
  const finalPart =
    [...imageParts].reverse().find((p) => !p.thought) ?? imageParts[imageParts.length - 1];
  if (!finalPart?.inlineData?.data) {
    throw new Error("이미지 생성에 실패했습니다.");
  }
  return Buffer.from(finalPart.inlineData.data, "base64");
}
