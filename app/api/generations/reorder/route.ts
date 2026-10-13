import { NextResponse } from "next/server";
import { supabaseAdmin, GENERATIONS_TABLE } from "@/lib/supabase";

export const runtime = "nodejs";

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// POST { ids } — `ids` is the new order of the items currently shown in one
// gallery view. The order is global (shared by All / Best / Trash): the shown
// items are re-placed into the slots they already occupy in the global order,
// so items hidden from this view keep their place.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return fail("INVALID_IDS", "ids 배열이 필요합니다.", 400);
  }

  const { data, error } = await supabaseAdmin()
    .from(GENERATIONS_TABLE)
    .select("id, position")
    .order("position", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });
  if (error) {
    const hint = /position/i.test(error.message)
      ? " (Supabase에서 순서 저장용 position 컬럼 추가 SQL을 먼저 실행해주세요)"
      : "";
    return fail("STORAGE_ERROR", `순서를 저장하지 못했습니다: ${error.message}${hint}`, 502);
  }

  const rows = (data ?? []) as unknown as { id: string; position: number | null }[];
  const globalIds = rows.map((r) => r.id);
  const existing = new Set(globalIds);
  const orderedVisible = (ids as string[]).filter((id, i, arr) => existing.has(id) && arr.indexOf(id) === i);
  const visible = new Set(orderedVisible);

  const slots: number[] = [];
  globalIds.forEach((id, i) => {
    if (visible.has(id)) slots.push(i);
  });

  const nextGlobal = globalIds.slice();
  slots.forEach((slot, k) => {
    nextGlobal[slot] = orderedVisible[k];
  });

  const currentPosition = new Map(rows.map((r) => [r.id, r.position]));
  const changed = nextGlobal
    .map((id, index) => ({ id, index }))
    .filter(({ id, index }) => currentPosition.get(id) !== index);

  const CHUNK = 20;
  for (let i = 0; i < changed.length; i += CHUNK) {
    const results = await Promise.all(
      changed.slice(i, i + CHUNK).map(({ id, index }) =>
        supabaseAdmin().from(GENERATIONS_TABLE).update({ position: index }).eq("id", id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      return fail("STORAGE_ERROR", `순서를 저장하지 못했습니다: ${failed.error.message}`, 502);
    }
  }

  return NextResponse.json({ ok: true });
}
