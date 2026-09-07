"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resizeImageFile } from "@/lib/resizeImage";
import { SELECTABLE_CATEGORIES, REFERENCE_SLOT_COUNT, type StyleCardKey } from "@/lib/cardConfig";

type ApiError = { code: string; message: string };
type Tone = "product" | "reference" | "aggregate";
type Section = { key: string; label: string; text: string };
type ReferenceSlot = { file: File | null; preview: string | null; categories: StyleCardKey[] };

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

const TONE_CLASSES: Record<Tone, { label: string; border: string; box: string }> = {
  product: { label: "text-blue-900", border: "border-blue-200", box: "bg-blue-100/70" },
  reference: { label: "text-blue-900", border: "border-sky-200", box: "bg-sky-50/70" },
  aggregate: { label: "text-emerald-900", border: "border-emerald-200", box: "bg-emerald-50/70" },
};

function Card({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const c = TONE_CLASSES[tone];
  return <div className={`rounded-2xl border ${c.border} ${c.box} p-3`}>{children}</div>;
}

function ImageDropField({
  label,
  hint,
  tone,
  file,
  preview,
  onChange,
  compact,
}: {
  label: string;
  hint?: string;
  tone: Tone;
  file: File | null;
  preview: string | null;
  onChange: (file: File | null) => void;
  compact?: boolean;
}) {
  const c = TONE_CLASSES[tone];
  const [isDragging, setIsDragging] = useState(false);

  function handleDroppedFiles(files: FileList | null) {
    const f = files?.[0];
    if (f && f.type.startsWith("image/")) onChange(f);
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className={`text-sm font-medium ${c.label}`}>{label}</span>
      {hint && <span className="-mt-1 text-xs text-gray-400">{hint}</span>}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleDroppedFiles(e.dataTransfer.files);
        }}
        className={`relative flex ${compact ? "h-20" : "h-36"} items-center justify-center overflow-hidden rounded-xl border border-dashed transition-colors ${
          isDragging ? "border-blue-400 bg-blue-50/60" : "border-gray-300 bg-white/70"
        }`}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={label} className="h-full w-full object-contain" />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(null);
              }}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-xs text-gray-600 shadow hover:bg-rose-50 hover:text-rose-500"
              aria-label="이미지 삭제"
            >
              ✕
            </button>
          </>
        ) : (
          <span className="px-2 text-center text-xs text-gray-400">클릭하거나 드래그해서 이미지 선택</span>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function makeEmptySlots(): ReferenceSlot[] {
  return Array.from({ length: REFERENCE_SLOT_COUNT }, () => ({
    file: null,
    preview: null,
    categories: [],
  }));
}

export default function Home() {
  const router = useRouter();

  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);

  const [referenceSlots, setReferenceSlots] = useState<ReferenceSlot[]>(makeEmptySlots());

  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState<ApiError | null>(null);
  const [composedSections, setComposedSections] = useState<Section[] | null>(null);
  const [koreanPrompt, setKoreanPrompt] = useState("");

  const [loading, setLoading] = useState(false);
  const [generateError, setGenerateError] = useState<ApiError | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSections, setResultSections] = useState<Section[]>([]);
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  function resetCompose() {
    setComposedSections(null);
    setKoreanPrompt("");
    setComposeError(null);
  }

  function resetResult() {
    setResultUrl(null);
    setResultSections([]);
    setPendingScore(null);
    setGenerateError(null);
  }

  function handleProductChange(file: File | null) {
    setProductFile(file);
    setProductPreview(file ? URL.createObjectURL(file) : null);
    resetResult();
  }

  function handleSlotFileChange(index: number, file: File | null) {
    setReferenceSlots((prev) =>
      prev.map((slot, i) =>
        i === index
          ? { file, preview: file ? URL.createObjectURL(file) : null, categories: file ? slot.categories : [] }
          : slot,
      ),
    );
    resetCompose();
    resetResult();
  }

  function toggleSlotCategory(index: number, key: StyleCardKey) {
    setReferenceSlots((prev) =>
      prev.map((slot, i) =>
        i === index
          ? {
              ...slot,
              categories: slot.categories.includes(key)
                ? slot.categories.filter((k) => k !== key)
                : [...slot.categories, key],
            }
          : slot,
      ),
    );
    resetCompose();
    resetResult();
  }

  async function handleCompose() {
    setComposing(true);
    setComposeError(null);
    resetResult();
    try {
      const filledSlots = referenceSlots
        .map((slot, i) => ({ ...slot, index: i + 1 }))
        .filter((slot) => slot.file);

      const resizedSlots = await Promise.all(
        filledSlots.map((slot) => resizeImageFile(slot.file as File)),
      );

      const body = new FormData();
      filledSlots.forEach((slot, i) => {
        body.append(`reference${slot.index}Image`, resizedSlots[i]);
        body.append(`reference${slot.index}Categories`, JSON.stringify(slot.categories));
      });

      const res = await fetch("/api/compose", { method: "POST", body });
      const json = await res.json();

      if (!res.ok) {
        setComposeError(json.error ?? { code: "UNKNOWN", message: "프롬프트 생성에 실패했습니다." });
        return;
      }
      setComposedSections(json.sections ?? []);
      setKoreanPrompt(json.koreanPrompt ?? "");
    } catch {
      setComposeError({ code: "NETWORK", message: "서버에 연결할 수 없습니다." });
    } finally {
      setComposing(false);
    }
  }

  async function handleGenerateFinal() {
    if (!productFile || composedSections == null) return;

    setLoading(true);
    setGenerateError(null);
    setResultUrl(null);

    try {
      const resizedProduct = await resizeImageFile(productFile);

      const body = new FormData();
      body.append("productImage", resizedProduct);
      body.append("prompt", koreanPrompt);
      body.append("sections", JSON.stringify(composedSections));

      const res = await fetch("/api/generate", { method: "POST", body });
      const json = await res.json();

      if (!res.ok) {
        setGenerateError(json.error ?? { code: "UNKNOWN", message: "요청 처리 중 오류가 발생했습니다." });
        return;
      }
      setResultUrl(json.imageUrl);
      setResultSections(json.sections ?? []);
    } catch {
      setGenerateError({ code: "NETWORK", message: "서버에 연결할 수 없습니다." });
    } finally {
      setLoading(false);
    }
  }

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

  async function handleSave() {
    if (!resultUrl || pendingScore == null) return;
    setSaving(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: resultUrl, sections: resultSections, score: pendingScore }),
      });
      const json = await res.json();
      if (!res.ok) {
        setGenerateError(json.error ?? { code: "UNKNOWN", message: "저장에 실패했습니다." });
        return;
      }
      router.push(pendingScore >= 8 ? "/gallery/best" : "/gallery/all");
    } catch {
      setGenerateError({ code: "NETWORK", message: "서버에 연결할 수 없습니다." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 px-4 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="py-8">
          <h1 className="text-2xl font-bold text-blue-950">이미지 생성 에이전트</h1>
          <p className="mt-2 text-sm text-gray-500">
            이미지를 첨부하고 각 레퍼런스 이미지에 사용할 프롬프트 종류를 선택하세요. 프롬프트를 확인한 뒤 이미지를 생성합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* LEFT: image attachment */}
          <div className="flex flex-col gap-4">
            <Card tone="product">
              <ImageDropField
                label="제품 사진 (필수)"
                tone="product"
                file={productFile}
                preview={productPreview}
                onChange={handleProductChange}
              />
            </Card>

            <div className="grid grid-cols-2 gap-3">
              {referenceSlots.map((slot, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-2xl border border-sky-200 bg-sky-50/70 p-3">
                  <ImageDropField
                    label={`레퍼런스 이미지 ${i + 1}`}
                    tone="reference"
                    file={slot.file}
                    preview={slot.preview}
                    onChange={(file) => handleSlotFileChange(i, file)}
                    compact
                  />
                  {slot.file && (
                    <div className="flex flex-col gap-1">
                      {SELECTABLE_CATEGORIES.map((cat) => {
                        const selected = slot.categories.includes(cat.key);
                        return (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={() => toggleSlotCategory(i, cat.key)}
                            className={`rounded-md px-2 py-1 text-left text-sm font-medium transition ${
                              selected
                                ? "bg-blue-900 text-white"
                                : "border border-sky-200 bg-white text-blue-800 hover:bg-sky-100"
                            }`}
                          >
                            {cat.emoji} {cat.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCompose}
              disabled={composing}
              className="rounded-xl bg-gradient-to-r from-sky-200 to-blue-200 px-4 py-3 font-medium text-blue-950 transition hover:from-sky-300 hover:to-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {composing ? "프롬프트 분석 중…" : "프롬프트 생성"}
            </button>
            {composeError && (
              <p className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">
                {composeError.message}
              </p>
            )}
          </div>

          {/* RIGHT: prompt review + generate */}
          <div className="flex min-h-0 flex-col gap-3 rounded-2xl border border-sky-100 bg-white/80 p-4">
            <h2 className="shrink-0 text-base font-bold text-blue-950">최종 프롬프트</h2>

            {composedSections == null ? (
              <p className="text-sm text-gray-400">
                왼쪽에서 이미지를 첨부하고 카테고리를 선택한 뒤 &ldquo;프롬프트 생성&rdquo;을 눌러주세요.
              </p>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-1">
                <p className="shrink-0 text-xs font-medium text-gray-500">직접 수정할 수 있습니다</p>
                <textarea
                  value={koreanPrompt}
                  onChange={(e) => setKoreanPrompt(e.target.value)}
                  className="w-full min-h-0 flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700"
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerateFinal}
              disabled={!productFile || composedSections == null || loading}
              className="shrink-0 rounded-xl bg-blue-900 px-4 py-3 font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "생성 중… (이미지에 따라 최대 4~5분 정도 걸릴 수 있어요)" : "이미지 생성"}
            </button>
            {!productFile && <p className="text-xs text-gray-400">제품 사진을 먼저 첨부해주세요.</p>}
            {generateError && (
              <p className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">
                {generateError.message}
              </p>
            )}
          </div>
        </div>

        {resultUrl && (
          <div className="flex flex-col gap-3 rounded-2xl border border-sky-100 bg-white/90 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resultUrl} alt="생성된 이미지" className="mx-auto max-h-[70vh] rounded-xl" />

            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">점수 매기기</p>
              <div className="flex flex-wrap gap-1">
                {SCORES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPendingScore(n)}
                    className={`h-7 w-7 rounded-md text-xs font-medium transition ${
                      pendingScore === n
                        ? "bg-blue-900 text-white"
                        : "bg-sky-50 text-blue-800 hover:bg-sky-100"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="rounded-xl bg-gradient-to-r from-cyan-100 to-sky-200 px-4 py-2 text-sm font-medium text-blue-950 transition hover:from-cyan-200 hover:to-sky-300"
              >
                이미지 다운로드
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={pendingScore == null || saving}
                className="rounded-xl bg-blue-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
            {pendingScore == null && (
              <p className="text-xs text-gray-400">저장하려면 먼저 점수를 선택해주세요.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
