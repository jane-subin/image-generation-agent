"use client";

import { useState } from "react";
import { resizeImageFile } from "@/lib/resizeImage";
import { STYLE_CARDS, fieldNameFor, type StyleCardKey } from "@/lib/cardConfig";

type ApiError = { code: string; message: string };
type Tone = "product" | "reference";

const TONE_CLASSES: Record<Tone, { label: string; border: string; placeholder: string }> = {
  product: {
    label: "text-amber-900",
    border: "border-amber-200",
    placeholder: "text-amber-300",
  },
  reference: {
    label: "text-blue-900",
    border: "border-sky-200",
    placeholder: "text-gray-400",
  },
};

function ImageDropField({
  label,
  hint,
  tone,
  file,
  preview,
  onChange,
}: {
  label: string;
  hint?: string;
  tone: Tone;
  file: File | null;
  preview: string | null;
  onChange: (file: File | null) => void;
}) {
  const c = TONE_CLASSES[tone];
  return (
    <label className="flex flex-col gap-2">
      <span className={`text-base font-medium ${c.label}`}>{label}</span>
      {hint && <span className="-mt-1 text-xs text-gray-400">{hint}</span>}
      <div
        className={`flex h-40 items-center justify-center overflow-hidden rounded-xl border border-dashed ${c.border} bg-white/80`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-contain" />
        ) : (
          <span className={`text-sm ${c.placeholder}`}>클릭해서 이미지 선택</span>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        className="text-sm text-gray-400 file:mr-3 file:rounded-md file:border-0 file:bg-sky-100 file:px-3 file:py-1.5 file:text-blue-800 hover:file:bg-sky-200"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file && <span className="text-xs text-gray-400">{file.name}</span>}
    </label>
  );
}

export default function Home() {
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);

  const [styleFiles, setStyleFiles] = useState<Partial<Record<StyleCardKey, File>>>({});
  const [stylePreviews, setStylePreviews] = useState<Partial<Record<StyleCardKey, string>>>({});

  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  function handleProductChange(file: File | null) {
    setProductFile(file);
    setProductPreview(file ? URL.createObjectURL(file) : null);
    setResultUrl(null);
    setError(null);
  }

  function handleStyleChange(key: StyleCardKey, file: File | null) {
    setStyleFiles((prev) => ({ ...prev, [key]: file ?? undefined }));
    setStylePreviews((prev) => ({ ...prev, [key]: file ? URL.createObjectURL(file) : undefined }));
    setResultUrl(null);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productFile) return;

    setLoading(true);
    setError(null);
    setResultUrl(null);

    try {
      const filledStyleEntries = STYLE_CARDS.filter((c) => styleFiles[c.key]).map((c) => ({
        key: c.key,
        file: styleFiles[c.key]!,
      }));

      const [resizedProduct, ...resizedStyleFiles] = await Promise.all([
        resizeImageFile(productFile),
        ...filledStyleEntries.map((entry) => resizeImageFile(entry.file)),
      ]);

      const body = new FormData();
      body.append("productImage", resizedProduct);
      filledStyleEntries.forEach((entry, i) => {
        body.append(fieldNameFor(entry.key), resizedStyleFiles[i]);
      });

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

  const canSubmit = !!productFile && !loading;

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
      <div className="mx-auto flex max-w-3xl flex-col gap-8 rounded-3xl border border-white/60 bg-white/60 p-8 shadow-sm shadow-sky-100 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">이미지 생성 에이전트</h1>
          <p className="mt-1 text-sm text-gray-500">
            제품 사진은 필수, 나머지 카드는 원하는 만큼만 첨부하세요. 첨부한 카드들의 설정을 모아 하나의 화보컷을 생성합니다.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
            <ImageDropField
              label="제품 사진 (필수)"
              tone="product"
              file={productFile}
              preview={productPreview}
              onChange={handleProductChange}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {STYLE_CARDS.map((card) => (
              <ImageDropField
                key={card.key}
                label={card.label}
                hint={card.hint}
                tone="reference"
                file={styleFiles[card.key] ?? null}
                preview={stylePreviews[card.key] ?? null}
                onChange={(file) => handleStyleChange(card.key, file)}
              />
            ))}
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
