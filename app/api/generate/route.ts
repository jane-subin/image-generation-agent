import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { describeCard, generateComposite, type PromptSection } from "@/lib/openai";
import { supabaseAdmin, RESULTS_BUCKET } from "@/lib/supabase";
import { ALL_STYLE_CARDS, fieldNameFor, type StyleCardKey } from "@/lib/cardConfig";

export const runtime = "nodejs";
// Up to 8 parallel vision calls (per-card analysis) plus the final
// high-quality image edit) plus a Supabase upload can vary a lot in latency.
// Set close to Vercel's Hobby-plan-with-Fluid-Compute ceiling (300s) for headroom.
export const maxDuration = 280;

// Per-file and combined caps keep the multipart body well under Vercel's 4.5MB
// hard request-body limit now that up to 7 images can be attached at once.
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function validateImageField(file: FormDataEntryValue | null, label: string) {
  if (!(file instanceof File)) {
    return errorResponse("MISSING_IMAGE", `${label} 이미지를 첨부해주세요.`, 400);
  }
  if (!file.type.startsWith("image/")) {
    return errorResponse("INVALID_FILE_TYPE", "이미지 파일만 업로드할 수 있습니다.", 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return errorResponse("FILE_TOO_LARGE", `${label} 이미지는 1.5MB 이하로 업로드해주세요.`, 413);
  }
  return null;
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return errorResponse("SERVER_MISCONFIGURED", "OPENAI_API_KEY가 설정되지 않았습니다.", 500);
  }
  const missingSupabaseVars = [
    !process.env.NEXT_PUBLIC_SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
    !process.env.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((v): v is string => Boolean(v));
  if (missingSupabaseVars.length > 0) {
    return errorResponse(
      "SERVER_MISCONFIGURED",
      `다음 환경변수가 비어있습니다: ${missingSupabaseVars.join(", ")}`,
      500,
    );
  }

  const form = await req.formData();

  const productImage = form.get("productImage");
  const productError = validateImageField(productImage, "제품");
  if (productError) return productError;
  const productFile = productImage as File;

  const styleFiles: { key: StyleCardKey; label: string; file: File }[] = [];
  for (const card of ALL_STYLE_CARDS) {
    const entry = form.get(fieldNameFor(card.key));
    if (entry == null) continue;
    const err = validateImageField(entry, card.label);
    if (err) return err;
    styleFiles.push({ key: card.key, label: card.label, file: entry as File });
  }

  const totalBytes = productFile.size + styleFiles.reduce((sum, s) => sum + s.file.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return errorResponse(
      "FILE_TOO_LARGE",
      "첨부한 이미지들의 합산 용량이 너무 큽니다. 이미지 수를 줄이거나 더 작은 이미지로 시도해주세요.",
      413,
    );
  }

  try {
    const sections: PromptSection[] = await Promise.all(
      styleFiles.map(async ({ key, label, file }) => ({
        label,
        text: await describeCard(file, key),
      })),
    );

    const imageBuffer = await generateComposite(productFile, sections);

    const path = `${randomUUID()}.png`;
    const { error: uploadError } = await supabaseAdmin()
      .storage.from(RESULTS_BUCKET)
      .upload(path, imageBuffer, { contentType: "image/png", upsert: false });

    if (uploadError) {
      return errorResponse("STORAGE_ERROR", "생성된 이미지를 저장하지 못했습니다.", 502);
    }

    const { data } = supabaseAdmin().storage.from(RESULTS_BUCKET).getPublicUrl(path);
    return NextResponse.json({ imageUrl: data.publicUrl, sections });
  } catch (err: unknown) {
    const e = err as { status?: number; error?: { message?: string }; message?: string };
    const status = typeof e?.status === "number" ? e.status : 502;
    const message = e?.error?.message ?? e?.message ?? "이미지 생성 중 오류가 발생했습니다.";
    const code = /safety|policy|moderation/i.test(message) ? "CONTENT_POLICY" : "OPENAI_ERROR";
    return errorResponse(code, message, status === 401 ? 500 : status);
  }
}
