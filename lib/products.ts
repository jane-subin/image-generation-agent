// Product lines whose original photos are kept in the IMAGE menu. `id` is the
// ASCII Storage folder name (Korean names are not safe as object keys).
export const PRODUCTS = [
  { id: "smart", name: "스마트" },
  { id: "cuboid", name: "큐보이드" },
  { id: "opener", name: "오프너" },
  { id: "sparkling", name: "스파클링" },
  { id: "indeep", name: "인딥" },
  { id: "portia", name: "포르티아" },
  { id: "armor", name: "아머" },
  { id: "tokback", name: "톡백" },
  { id: "flex", name: "플렉스" },
] as const;

export type ProductId = (typeof PRODUCTS)[number]["id"];

export const PRODUCT_IMAGES_PREFIX = "product-images";

export function isProductId(value: unknown): value is ProductId {
  return PRODUCTS.some((p) => p.id === value);
}
