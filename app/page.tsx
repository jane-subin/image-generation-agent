"use client";

import { useState } from "react";
import { resizeImageFile } from "@/lib/resizeImage";
import { SELECTABLE_CATEGORIES, REFERENCE_SLOT_COUNT, type StyleCardKey } from "@/lib/cardConfig";

type ApiError = { code: string; message: string };
type Tone = "product" | "reference" | "aggregate";
type Section = { key: string; label: string; text: string };
type ReferenceSlot = { file: File | null; preview: string | null; categories: StyleCardKey[] };

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

const REFRAME_INSTRUCTION = `[리프레이밍 지침]
제품의 형태, 색상, 디자인, 로고와 인물의 얼굴·외모·의상은 원본과 완전히 동일하게 유지하라 — 바꿀 것은 인물의 포즈, 카메라 각도, 프레임 내 위치뿐이다.
이 사진은 전문적으로 세팅된 화보컷이 아니라, 사람이 순간적으로 찍은 듯한 날것의 스냅샷처럼 보여야 한다. 아래를 반드시, 눈에 띄게 적용하라:
- [가장 중요] 인물의 포즈를 원본과 확실히 다르게 바꿔라 — 같은 자세를 반복하지 말고, 몸의 방향, 팔과 손의 위치, 고개 각도, 시선을 모두 다르게 하여 촬영 중 움직이다 다른 순간에 찍힌 듯한 자연스러운 자세로 연출하라.
- 카메라가 완전히 수평이 아니라 5~15도 정도 기울어진 채로 찍힌 것처럼 하라 (더치 앵글).
- 제품을 프레임 정중앙이 아니라 화면 좌측 또는 우측 1/3 지점으로 확실히 치우치게 배치하라.
- 상하좌우 여백을 절대 균등하게 만들지 말고, 한쪽은 넓고 한쪽은 좁게 비대칭으로 구성하라.
- 카메라와 제품 사이의 촬영 거리를 원본 사진과 다르게 바꿔라 — 원본보다 눈에 띄게 가깝게 줌인. (제품을 중심으로 줌인)
- 촬영 각도 자체도 원본과 다르게 하라 — 위에서 내려다보는 하이앵글이나 아래에서 올려다보는 로우앵글 등, 원본과 분명히 구분되는 시점에서 찍은 것처럼 연출하라.`;

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

function ResultCard({
  title,
  imageUrl,
  sections,
  prompt,
  onReframe,
  reframing,
}: {
  title: string;
  imageUrl: string;
  sections: Section[];
  prompt: string;
  onReframe?: () => void;
  reframing?: boolean;
}) {
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);

  async function handleDownload() {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "generated.png";
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  async function handleSave() {
    if (pendingScore == null) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, prompt, sections, score: pendingScore }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error ?? { code: "UNKNOWN", message: "저장에 실패했습니다." });
        return;
      }
      setSaved(true);
    } catch {
      setSaveError({ code: "NETWORK", message: "서버에 연결할 수 없습니다." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sky-100 bg-white/90 p-4">
      <p className="text-sm font-semibold text-blue-900">{title}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={title} className="mx-auto max-h-[70vh] rounded-xl" />

      <div>
        <p className="mb-1 text-xs font-medium text-gray-500">점수 매기기</p>
        <div className="flex flex-wrap gap-1">
          {SCORES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPendingScore(n)}
              className={`h-7 w-7 rounded-md text-xs font-medium transition ${
                pendingScore === n ? "bg-blue-900 text-white" : "bg-sky-50 text-blue-800 hover:bg-sky-100"
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
          {saving ? "저장 중…" : "갤러리에 저장"}
        </button>
        {onReframe && (
          <button
            type="button"
            onClick={onReframe}
            disabled={reframing}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-blue-200 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {reframing ? "리프레이밍 중…" : "리프레이밍"}
          </button>
        )}
      </div>
      {saved && <p className="text-xs font-medium text-emerald-600">저장 완료되었습니다.</p>}
      {pendingScore == null && (
        <p className="text-xs text-gray-400">저장하려면 먼저 점수를 선택해주세요.</p>
      )}
      {saveError && (
        <p className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">
          {saveError.message}
        </p>
      )}
    </div>
  );
}

export default function Home() {
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

  const [reframing, setReframing] = useState(false);
  const [reframeError, setReframeError] = useState<ApiError | null>(null);
  const [reframedUrl, setReframedUrl] = useState<string | null>(null);
  const [reframedSections, setReframedSections] = useState<Section[]>([]);
  const [reframedPrompt, setReframedPrompt] = useState("");

  function resetCompose() {
    setComposedSections(null);
    setKoreanPrompt("");
    setComposeError(null);
  }

  function resetResult() {
    setResultUrl(null);
    setResultSections([]);
    setGenerateError(null);
    setReframing(false);
    setReframeError(null);
    setReframedUrl(null);
    setReframedSections([]);
    setReframedPrompt("");
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
    resetResult();

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

  async function handleReframe() {
    if (!resultUrl) return;

    setReframing(true);
    setReframeError(null);

    try {
      // Re-edits the already-generated result image itself (not the original
      // product photo), using only the standalone reframing instruction as the
      // prompt — so this is "take this exact shot and re-angle it", not a
      // fresh regeneration from the original inputs.
      const sourceRes = await fetch(resultUrl);
      const sourceBlob = await sourceRes.blob();
      const sourceFile = new File([sourceBlob], "source.png", { type: sourceBlob.type || "image/png" });
      const resizedSource = await resizeImageFile(sourceFile);

      const body = new FormData();
      body.append("productImage", resizedSource);
      body.append("prompt", REFRAME_INSTRUCTION);
      body.append("sections", JSON.stringify(resultSections));

      const res = await fetch("/api/generate", { method: "POST", body });
      const json = await res.json();

      if (!res.ok) {
        setReframeError(json.error ?? { code: "UNKNOWN", message: "리프레이밍에 실패했습니다." });
        return;
      }
      setReframedUrl(json.imageUrl);
      setReframedSections(json.sections ?? []);
      setReframedPrompt(REFRAME_INSTRUCTION);
    } catch {
      setReframeError({ code: "NETWORK", message: "서버에 연결할 수 없습니다." });
    } finally {
      setReframing(false);
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ResultCard
              title="원본"
              imageUrl={resultUrl}
              sections={resultSections}
              prompt={koreanPrompt}
              onReframe={handleReframe}
              reframing={reframing}
            />
            {reframeError && (
              <p className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">
                {reframeError.message}
              </p>
            )}
            {reframedUrl && (
              <ResultCard
                title="리프레이밍"
                imageUrl={reframedUrl}
                sections={reframedSections}
                prompt={reframedPrompt}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
