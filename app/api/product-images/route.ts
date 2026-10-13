import { NextResponse } from "next/server";
import { supabaseAdmin, RESULTS_BUCKET } from "@/lib/supabase";
import { PRODUCT_IMAGES_PREFIX, isProductId } from "@/lib/products";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// GET ?product=<id> — original photos stored for one product, newest first.
export async function GET(req: Request) {
  const product = new URL(req.url).searchParams.get("product");
  if (!isProductId(product)) {
    return errorResponse("INVALID_PRODUCT", "알 수 없는 제품입니다.", 400);
  }

  const bucket = supabaseAdmin().storage.from(RESULTS_BUCKET);
  const { data, error } = await bucket.list(`${PRODUCT_IMAGES_PREFIX}/${product}`, {
    limit: 1000,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) {
    return errorResponse("STORAGE_ERROR", `이미지 목록을 불러오지 못했습니다: ${error.message}`, 502);
  }

  const images = (data ?? [])
    .filter((f) => !f.name.startsWith("."))
    .map((f) => {
      const path = `${PRODUCT_IMAGES_PREFIX}/${product}/${f.name}`;
      return { path, name: f.name, url: bucket.getPublicUrl(path).data.publicUrl };
    });

  return NextResponse.json({ images });
}

// POST { product, filename } — hands back a one-time signed upload URL so the
// browser can send the original file straight to Storage, bypassing the
// serverless 4.5MB request-body limit (originals are not downscaled).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!isProductId(body?.product)) {
    return errorResponse("INVALID_PRODUCT", "알 수 없는 제품입니다.", 400);
  }

  const rawExt = String(body?.filename ?? "").split(".").pop()?.toLowerCase() ?? "";
  const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : "jpg";
  const path = `${PRODUCT_IMAGES_PREFIX}/${body.product}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const bucket = supabaseAdmin().storage.from(RESULTS_BUCKET);
  const { data, error } = await bucket.createSignedUploadUrl(path);
  if (error || !data) {
    return errorResponse("STORAGE_ERROR", `업로드를 준비하지 못했습니다: ${error?.message ?? ""}`, 502);
  }

  return NextResponse.json({
    path,
    signedUrl: data.signedUrl,
    url: bucket.getPublicUrl(path).data.publicUrl,
  });
}

// DELETE { path } — removes one stored product photo.
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  const path = String(body?.path ?? "");
  const match = path.match(new RegExp(`^${PRODUCT_IMAGES_PREFIX}/([a-z]+)/[A-Za-z0-9._-]+$`));
  if (!match || !isProductId(match[1])) {
    return errorResponse("INVALID_PATH", "잘못된 파일 경로입니다.", 400);
  }

  const { error } = await supabaseAdmin().storage.from(RESULTS_BUCKET).remove([path]);
  if (error) {
    return errorResponse("STORAGE_ERROR", `이미지를 삭제하지 못했습니다: ${error.message}`, 502);
  }
  return NextResponse.json({ ok: true });
}
