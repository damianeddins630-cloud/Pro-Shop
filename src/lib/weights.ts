import type { Product } from "./types";

/** Common house / tournament ball weights (lbs). */
export const STANDARD_BALL_WEIGHTS = [8, 9, 10, 11, 12, 13, 14, 15, 16] as const;

export function normalizeWeightOptions(raw: unknown): number[] | undefined {
  if (raw == null) return undefined;
  const list = Array.isArray(raw) ? raw : [];
  const cleaned = [
    ...new Set(
      list
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0 && n <= 30)
        .map((n) => Math.round(n * 10) / 10)
    ),
  ].sort((a, b) => a - b);
  return cleaned.length ? cleaned : undefined;
}

export function productRequiresWeight(product: Pick<Product, "weightOptions">) {
  return Array.isArray(product.weightOptions) && product.weightOptions.length > 0;
}

export function isAllowedWeight(
  product: Pick<Product, "weightOptions">,
  weight: number | undefined | null
) {
  if (!productRequiresWeight(product)) return weight == null;
  if (weight == null || !Number.isFinite(weight)) return false;
  return (product.weightOptions || []).some((w) => Math.abs(w - weight) < 0.001);
}

export function formatWeightLbs(weight: number) {
  const n = Math.round(weight * 10) / 10;
  return Number.isInteger(n) ? `${n} lb` : `${n} lb`;
}

export function cartLineKey(productId: string, weight?: number | null) {
  if (weight == null || !Number.isFinite(weight)) return productId;
  return `${productId}::${weight}`;
}

export function lineDisplayName(
  name: string,
  weight?: number | null,
  discountPercent?: number
) {
  const weightPart =
    weight != null && Number.isFinite(weight) ? ` — ${formatWeightLbs(weight)}` : "";
  const salePart =
    (discountPercent || 0) > 0 ? ` (${discountPercent}% off)` : "";
  return `${name}${weightPart}${salePart}`;
}
