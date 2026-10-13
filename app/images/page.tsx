import ProductImages from "@/components/ProductImages";

export default function ImagesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 px-4 py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">IMAGE</h1>
          <p className="mt-1 text-sm text-gray-500">
            제품별 원본 사진을 모아두는 곳입니다. 제품명을 눌러 펼친 뒤, 이미지 생성에 쓸 사진을 원본 크기 그대로 다운로드하세요.
          </p>
        </div>
        <ProductImages />
      </div>
    </main>
  );
}
