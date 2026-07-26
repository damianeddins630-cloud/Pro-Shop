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

export function clearLocalInventory() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("bba-inventory"));
  } catch {
    // ignore
  }
}

/**
 * Admin edits are stored in localStorage on this browser.
 * Always prefer that over the API seed, otherwise shop never updates on Vercel.
 */
export function pickNewestProducts(apiProducts: Product[]): Product[] {
  const local = loadLocalInventory();
  if (local?.products?.length) return local.products;
  return apiProducts;
}

export function activeProducts(products: Product[]) {
  return products.filter((p) => p.active !== false);
}
