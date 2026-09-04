"use client";

import { useState } from "react";
import { resizeImageFile } from "@/lib/resizeImage";

type ApiError = { code: string; message: string };

function ImageDropField({
  label,
  file,
  preview,
  onChange,
}: {
  label: string;
  file: File | null;
  preview: string | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-blue-900">{label}</span>
      <div className="flex h-48 items-center justify-center overflow-hidden rounded-xl border border-dashed border-sky-200 bg-white/80">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm text-sky-300">클릭해서 이미지 선택</span>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        className="text-sm text-blue-800 file:mr-3 file:rounded-md file:border-0 file:bg-sky-100 file:px-3 file:py-1.5 file:text-blue-800 hover:file:bg-sky-200"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file && <span className="text-xs text-blue-300">{file.name}</span>}
    </label>
  );
}

export default function Home() {
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  function handleReferenceChange(file: File | null) {
    setReferenceFile(file);
    setReferencePreview(file ? URL.createObjectURL(file) : null);
    setResultUrl(null);
    setError(null);
  }

  function handleProductChange(file: File | null) {
    setProductFile(file);
    setProductPreview(file ? URL.createObjectURL(file) : null);
    setResultUrl(null);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!referenceFile || !productFile) return;

    setLoading(true);
    setError(null);
    setResultUrl(null);

    try {
      const [resizedReference, resizedProduct] = await Promise.all([
        resizeImageFile(referenceFile),
        resizeImageFile(productFile),
      ]);

      const body = new FormData();
      body.append("referenceImage", resizedReference);
      body.append("productImage", resizedProduct);

      const res = await fetch("/api/generate", { method: "POST", body });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? { code: "UNKNOWN", message: "요청 처리 중 오류가 발생했습니다." });
        return;
      }
      setResultUrl(json.imageUrl);
    } catch {
      setError({ code: "NETWORK", message: "서버에 연결할 수 없습니다." });
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = referenceFile && productFile && !loading;

  async function handleDownload() {
    if (!resultUrl) return;
    const res = await fetch(resultUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "generated.png";
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 px-4 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 rounded-3xl border border-white/60 bg-white/60 p-8 shadow-sm shadow-sky-100 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">이미지 생성 에이전트</h1>
          <p className="mt-1 text-sm text-blue-600">
            레퍼런스 이미지와 제품 사진을 첨부하면, 레퍼런스의 스타일로 제품 화보컷을 생성합니다.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ImageDropField
              label="레퍼런스 이미지"
              file={referenceFile}
              preview={referencePreview}
              onChange={handleReferenceChange}
            />
            <ImageDropField
              label="제품 사진"
              file={productFile}
              preview={productPreview}
              onChange={handleProductChange}
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-xl bg-gradient-to-r from-sky-200 to-blue-200 px-4 py-3 font-medium text-blue-950 transition hover:from-sky-300 hover:to-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "생성 중… (이미지에 따라 최대 4~5분 정도 걸릴 수 있어요)" : "이미지 생성"}
          </button>
        </form>

        {error && (
          <p className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">
            {error.message}
          </p>
        )}

        {resultUrl && (
          <div className="flex flex-col gap-3 rounded-2xl border border-sky-100 bg-white/90 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resultUrl} alt="생성된 이미지" className="w-full rounded-xl" />
            <button
              type="button"
              onClick={handleDownload}
              className="self-start rounded-xl bg-gradient-to-r from-cyan-100 to-sky-200 px-4 py-2 text-sm font-medium text-blue-950 transition hover:from-cyan-200 hover:to-sky-300"
            >
              이미지 다운로드
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
