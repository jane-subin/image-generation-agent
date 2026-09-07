import { NextResponse } from "next/server";

// Per-file cap keeps a multipart body with several images well under Vercel's
// 4.5MB hard request-body limit.
export const MAX_FILE_BYTES = 1.5 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function validateImageField(file: FormDataEntryValue | null, label: string) {
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
