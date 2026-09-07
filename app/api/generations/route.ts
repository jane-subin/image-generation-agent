import { NextResponse } from "next/server";
import { supabaseAdmin, GENERATIONS_TABLE } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const best = url.searchParams.get("best") === "1";

  let query = supabaseAdmin()
    .from(GENERATIONS_TABLE)
    .select("id, created_at, image_url, sections, score")
    .order("created_at", { ascending: false });

  if (best) {
    query = query.gte("score", 8);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: { code: "STORAGE_ERROR", message: "기록을 불러오지 못했습니다." } },
      { status: 502 },
    );
  }

  return NextResponse.json({ generations: data ?? [] });
}
