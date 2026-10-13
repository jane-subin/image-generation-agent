"use client";

import { useEffect, useRef, useState } from "react";
import { resizeImageFile } from "@/lib/resizeImage";
import { SELECTABLE_CATEGORIES, REFERENCE_SLOT_COUNT, type StyleCardKey } from "@/lib/cardConfig";

type ApiError = { code: string; message: string };
type Tone = "product" | "reference" | "aggregate";
type Section = { key: string; label: string; text: string };
type ReferenceSlot = { file: File | null; preview: string | null; categories: StyleCardKey[] };

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

const REFRAME_HEAD = `[리프레이밍 지침]
제품의 형태, 색상, 디자인, 로고와 인물의 얼굴·외모·의상은 원본과 완전히 동일하게 유지하라 — 바꿀 것은 인물의 포즈, 카메라 각도, 프레임 내 위치뿐이다.
이 사진은 전문적으로 세팅된 화보컷이 아니라, 사람이 순간적으로 찍은 듯한 날것의 스냅샷처럼 보여야 한다. 아래를 반드시, 눈에 띄게 적용하라:`;

const REFRAME_POSE = `- [가장 중요] 인물의 포즈를 원본과 확실히 다르게 바꿔라 — 같은 자세를 반복하지 말고, 몸의 방향, 팔과 손의 위치, 고개 각도, 시선을 모두 다르게 하여 촬영 중 움직이다 다른 순간에 찍힌 듯한 자연스러운 자세로 연출하라.`;
const REFRAME_TILT_1 = `- 카메라가 완전히 수평이 아니라 5~15도 정도 기울어진 채로 찍힌 것처럼 하라 (더치 앵글).`;
const REFRAME_TILT_2 = `- 카메라가 완전히 수평이 아니라 5도 정도 기울어진 채로 찍힌 것처럼 하라 (더치 앵글).`;
const REFRAME_OFFCENTER = `- 제품을 프레임 정중앙이 아니라 화면 좌측 또는 우측 1/3 지점으로 확실히 치우치게 배치하라.`;
const REFRAME_ASYMMETRY = `- 상하좌우 여백을 절대 균등하게 만들지 말고, 한쪽은 넓고 한쪽은 좁게 비대칭으로 구성하라.`;
const REFRAME_ZOOM = `- 카메라와 제품 사이의 촬영 거리를 원본 사진과 다르게 바꿔라 — 원본보다 눈에 띄게 가깝게 줌인. (제품을 중심으로 줌인)`;

const REFRAME_RAW_1 = `[날것의 느낌 추가 지침]
1. 완벽한 순간을 피한다 — 완벽하게 균형 잡힌 포즈 금지. 동작의 중간, 살짝 균형이 무너진 순간으로 연출하라.
2. 프레이밍을 일부러 허술하게 — 중앙 정렬 금지. 살짝 기운 핸드헬드로 찍은 듯하게, 인물의 일부가 프레임에 잘리게.
3. 사람과 옷에 흠집을 남긴다 — 구겨지고 입던 느낌의 옷, 말려 올라간 밑단을 표현하라.
4. 인위적인 빛/조명 금지 — 역광, 골든 림라이트 같은 연출된 조명을 쓰지 마라.`;

const REFRAME_RAW_2 = `[날것의 느낌 추가 지침]
1. 완벽한 순간을 피한다 — 정면을 보고 웃는 표정 금지, 완벽하게 균형 잡힌 포즈 금지. 동작의 중간, 살짝 균형이 무너진 순간으로 연출하고 시선은 카메라를 아예 보지 않게 하라.
2. 프레이밍을 일부러 허술하게 — 중앙 정렬 금지. 살짝 기운 핸드헬드로 찍은 듯하게, 인물의 일부가 프레임에 잘리게, 머리 위에 쓸데없는 빈 공간을 두라.
3. 사람과 옷에 흠집을 남긴다 — 모공, 불균일한 피부톤, 홍조, 잔털, 삐져나온 머리카락, 구겨지고 입던 느낌의 옷, 말려 올라간 밑단을 표현하라.
4. 인위적인 빛/조명 금지 — 역광, 골든 림라이트 같은 연출된 조명을 쓰지 마라.`;

