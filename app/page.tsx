"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resizeImageFile } from "@/lib/resizeImage";
import { CARD_GROUPS, fieldNameFor, type StyleCardKey } from "@/lib/cardConfig";

type ApiError = { code: string; message: string };
type Tone = "product" | "reference" | "aggregate";
type Section = { key: string; label: string; text: string };
const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

const TONE_CLASSES: Record<Tone, { label: string; border: string; box: string }> = {
  product: { label: "text-blue-900", border: "border-blue-200", box: "bg-blue-100/70" },
  reference: { label: "text-blue-900", border: "border-sky-200", box: "bg-sky-50/70" },
  aggregate: { label: "text-emerald-900", border: "border-emerald-200", box: "bg-emerald-50/70" },
};

function Card({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const c = TONE_CLASSES[tone];
  return <div className={`rounded-2xl border ${c.border} ${c.box} p-4`}>{children}</div>;
}

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
      <div className="flex h-36 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-white/70">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm text-gray-400">클릭해서 이미지 선택</span>
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

export default function Home() {
  const router = useRouter();

  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);

  const [styleFiles, setStyleFiles] = useState<Partial<Record<StyleCardKey, File>>>({});
  const [stylePreviews, setStylePreviews] = useState<Partial<Record<StyleCardKey, string>>>({});

  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSections, setResultSections] = useState<Section[]>([]);
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  function resetResult() {
    setResultUrl(null);
    setResultSections([]);
    setPendingScore(null);
  }

  function handleProductChange(file: File | null) {
    setProductFile(file);
    setProductPreview(file ? URL.createObjectURL(file) : null);
    resetResult();
    setError(null);
  }

  function handleStyleChange(key: StyleCardKey, file: File | null) {
    setStyleFiles((prev) => ({ ...prev, [key]: file ?? undefined }));
    setStylePreviews((prev) => ({ ...prev, [key]: file ? URL.createObjectURL(file) : undefined }));
    resetResult();
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productFile) return;

    setLoading(true);
    setError(null);
    resetResult();

    try {
      const allCardKeys: StyleCardKey[] = CARD_GROUPS.flatMap((g) => [
        g.aggregateKey,
        ...g.individual.map((c) => c.key),
      ]);
      const filledStyleEntries = allCardKeys
        .filter((key) => styleFiles[key])
        .map((key) => ({ key, file: styleFiles[key]! }));

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
      setResultSections(json.sections ?? []);
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

  async function handleSave() {
    if (!resultUrl || pendingScore == null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: resultUrl, sections: resultSections, score: pendingScore }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? { code: "UNKNOWN", message: "저장에 실패했습니다." });
        return;
      }
      router.push(pendingScore >= 8 ? "/gallery/best" : "/gallery/all");
    } catch {
      setError({ code: "NETWORK", message: "서버에 연결할 수 없습니다." });
    } finally {
      setSaving(false);
    }
  }

  function handleTrash() {
    if (!resultUrl) return;
    fetch("/api/discard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: resultUrl }),
    }).catch(() => {});
    resetResult();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 px-4 py-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 rounded-3xl border border-white/60 bg-white/60 p-8 shadow-sm shadow-sky-100 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">이미지 생성 에이전트</h1>
          <p className="mt-1 text-sm text-gray-500">
            제품 사진은 필수, 나머지 카드는 원하는 만큼만 첨부하세요. 첨부한 카드들의 설정을 모아 하나의 화보컷을 생성합니다.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-8">
          <Card tone="product">
            <ImageDropField
              label="제품 사진 (필수)"
              tone="product"
              file={productFile}
              preview={productPreview}
              onChange={handleProductChange}
            />
          </Card>

          {CARD_GROUPS.map((group) => (
            <div key={group.aggregateKey} className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-center text-xs font-medium text-gray-500">
                  종합
                </div>
                <div className="col-span-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-center text-xs font-medium text-gray-500 sm:col-span-3">
                  개별
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card tone="aggregate">
                  <ImageDropField
                    label={`${group.aggregateEmoji} ${group.aggregateLabel}`}
                    hint={group.aggregateHint}
                    tone="aggregate"
                    file={styleFiles[group.aggregateKey] ?? null}
                    preview={stylePreviews[group.aggregateKey] ?? null}
                    onChange={(file) => handleStyleChange(group.aggregateKey, file)}
                  />
                </Card>
                {group.individual.map((card) => (
                  <Card key={card.key} tone="reference">
                    <ImageDropField
                      label={`${card.emoji} ${card.label}`}
                      hint={card.hint}
                      tone="reference"
                      file={styleFiles[card.key] ?? null}
                      preview={stylePreviews[card.key] ?? null}
                      onChange={(file) => handleStyleChange(card.key, file)}
                    />
                  </Card>
                ))}
              </div>
            </div>
          ))}

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
              <button
                type="button"
                onClick={handleTrash}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-500 transition hover:border-rose-200 hover:text-rose-500"
              >
                🗑 휴지통
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
