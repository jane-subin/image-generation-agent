"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRODUCT_GROUPS } from "@/lib/products";

const ITEM = "rounded-lg px-3 py-2 text-[14px] font-medium text-blue-900 hover:bg-sky-50";
const SUB_ITEM = "rounded-lg px-3 py-2 text-[14px] font-normal text-gray-400 hover:bg-sky-50";

export default function Sidebar() {
  const pathname = usePathname();
  // Groups the user has toggled by hand; an untouched group is open only while
  // one of its products is the current page.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  return (
    <aside className="w-60 shrink-0 border-r border-sky-100 bg-white/60 p-6">
      <Link href="/" className="text-[18px] font-bold text-blue-950">
        이미지 생성 에이전트
      </Link>

      <p className="mt-8 text-[14px] font-semibold uppercase tracking-wide text-gray-400">Image</p>
      <nav className="mt-2 flex flex-col gap-1">
        {PRODUCT_GROUPS.map((group) => {
          const hasActive = group.products.some((p) => pathname === `/images/${p.id}`);
          const expanded = toggled[group.id] ?? hasActive;
          return (
            <div key={group.id} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setToggled((prev) => ({ ...prev, [group.id]: !expanded }))}
                aria-expanded={expanded}
                className={`flex items-center justify-between text-left ${ITEM}`}
              >
                {group.name}
                <span className={`text-[22px] leading-none text-gray-300 transition-transform ${expanded ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>
              {expanded && (
                <div className="flex flex-col gap-1 pl-3">
                  {group.products.map((p) => {
                    const active = pathname === `/images/${p.id}`;
                    return (
                      <Link
                        key={p.id}
                        href={`/images/${p.id}`}
                        className={`${SUB_ITEM} ${active ? "bg-sky-100 text-gray-500" : ""}`}
                      >
                        {p.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <hr className="mt-6 border-t border-gray-200" />

      <p className="mt-6 text-[14px] font-semibold uppercase tracking-wide text-gray-400">Gallery</p>
      <nav className="mt-2 flex flex-col gap-1">
        <Link href="/gallery/all" className={ITEM}>
          All
        </Link>
        <Link href="/gallery/best" className={ITEM}>
          Best
        </Link>
        <Link
          href="/gallery/trash"
          className="rounded-lg px-3 py-2 text-[14px] font-medium text-gray-500 hover:bg-sky-50"
        >
          휴지통
        </Link>
      </nav>
    </aside>
  );
}
