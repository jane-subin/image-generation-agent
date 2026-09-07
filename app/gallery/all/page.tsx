import GenerationsList from "@/components/GenerationsList";

export default function AllLogsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 px-4 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">All</h1>
          <p className="mt-1 text-sm text-gray-500">생성된 모든 이미지와 그때 사용된 프롬프트를 확인하고 점수를 매길 수 있습니다.</p>
        </div>
        <GenerationsList view="all" />
      </div>
    </main>
  );
}
