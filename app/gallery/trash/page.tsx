import GenerationsList from "@/components/GenerationsList";

export default function TrashLogsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 px-4 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">휴지통</h1>
          <p className="mt-1 text-sm text-gray-500">All/Best에서 휴지통으로 옮긴 이미지입니다. 복구할 수 있습니다.</p>
        </div>
        <GenerationsList view="trash" />
      </div>
    </main>
  );
}
