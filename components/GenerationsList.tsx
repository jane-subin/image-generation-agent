"use client";

import { useEffect, useState } from "react";

type View = "all" | "best" | "trash";

type Section = { key: string; label: string; text: string };
type Generation = {
  id: string;
  created_at: string;
  image_url: string;
  prompt: string | null;
  sections: Section[];
  score: number | null;
};

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

export default function GenerationsList({ view }: { view: View }) {
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; side: "before" | "after" } | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/generations?view=${view}`)
      .then(async (res) => {
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(json.error?.message ?? "목록을 불러오지 못했습니다.");
          setItems([]);
          return;
        }
        setItems(json.generations ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError("서버에 연결할 수 없습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  async function setScore(id: string, score: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, score } : it)));
    await fetch(`/api/generations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score }),
    });
  }

  async function setDeleted(id: string, deleted: boolean) {
    // Trashing/restoring moves the item out of the current view, so drop it locally.
    setItems((prev) => prev.filter((it) => it.id !== id));
    await fetch(`/api/generations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleted }),
    });
  }

  // Moves the dragged card next to the drop target, then saves the new order.
  async function handleDrop() {
    const from = dragId;
    const target = dropTarget;
    setDragId(null);
    setDropTarget(null);
    if (!from || !target || from === target.id) return;

    const previous = items;
    const moving = previous.find((it) => it.id === from);
    if (!moving) return;
    const rest = previous.filter((it) => it.id !== from);
    const targetIndex = rest.findIndex((it) => it.id === target.id);
    if (targetIndex < 0) return;
    const next = [...rest];
    next.splice(target.side === "before" ? targetIndex : targetIndex + 1, 0, moving);
    if (next.every((it, i) => it.id === previous[i].id)) return;

    setItems(next);
    setOrderError(null);
    try {
      const res = await fetch("/api/generations/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((it) => it.id) }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setItems(previous);
        setOrderError(json?.error?.message ?? "순서를 저장하지 못했습니다.");
      }
    } catch {
      setItems(previous);
      setOrderError("서버에 연결할 수 없습니다.");
    }
  }

  async function handleDownload(imageUrl: string) {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "generated.png";
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  if (loading) {
    return <p className="text-sm text-gray-400">불러오는 중…</p>;
  }

  if (loadError) {
    return (
      <p className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">
        {loadError}
      </p>
    );
  }

  if (items.length === 0) {
    const emptyMessage =
      view === "best"
        ? "8점 이상 받은 이미지가 아직 없습니다."
        : view === "trash"
          ? "휴지통이 비어있습니다."
          : "생성된 이미지가 아직 없습니다.";
    return <p className="text-sm text-gray-400">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {orderError && (
        <p className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">{orderError}</p>
      )}
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.id}
          data-card
          onDragOver={(e) => {
            if (!dragId || dragId === item.id) return;
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const side = e.clientX < rect.left + rect.width / 2 ? "before" : "after";
            if (dropTarget?.id !== item.id || dropTarget.side !== side) setDropTarget({ id: item.id, side });
          }}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop();
          }}
          className={`flex flex-col gap-3 rounded-2xl border border-sky-100 bg-white/80 p-4 transition ${
            dragId === item.id ? "opacity-40" : ""
          } ${
            dropTarget?.id === item.id
              ? dropTarget.side === "before"
                ? "shadow-[-6px_0_0_0_#60a5fa]"
                : "shadow-[6px_0_0_0_#60a5fa]"
              : ""
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image_url}
            alt="생성된 이미지"
            className="aspect-[3/4] w-full rounded-xl bg-gray-50 object-contain"
          />
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  draggable
                  title="끌어서 순서 변경"
                  onDragStart={(e) => {
                    const card = e.currentTarget.closest("[data-card]");
                    if (card) e.dataTransfer.setDragImage(card, 24, 24);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", item.id);
                    setDragId(item.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropTarget(null);
                  }}
                  className="cursor-grab select-none rounded px-1 text-base leading-none text-gray-300 hover:bg-sky-50 hover:text-gray-500 active:cursor-grabbing"
                >
                  ⠿
                </span>
                <p className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString("ko-KR")}</p>
              </div>
              {view === "trash" ? (
                <button
                  type="button"
                  onClick={() => setDeleted(item.id, false)}
                  className="text-xs font-medium text-blue-600 underline"
                >
                  복구
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleted(item.id, true)}
                  className="text-xs font-medium text-gray-400 hover:text-rose-500"
                >
                  🗑 휴지통으로
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1">
              {SCORES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(item.id, n)}
                  className={`h-7 w-7 rounded-md text-xs font-medium transition ${
                    item.score === n
                      ? "bg-blue-900 text-white"
                      : "bg-sky-50 text-blue-800 hover:bg-sky-100"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="rounded-md border border-sky-200 bg-white px-2 py-1 text-xs font-medium text-blue-800 hover:bg-sky-50"
              >
                {expandedId === item.id ? "프롬프트 접기" : "프롬프트 보기"}
              </button>
              <button
                type="button"
                onClick={() => handleDownload(item.image_url)}
                className="rounded-md border border-sky-200 bg-white px-2 py-1 text-xs font-medium text-blue-800 hover:bg-sky-50"
              >
                이미지 저장
              </button>
            </div>

            {expandedId === item.id && (
              <div className="rounded-lg bg-gray-50 p-3 text-xs whitespace-pre-wrap text-gray-600">
                {item.prompt ? (
                  item.prompt
                ) : item.sections.length === 0 ? (
                  <span>추가 카드 없이 제품 사진만으로 생성됨</span>
                ) : (
                  // Legacy rows saved before the prompt column existed.
                  item.sections.map((s) => (
                    <p key={s.key}>
                      <span className="font-medium text-gray-800">{s.label}:</span> {s.text}
                    </p>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
