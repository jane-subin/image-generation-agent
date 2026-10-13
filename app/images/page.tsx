import { redirect } from "next/navigation";
import { PRODUCTS } from "@/lib/products";

// The IMAGE section has no landing page of its own — open the first product.
export default function ImagesIndexPage() {
  redirect(`/images/${PRODUCTS[0].id}`);
}
