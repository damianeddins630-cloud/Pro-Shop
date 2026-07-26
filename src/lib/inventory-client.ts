import type { Product } from "@/lib/types";

const KEY = "bba_live_inventory_v1";

export type LocalInventory = {
  updatedAt: string;
  products: Product[];
};

export function saveLocalInventory(products: Product[]) {
  if (typeof window === "undefined") return;
  const payload: LocalInventory = {
    updatedAt: new Date().toISOString(),
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

/**
 * Prefer local inventory when it exists and is at least as new as the API
 * (admin edits on this browser). Otherwise use API/GitHub data.
 */
export function pickNewestProducts(
  apiProducts: Product[],
  apiUpdatedAt?: string
): Product[] {
  const local = loadLocalInventory();
  if (!local?.products?.length) return apiProducts;
  if (!apiProducts?.length) return local.products;
  if (!apiUpdatedAt) return local.products;
  const localTime = Date.parse(local.updatedAt) || 0;
  const apiTime = Date.parse(apiUpdatedAt) || 0;
  return localTime >= apiTime ? local.products : apiProducts;
}
