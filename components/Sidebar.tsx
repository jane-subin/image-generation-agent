import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-sky-100 bg-white/60 p-6">
      <Link href="/" className="text-base font-bold text-blue-950">
        이미지 생성 에이전트
      </Link>

      <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-gray-400">Logs</p>
      <nav className="mt-2 flex flex-col gap-1">
        <Link
          href="/logs/all"
          className="rounded-lg px-3 py-2 text-sm font-medium text-blue-900 hover:bg-sky-50"
        >
          All
        </Link>
        <Link
          href="/logs/best"
          className="rounded-lg px-3 py-2 text-sm font-medium text-blue-900 hover:bg-sky-50"
        >
          Best
        </Link>
      </nav>
    </aside>
  );
}
