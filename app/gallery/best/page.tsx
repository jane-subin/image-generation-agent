import GenerationsList from "@/components/GenerationsList";

export default function BestLogsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 px-4 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">Best</h1>
          <p className="mt-1 text-sm text-gray-500">8점 이상 받은 이미지만 모아서 보여줍니다.</p>
        </div>
        <GenerationsList view="best" />
      </div>
    </main>
  );
}