const REFRAME_VARIANTS = [
  {
    title: "리프레이밍 1",
    prompt: [
      REFRAME_HEAD,
      REFRAME_POSE,
      REFRAME_TILT_1,
      REFRAME_OFFCENTER,
      REFRAME_ASYMMETRY,
      REFRAME_ZOOM,
      `- [리프레이밍 1 핵심] 인물의 얼굴이 프레임에 전혀 보이지 않는 구도로 찍어라 — 얼굴은 프레임 밖으로 완전히 나가거나 가려져야 한다.
- [리프레이밍 1 핵심] 촬영 각도는 위나 아래가 아닌 정면(눈높이)이어야 하며, 기울기는 수평이 아니라 5~15도 정도 기울어진 컷으로 연출하라. 기울어진 카메라 각도가 이 컷에서 가장 중요한 요소다.
- [리프레이밍 1 핵심] 카메라가 제품(캐리어) 쪽으로 확실히 줌인하여, 제품이 프레임의 약 1/3을 차지하게 하라.`,
      REFRAME_RAW_1,
    ].join("\n"),
  },
  {
    title: "리프레이밍 2",
    prompt: [
      REFRAME_HEAD,
      REFRAME_POSE,
      REFRAME_TILT_2,
      REFRAME_OFFCENTER,
      REFRAME_ASYMMETRY,
      REFRAME_ZOOM,
      `- [리프레이밍 2 핵심] 모델의 얼굴은 프레임에 보이게 하되, 원본 생성 이미지와 확연히 다른 포즈와 시선으로 바꿔라 — 완전히 다른 포즈여야 하며, 원본과 비슷한 자세나 시선은 허용하지 않는다.
- [리프레이밍 2 핵심] 촬영 각도는 원본보다 더 아래에서 올려다보며 찍은 로우앵글로 연출하라.`,
      REFRAME_RAW_2,
    ].join("\n"),
  },
];

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

type ReframeState = {
  loading: boolean;
  error: ApiError | null;
  url: string | null;
  sections: Section[];
  prompt: string;
};

