import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { describeReferenceScene, generateComposite } from "@/lib/openai";
import { supabaseAdmin, RESULTS_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

// Combined request body must stay well under Vercel's 4.5MB hard cap.
const MAX_FILE_BYTES = 3 * 1024 * 1024;

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
    return errorResponse("FILE_TOO_LARGE", `${label} 이미지는 3MB 이하로 업로드해주세요.`, 413);
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
  const referenceImage = form.get("referenceImage");
  const productImage = form.get("productImage");

  const referenceError = validateImageField(referenceImage, "레퍼런스");
  if (referenceError) return referenceError;
  const productError = validateImageField(productImage, "제품");
  if (productError) return productError;

  try {
    const sceneDescription = await describeReferenceScene(referenceImage as File);
    const imageBuffer = await generateComposite(productImage as File, sceneDescription);

    const path = `${randomUUID()}.png`;
    const { error: uploadError } = await supabaseAdmin()
      .storage.from(RESULTS_BUCKET)
      .upload(path, imageBuffer, { contentType: "image/png", upsert: false });

    if (uploadError) {
      return errorResponse("STORAGE_ERROR", "생성된 이미지를 저장하지 못했습니다.", 502);
    }

    const { data } = supabaseAdmin().storage.from(RESULTS_BUCKET).getPublicUrl(path);
    return NextResponse.json({ imageUrl: data.publicUrl, sceneDescription });
  } catch (err: unknown) {
    const e = err as { status?: number; error?: { message?: string }; message?: string };
    const status = typeof e?.status === "number" ? e.status : 502;
    const message = e?.error?.message ?? e?.message ?? "이미지 생성 중 오류가 발생했습니다.";
    const code = /safety|policy|moderation/i.test(message) ? "CONTENT_POLICY" : "OPENAI_ERROR";
    return errorResponse(code, message, status === 401 ? 500 : status);
  }
}
