import { NextResponse } from "next/server";
import { supabaseAdmin, GENERATIONS_TABLE, RESULTS_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

function fail(message: string) {
  return NextResponse.json({ error: { code: "STORAGE_ERROR", message } }, { status: 502 });
}

// Storage object path for a public URL of the results bucket, or null if the
// URL points somewhere else.
function storagePath(imageUrl: string): string | null {
  const marker = `/object/public/${RESULTS_BUCKET}/`;
  const i = imageUrl.indexOf(marker);
  if (i < 0) return null;
  return decodeURIComponent(imageUrl.slice(i + marker.length).split("?")[0]);
}

// DELETE — permanently removes everything currently in the Trash: the rows
// (their section_examples cascade) and the image files, except files that a
// non-trashed row still points to (the same result can be saved twice).
export async function DELETE() {
  const db = supabaseAdmin();

  const { data: trashed, error } = await db
    .from(GENERATIONS_TABLE)
    .select("id, image_url")
    .not("deleted_at", "is", null);
  if (error) return fail(`휴지통을 불러오지 못했습니다: ${error.message}`);

  const rows = (trashed ?? []) as unknown as { id: string; image_url: string }[];
  if (rows.length === 0) return NextResponse.json({ deleted: 0 });

  const { error: deleteError } = await db
    .from(GENERATIONS_TABLE)
    .delete()
    .in(
      "id",
      rows.map((r) => r.id),
    );
  if (deleteError) return fail(`휴지통을 비우지 못했습니다: ${deleteError.message}`);

  // Best effort from here on: the rows are already gone, so a leftover file
  // is harmless and must not turn this into a failure.
  const urls = Array.from(new Set(rows.map((r) => r.image_url)));
  const { data: stillUsed } = await db.from(GENERATIONS_TABLE).select("image_url").in("image_url", urls);
  const keep = new Set(((stillUsed ?? []) as unknown as { image_url: string }[]).map((r) => r.image_url));
  const paths = urls
    .filter((u) => !keep.has(u))
    .map(storagePath)
    .filter((p): p is string => p !== null);
  if (paths.length > 0) {
    await db.storage.from(RESULTS_BUCKET).remove(paths);
  }

  return NextResponse.json({ deleted: rows.length });
}
