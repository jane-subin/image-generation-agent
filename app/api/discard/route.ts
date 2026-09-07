import { NextResponse } from "next/server";
import { supabaseAdmin, RESULTS_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

// Cleans up the Storage object for a generated result the user chose not to
// save (휴지통 버튼) — no `generations` row was ever created for it, so
// there's nothing else to remove.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const imageUrl = body?.imageUrl;

  if (typeof imageUrl !== "string" || !imageUrl) {
    return NextResponse.json(
      { error: { code: "MISSING_IMAGE_URL", message: "imageUrl이 필요합니다." } },
      { status: 400 },
    );
  }

  const marker = `/${RESULTS_BUCKET}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx !== -1) {
    const path = imageUrl.slice(idx + marker.length);
    await supabaseAdmin()
      .storage.from(RESULTS_BUCKET)
      .remove([path])
      .then(
        () => {},
        () => {},
      );
  }

  return NextResponse.json({ ok: true });
}
