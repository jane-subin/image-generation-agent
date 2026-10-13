"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductId } from "@/lib/products";

type StoredImage = { path: string; name: string; url: string };

export default function ProductImages({ id, name }: { id: ProductId; name: string }) {
  const router = useRouter();
  const [images, setImages] = useState<StoredImage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/product-images?product=${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "이미지를 불러오지 못했습니다.");
        return;
      }
      setImages(json.images ?? []);
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleUpload(files: FileList | null) {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;

    setUploading(true);
    setError(null);
    let failure: string | null = null;
    try {
      for (const file of list) {
        const prepRes = await fetch("/api/product-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product: id, filename: file.name }),
        });
        const prep = await prepRes.json();
        if (!prepRes.ok) {
          failure = prep.error?.message ?? "업로드를 준비하지 못했습니다.";
          return;
        }

        // Same multipart shape the Supabase SDK's uploadToSignedUrl sends.
        const form = new FormData();
        form.append("cacheControl", "3600");
        form.append("", file);
        const putRes = await fetch(prep.signedUrl, {
          method: "PUT",
          headers: { "x-upsert": "false" },
          body: form,
        });
        if (!putRes.ok) {
          failure = `"${file.name}" 업로드에 실패했습니다.`;
          return;
        }
      }
    } catch {
      failure = "서버에 연결할 수 없습니다.";
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
      // load() clears the error, so re-show an upload failure after reloading.
      await load();
      if (failure) setError(failure);
    }
  }

  async function handleDelete(path: string) {
    if (!window.confirm("이 이미지를 삭제할까요?")) return;
    setImages((prev) => prev?.filter((img) => img.path !== path) ?? prev);
    const res = await fetch("/api/product-images", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      await load();
      setError(json?.error?.message ?? "삭제하지 못했습니다.");
    }
  }

  // Hands the stored original over to the agent home, which fetches it and
  // fills the product-photo slot.
  function handleUse(img: StoredImage) {
    router.push(`/?image=${encodeURIComponent(img.url)}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => handleUpload(e.target.files)}
      />

      {images && <span className="text-sm text-gray-400">{images.length}장</span>}

      {error && <p className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}

      {loading && !images ? (
        <p className="text-sm text-gray-400">불러오는 중…</p>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleUpload(e.dataTransfer.files);
          }}
          className={`grid grid-cols-2 gap-4 rounded-2xl md:grid-cols-4 ${
            isDragging ? "outline-dashed outline-2 outline-offset-4 outline-blue-300" : ""
          }`}
        >
          {images?.map((img, i) => (
            <div key={img.path} className="flex flex-col gap-2">
              <div className="aspect-square overflow-hidden rounded-xl border border-sky-100 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={`${name} ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleUse(img)}
                  className="flex-1 rounded-md border border-sky-200 bg-white px-2 py-1 text-xs font-medium text-blue-800 hover:bg-sky-50"
                >
                  이미지 사용하기
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(img.path)}
                  aria-label="이미지 삭제"
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-400 hover:border-rose-200 hover:text-rose-500"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}

          {/* Add card: sits right after the last photo. Click to pick files, or drop files on it (or anywhere on the grid). */}
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isDragging
                ? "border-blue-400 bg-blue-50"
                : "border-sky-300 bg-white/70 hover:border-blue-300 hover:bg-sky-50"
            }`}
          >
            <span className="text-3xl leading-none text-sky-400">+</span>
            <span className="px-2 text-sm font-medium text-blue-800">
              {uploading ? "업로드 중…" : "이미지 추가"}
            </span>
            {!uploading && <span className="px-2 text-xs text-gray-400">클릭하거나 드래그해서 업로드</span>}
          </button>
        </div>
      )}
    </div>
  );
}
