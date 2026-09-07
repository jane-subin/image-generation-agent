import { NextResponse } from "next/server";
import { supabaseAdmin, GENERATIONS_TABLE, SECTION_EXAMPLES_TABLE } from "@/lib/supabase";
import type { PromptSection } from "@/lib/openai";

export const runtime = "nodejs";

// Body may include `score` (1-10, rate it), `deleted` (true = move to Trash,
// false = restore from Trash), or both.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json().catch(() => null);

  const updates: Record<string, unknown> = {};
  let scoreToApply: number | undefined;

  if (body?.score !== undefined) {
    const score = Number(body.score);
    if (!Number.isInteger(score) || score < 1 || score > 10) {
      return NextResponse.json(
        { error: { code: "INVALID_SCORE", message: "점수는 1~10 사이의 정수여야 합니다." } },
        { status: 400 },
      );
    }
    updates.score = score;
    scoreToApply = score;
  }

  if (body?.deleted !== undefined) {
    updates.deleted_at = body.deleted ? new Date().toISOString() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: { code: "NO_CHANGES", message: "변경할 내용이 없습니다." } },
      { status: 400 },
    );
  }

  const { data: generation, error: fetchError } = await supabaseAdmin()
    .from(GENERATIONS_TABLE)
    .select("sections")
    .eq("id", id)
    .single();

  if (fetchError || !generation) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "해당 기록을 찾을 수 없습니다." } },
      { status: 404 },
    );
  }

  const { error: updateError } = await supabaseAdmin()
    .from(GENERATIONS_TABLE)
    .update(updates)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      {
        error: {
          code: "STORAGE_ERROR",
          message: `변경 사항을 저장하지 못했습니다: ${updateError.message}`,
        },
      },
      { status: 502 },
    );
  }

  if (scoreToApply !== undefined) {
    // Refresh this generation's contribution to the few-shot example pool: clear
    // any previous rows for it, then re-add them only if the new score qualifies.
    await supabaseAdmin().from(SECTION_EXAMPLES_TABLE).delete().eq("generation_id", id);

    if (scoreToApply >= 8) {
      const sections = (generation.sections ?? []) as PromptSection[];
      if (sections.length > 0) {
        await supabaseAdmin()
          .from(SECTION_EXAMPLES_TABLE)
          .insert(
            sections.map((s) => ({
              generation_id: id,
              category: s.key,
              text: s.text,
              score: scoreToApply,
            })),
          );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
