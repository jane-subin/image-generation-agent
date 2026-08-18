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
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <div className="flex h-48 items-center justify-center overflow-hidden rounded-lg border border-dashed border-stone-300 bg-white">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm text-stone-400">클릭해서 이미지 선택</span>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        className="text-sm"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file && <span className="text-xs text-stone-400">{file.name}</span>}
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">이미지 생성 에이전트</h1>
        <p className="mt-1 text-sm text-stone-500">
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
          className="rounded-lg bg-stone-900 px-4 py-3 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "생성 중… (최대 2분 정도 걸릴 수 있어요)" : "이미지 생성"}
        </button>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error.message}</p>
      )}

      {resultUrl && (
        <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="생성된 이미지" className="w-full rounded-lg" />
          <button
            type="button"
            onClick={handleDownload}
            className="self-start rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
          >
            이미지 다운로드
          </button>
        </div>
      )}
    </main>
  );
}
