import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { generateComposite, buildComposePrompt, type PromptSection } from "@/lib/openai";
import { supabaseAdmin, RESULTS_BUCKET } from "@/lib/supabase";
import { errorResponse, validateImageField } from "@/lib/validateImage";

export const runtime = "nodejs";
// A single high-quality gpt-image-2 edit call plus a Supabase upload can vary
// in latency. Set close to Vercel's Hobby-plan-with-Fluid-Compute ceiling
// (300s) for headroom.
export const maxDuration = 280;

// The vision analysis already happened in POST /api/compose — this route only
// takes the product photo plus the already-computed sections and generates.
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

  let sections: PromptSection[] = [];
  const sectionsRaw = form.get("sections");
  if (typeof sectionsRaw === "string" && sectionsRaw.length > 0) {
    try {
      const parsed = JSON.parse(sectionsRaw);
      if (Array.isArray(parsed)) sections = parsed;
    } catch {
      return errorResponse("INVALID_SECTIONS", "sections 형식이 올바르지 않습니다.", 400);
    }
  }

  try {
    // Rebuilt server-side from the structured sections — never trusts a
    // client-supplied prompt string for the actual generation call.
    const prompt = buildComposePrompt(sections);
    const imageBuffer = await generateComposite(productFile, prompt);

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
