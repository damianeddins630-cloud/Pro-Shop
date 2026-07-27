import type { Product } from "@/lib/types";

const KEY = "bba_live_inventory_v1";

export type LocalInventory = {
  updatedAt: string;
  products: Product[];
};

export function saveLocalInventory(products: Product[], updatedAt?: string) {
  if (typeof window === "undefined") return;
  const payload: LocalInventory = {
    updatedAt: updatedAt || new Date().toISOString(),
    products,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event("bba-inventory"));
  } catch {
    // quota / private mode
  }
}

export function loadLocalInventory(): LocalInventory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalInventory;
    if (!Array.isArray(parsed.products)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocalInventory() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("bba-inventory"));
  } catch {
    // ignore
  }
}

function ts(value?: string) {
  const n = Date.parse(value || "");
  return Number.isFinite(n) ? n : 0;
}

/** Fingerprint prices/stock/discounts so we can detect real catalog changes. */
export function inventoryFingerprint(products: Product[]) {
  return products
    .map(
      (p) =>
        `${p.id}:${p.price}:${p.discountPercent ?? 0}:${p.stock}:${p.active ? 1 : 0}:${p.name}`
    )
    .sort()
    .join("|");
}

/**
 * Pick the newest inventory between API and this browser's Ops edits.
 * Re-reads localStorage every call so a save in another tab wins.
 */
export function pickNewestProducts(
  apiProducts: Product[],
  apiUpdatedAt?: string
): Product[] {
  const local = loadLocalInventory();

  if (!apiProducts.length && local?.products?.length) return local.products;
  if (!local?.products?.length) {
    if (apiProducts.length) saveLocalInventory(apiProducts, apiUpdatedAt);
    return apiProducts;
  }
  if (!apiProducts.length) return local.products;

  const localTs = ts(local.updatedAt);
  const apiTs = ts(apiUpdatedAt);

  if (apiTs > localTs) {
    saveLocalInventory(apiProducts, apiUpdatedAt);
    return apiProducts;
  }

  if (localTs > apiTs) return local.products;

  // Same/missing timestamps — prefer whichever actually changed catalog fields
  const localFp = inventoryFingerprint(local.products);
  const apiFp = inventoryFingerprint(apiProducts);
  if (localFp !== apiFp) {
    // Keep local Ops edits when fingerprints differ and times are tied
    return local.products;
  }
  return apiProducts;
}

export function activeProducts(products: Product[]) {
  return products.filter((p) => p.active !== false);
}

export function findLocalProduct(idOrSlug: string) {
  const local = loadLocalInventory();
  return (
    local?.products.find((p) => p.id === idOrSlug || p.slug === idOrSlug) ||
    null
  );
}
