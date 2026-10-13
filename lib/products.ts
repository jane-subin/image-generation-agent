// Product lines whose original photos are kept in the IMAGE menu. `id` is the
// ASCII Storage folder name / route segment (Korean names are not safe as
// object keys).
export type Product = { id: string; name: string };
export type ProductId = string;
export type ProductGroup = { id: string; name: string; products: Product[] };

export const PRODUCT_GROUPS: ProductGroup[] = [
  {
    id: "carrier",
    name: "캐리어",
    products: [
      { id: "smart", name: "스마트" },
      { id: "cuboid", name: "큐보이드" },
      { id: "opener", name: "오프너" },
      { id: "sparkling", name: "스파클링" },
      { id: "indeep", name: "인딥" },
      { id: "portia", name: "포르티아" },
      { id: "armor", name: "아머" },
    ],
  },
  {
    id: "bag",
    name: "가방",
    products: [
      { id: "tokback", name: "톡백" },
      { id: "flex", name: "플렉스" },
    ],
  },
];

export const PRODUCTS: Product[] = PRODUCT_GROUPS.flatMap((g) => g.products);

export const PRODUCT_IMAGES_PREFIX = "product-images";

export function isProductId(value: unknown): value is ProductId {
  return PRODUCTS.some((p) => p.id === value);
}
