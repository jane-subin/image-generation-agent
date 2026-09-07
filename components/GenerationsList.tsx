"use client";

import { useEffect, useState } from "react";

type Section = { key: string; label: string; text: string };
type Generation = {
  id: string;
  created_at: string;
  image_url: string;
  sections: Section[];
  score: number | null;
};

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

export default function GenerationsList({ best }: { best: boolean }) {
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/generations${best ? "?best=1" : ""}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setItems(json.generations ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [best]);

  async function setScore(id: string, score: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, score } : it)));
    await fetch(`/api/generations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score }),
    });
  }

  if (loading) {
    return <p className="text-sm text-gray-400">불러오는 중…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        {best ? "8점 이상 받은 이미지가 아직 없습니다." : "생성된 이미지가 아직 없습니다."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <div key={item.id} className="flex gap-4 rounded-2xl border border-sky-100 bg-white/80 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image_url}
            alt="생성된 이미지"
            className="h-32 w-24 shrink-0 rounded-xl object-cover"
          />
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString("ko-KR")}</p>

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

            <button
              type="button"
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              className="self-start text-xs font-medium text-blue-600 underline"
            >
              {expandedId === item.id ? "프롬프트 접기" : "프롬프트 보기"}
            </button>

            {expandedId === item.id && (
              <div className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                {item.sections.length === 0 ? (
                  <span>추가 카드 없이 제품 사진만으로 생성됨</span>
                ) : (
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
  );
}
