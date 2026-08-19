import type { Product } from "./types";

/** Common house / tournament ball weights (lbs). */
export const STANDARD_BALL_WEIGHTS = [8, 9, 10, 11, 12, 13, 14, 15, 16] as const;

export function weightKey(weight: number) {
  const n = Math.round(weight * 10) / 10;
  return Number.isInteger(n) ? String(n) : String(n);
}

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

export function normalizeWeightStock(
  raw: unknown,
  options?: number[]
): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const allowed = options?.length
    ? new Set(options.map((w) => weightKey(w)))
    : null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const w = Number(k);
    if (!Number.isFinite(w) || w <= 0 || w > 30) continue;
    const key = weightKey(w);
    if (allowed && !allowed.has(key)) continue;
    out[key] = Math.max(0, Math.floor(Number(v) || 0));
  }
  return Object.keys(out).length ? out : undefined;
}

export function totalFromWeightStock(stock?: Record<string, number> | null) {
  if (!stock) return 0;
  return Object.values(stock).reduce(
    (sum, n) => sum + Math.max(0, Math.floor(Number(n) || 0)),
    0
  );
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

export function stockForWeight(
  product: Pick<Product, "stock" | "weightOptions" | "weightStock">,
  weight?: number | null
) {
  // Sized products: only the per-size count counts. Missing/0 = not selectable.
  if (productRequiresWeight(product) && weight != null && Number.isFinite(weight)) {
    const key = weightKey(weight);
    const raw = product.weightStock?.[key];
    return Math.max(0, Math.floor(Number(raw) || 0));
  }
  return Math.max(0, Math.floor(Number(product.stock) || 0));
}

export function formatWeightLbs(weight: number) {
  const n = Math.round(weight * 10) / 10;
  return `${n} lb`;
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