function makeEmptyReframes(): ReframeState[] {
  return REFRAME_VARIANTS.map(() => ({ loading: false, error: null, url: null, sections: [], prompt: "" }));
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
}: {
  title: string;
  imageUrl: string;
  sections: Section[];
  prompt: string;
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

  const [reframes, setReframes] = useState<ReframeState[]>(makeEmptyReframes());

  // Guards against a stale in-flight reframe (from a previous run) writing its
  // result after the user has already started over.
  const runId = useRef(0);

  function resetCompose() {
    setComposedSections(null);
    setKoreanPrompt("");
    setComposeError(null);
  }

  function resetResult() {
    runId.current += 1;
    setResultUrl(null);
    setResultSections([]);
    setGenerateError(null);
    setReframes(makeEmptyReframes());
  }

  function handleProductChange(file: File | null) {
    setProductFile(file);
    setProductPreview(file ? URL.createObjectURL(file) : null);
    resetResult();
  }

  // The IMAGE menu's "이미지 사용하기" links here as /?image=<storage url>. Fetch
  // that stored original and drop it into the product-photo slot, then clear
  // the query so a refresh doesn't re-apply it.
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);
  useEffect(() => {
    const imageUrl = new URLSearchParams(window.location.search).get("image");
    if (!imageUrl) return;
    window.history.replaceState(null, "", window.location.pathname);

    const storageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!storageOrigin || !imageUrl.startsWith(`${storageOrigin}/storage/`)) return;

    setLoadingProduct(true);
    fetch(imageUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error("fetch failed");
        const blob = await res.blob();
        const ext = imageUrl.split("?")[0].split(".").pop() ?? "jpg";
        handleProductChange(new File([blob], `product.${ext}`, { type: blob.type || "image/jpeg" }));
      })
      .catch(() => setProductLoadError("제품 사진을 불러오지 못했습니다."))
      .finally(() => setLoadingProduct(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const myRun = runId.current;

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
      setLoading(false);
      // The reframes need the finished base image, so both start right after it
      // (in parallel) and fill in beside the base image, which is already viewable.
      await Promise.all(
        REFRAME_VARIANTS.map((_, i) => runReframe(i, json.imageUrl, json.sections ?? [], myRun)),
      );
    } catch {
      setGenerateError({ code: "NETWORK", message: "서버에 연결할 수 없습니다." });
    } finally {
      setLoading(false);
    }
  }

  function patchReframe(index: number, patch: Partial<ReframeState>) {
    setReframes((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function runReframe(index: number, sourceUrl: string, sections: Section[], myRun: number) {
    patchReframe(index, { loading: true, error: null });
    const instruction = REFRAME_VARIANTS[index].prompt;

    try {
      // Re-edits the already-generated result image itself (not the original
      // product photo), using only the standalone reframing instruction as the
      // prompt — so this is "take this exact shot and re-angle it", not a
      // fresh regeneration from the original inputs.
      const sourceRes = await fetch(sourceUrl);
      const sourceBlob = await sourceRes.blob();
      const sourceFile = new File([sourceBlob], "source.png", { type: sourceBlob.type || "image/png" });
      const resizedSource = await resizeImageFile(sourceFile);

      const body = new FormData();
      body.append("productImage", resizedSource);
      body.append("prompt", instruction);
      body.append("sections", JSON.stringify(sections));

      const res = await fetch("/api/generate", { method: "POST", body });
      const json = await res.json();
      if (runId.current !== myRun) return;

      if (!res.ok) {
        patchReframe(index, {
          loading: false,
          error: json.error ?? { code: "UNKNOWN", message: "리프레이밍에 실패했습니다." },
        });
        return;
      }
      patchReframe(index, {
        loading: false,
        url: json.imageUrl,
        sections: json.sections ?? [],
        prompt: instruction,
      });
    } catch {
      if (runId.current !== myRun) return;
      patchReframe(index, {
        loading: false,
        error: { code: "NETWORK", message: "서버에 연결할 수 없습니다." },
      });
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 px-4 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
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
              {loadingProduct && <p className="mt-2 text-xs text-gray-500">제품 사진을 불러오는 중…</p>}
              {productLoadError && <p className="mt-2 text-xs text-rose-600">{productLoadError}</p>}
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
                  className="w-full min-h-0 flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm text-gray-700"
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ResultCard
              title="원본"
              imageUrl={resultUrl}
              sections={resultSections}
              prompt={koreanPrompt}
            />
            {REFRAME_VARIANTS.map((variant, i) => {
              const r = reframes[i];
              return r.url ? (
                <ResultCard
                  key={variant.title}
                  title={variant.title}
                  imageUrl={r.url}
                  sections={r.sections}
                  prompt={r.prompt}
                />
              ) : (
                <div
                  key={variant.title}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-sky-200 bg-white/60 p-6 text-center"
                >
                  <p className="text-sm font-semibold text-blue-900">{variant.title}</p>
                  {r.loading && (
                    <p className="text-sm text-gray-500">
                      원본 이미지를 리프레이밍하는 중… (1~2분 정도 걸릴 수 있어요)
                    </p>
                  )}
                  {r.error && (
                    <>
                      <p className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">
                        {r.error.message}
                      </p>
                      <button
                        type="button"
                        onClick={() => runReframe(i, resultUrl, resultSections, runId.current)}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-blue-200 hover:text-blue-800"
                      >
                        다시 시도
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
