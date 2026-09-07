import { NextResponse } from "next/server";
import { describeCard, buildComposePrompt, type PromptSection } from "@/lib/openai";
import { fetchGoodExamples } from "@/lib/supabase";
import { REFERENCE_SLOT_COUNT, CATEGORY_LABEL, type StyleCardKey } from "@/lib/cardConfig";
import { errorResponse, validateImageField, MAX_TOTAL_BYTES } from "@/lib/validateImage";

export const runtime = "nodejs";
// Worst case is REFERENCE_SLOT_COUNT slots each tagged with every selectable
// category, run in parallel — bounded by the slowest single vision call, but
// keep the same generous ceiling as /api/generate for headroom.
export const maxDuration = 280;

const VALID_CATEGORIES = new Set<string>([
  "placement",
  "model",
  "appearance",
  "outfit",
  "pose",
  "mood",
  "background",
  "technique",
  "composition",
]);

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return errorResponse("SERVER_MISCONFIGURED", "OPENAI_API_KEY가 설정되지 않았습니다.", 500);
  }

  const form = await req.formData();

  const workItems: { file: File; category: StyleCardKey }[] = [];
  const attachedFiles: File[] = [];

  for (let i = 1; i <= REFERENCE_SLOT_COUNT; i++) {
    const fileEntry = form.get(`reference${i}Image`);
    if (fileEntry == null) continue;

    const err = validateImageField(fileEntry, `레퍼런스 이미지 ${i}`);
    if (err) return err;
    const file = fileEntry as File;
    attachedFiles.push(file);

    const categoriesRaw = form.get(`reference${i}Categories`);
    let categories: string[] = [];
    if (typeof categoriesRaw === "string" && categoriesRaw.length > 0) {
      try {
        const parsed = JSON.parse(categoriesRaw);
        if (Array.isArray(parsed)) categories = parsed.filter((c) => typeof c === "string");
      } catch {
        return errorResponse(
          "INVALID_CATEGORIES",
          `reference${i}Categories 형식이 올바르지 않습니다.`,
          400,
        );
      }
    }

    for (const category of categories) {
      if (!VALID_CATEGORIES.has(category)) {
        return errorResponse("INVALID_CATEGORIES", `알 수 없는 카테고리: ${category}`, 400);
      }
      workItems.push({ file, category: category as StyleCardKey });
    }
  }

  const totalBytes = attachedFiles.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return errorResponse(
      "FILE_TOO_LARGE",
      "첨부한 이미지들의 합산 용량이 너무 큽니다. 이미지 수를 줄이거나 더 작은 이미지로 시도해주세요.",
      413,
    );
  }

  try {
    const sections: PromptSection[] = await Promise.all(
      workItems.map(async ({ file, category }) => {
        const goodExamples = await fetchGoodExamples(category).catch(() => []);
        return {
          key: category,
          label: CATEGORY_LABEL[category],
          text: await describeCard(file, category, goodExamples),
        };
      }),
    );

    const koreanPrompt = buildComposePrompt(sections);

    return NextResponse.json({ sections, koreanPrompt });
  } catch (err: unknown) {
    const e = err as { status?: number; error?: { message?: string }; message?: string };
    const status = typeof e?.status === "number" ? e.status : 502;
    const message = e?.error?.message ?? e?.message ?? "프롬프트 생성 중 오류가 발생했습니다.";
    return errorResponse("OPENAI_ERROR", message, status === 401 ? 500 : status);
  }
}
