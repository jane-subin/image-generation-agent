import { notFound } from "next/navigation";
import ProductImages from "@/components/ProductImages";
import { PRODUCTS } from "@/lib/products";

export default async function ProductImagesPage({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params;
  const found = PRODUCTS.find((p) => p.id === product);
  if (!found) notFound();

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 px-4 py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">{found.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            이미지 생성에 쓸 제품 사진을 원본 크기 그대로 다운로드할 수 있습니다.
          </p>
        </div>
        <ProductImages key={found.id} id={found.id} name={found.name} />
      </div>
    </main>
  );
}
