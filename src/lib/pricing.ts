import type { Product } from "@/lib/types";

/** Clamp discount to 0–100 */
export function normalizeDiscount(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return 0;
  return Math.min(100, Math.max(0, Number(value)));
}

/** Sale / checkout price after discount. Price may be $0. */
export function effectivePrice(product: Pick<Product, "price" | "discountPercent">) {
  const price = Math.max(0, Number(product.price) || 0);
  const discount = normalizeDiscount(product.discountPercent);
  if (discount <= 0) return Math.round(price * 100) / 100;
  return Math.round(price * (1 - discount / 100) * 100) / 100;
}

export function hasDiscount(product: Pick<Product, "price" | "discountPercent">) {
  return normalizeDiscount(product.discountPercent) > 0;
}

export function formatMoney(amount: number) {
  return `$${Number(amount).toFixed(2)}`;
}
