import { NextResponse } from "next/server";
import { supabaseAdmin, GENERATIONS_TABLE, SECTION_EXAMPLES_TABLE } from "@/lib/supabase";
import type { PromptSection } from "@/lib/openai";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? (url.searchParams.get("best") === "1" ? "best" : "all");

  let query = supabaseAdmin()
    .from(GENERATIONS_TABLE)
    .select("id, created_at, image_url, sections, score")
    .order("created_at", { ascending: false });

  if (view === "best") {
    query = query.gte("score", 8);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: { code: "STORAGE_ERROR", message: `기록을 불러오지 못했습니다: ${error.message}` } },
      { status: 502 },
    );
  }

  return NextResponse.json({ generations: data ?? [] });
}

// Persists a generated result the user explicitly chose to keep (저장 버튼).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const imageUrl = body?.imageUrl;
  const sections = (body?.sections ?? []) as PromptSection[];
  const score = Number(body?.score);

  if (typeof imageUrl !== "string" || !imageUrl) {
    return NextResponse.json(
      { error: { code: "MISSING_IMAGE_URL", message: "imageUrl이 필요합니다." } },
      { status: 400 },
    );
  }
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    return NextResponse.json(
      { error: { code: "INVALID_SCORE", message: "점수는 1~10 사이의 정수여야 합니다." } },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin()
    .from(GENERATIONS_TABLE)
    .insert({ image_url: imageUrl, sections, score })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: { code: "STORAGE_ERROR", message: `저장하지 못했습니다: ${error?.message ?? "알 수 없는 오류"}` } },
      { status: 502 },
    );
  }

  if (score >= 8 && sections.length > 0) {
    await supabaseAdmin()
      .from(SECTION_EXAMPLES_TABLE)
      .insert(sections.map((s) => ({ generation_id: data.id, category: s.key, text: s.text, score })));
  }

  return NextResponse.json({ id: data.id });
}
