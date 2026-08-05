"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CartItem, Product } from "./types";
import { effectivePrice } from "./pricing";
import { cartLineKey } from "./weights";

const STORAGE_KEY = "bba_cart_v2";
const LEGACY_STORAGE_KEY = "bba_cart_v1";
const EMPTY: CartItem[] = [];

type CartContextValue = {
  items: CartItem[];
  count: number;
  add: (productId: string, quantity?: number, weight?: number) => void;
  remove: (productId: string, weight?: number) => void;
  removeMany: (productIds: string[]) => void;
  setQty: (productId: string, quantity: number, weight?: number) => void;
  clear: () => void;
  total: (products: Product[]) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

let cachedRaw: string | null = null;
let cachedItems: CartItem[] = EMPTY;

function sanitizeItems(parsed: unknown): CartItem[] {
  if (!Array.isArray(parsed)) return EMPTY;
  const out: CartItem[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const productId = String((raw as CartItem).productId || "").trim();
    const quantity = Math.max(1, Math.floor(Number((raw as CartItem).quantity) || 0));
    if (!productId || quantity < 1) continue;
    const weightRaw = (raw as CartItem).weight;
    const weight =
      weightRaw == null || weightRaw === ("" as unknown)
        ? undefined
        : Number(weightRaw);
    out.push({
      productId,
      quantity,
      ...(Number.isFinite(weight as number) ? { weight: weight as number } : {}),
    });
  }
  return out;
}

function migrateLegacyCart() {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return;
    const items = sanitizeItems(JSON.parse(legacy));
    if (items.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  } catch {
    // ignore
  }
}

function getSnapshot(): CartItem[] {
  try {
    migrateLegacyCart();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedItems;
    cachedRaw = raw;
    if (!raw) {
      cachedItems = EMPTY;
      return cachedItems;
    }
    cachedItems = sanitizeItems(JSON.parse(raw));
    return cachedItems;
  } catch {
    cachedRaw = null;
    cachedItems = EMPTY;
    return EMPTY;
  }
}

function getServerSnapshot(): CartItem[] {
  return EMPTY;
}

function subscribe(onStoreChange: () => void) {
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener("bba-cart", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("bba-cart", handler);
  };
}

function writeCart(items: CartItem[]) {
  const next = items.length ? items : EMPTY;
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Still update in-memory cart if storage is blocked.
  }
  cachedRaw = raw;
  cachedItems = next;
  try {
    window.dispatchEvent(new Event("bba-cart"));
  } catch {
    // ignore
  }
}

function sameLine(a: CartItem, productId: string, weight?: number) {
  return cartLineKey(a.productId, a.weight) === cartLineKey(productId, weight);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback(
    (productId: string, quantity = 1, weight?: number) => {
      const prev = getSnapshot();
      const next = prev.map((i) => ({ ...i }));
      const existing = next.find((i) => sameLine(i, productId, weight));
      if (existing) existing.quantity += quantity;
      else {
        next.push({
          productId,
          quantity,
          ...(weight != null && Number.isFinite(weight) ? { weight } : {}),
        });
      }
      writeCart(next);
    },
    []
  );

  const remove = useCallback((productId: string, weight?: number) => {
    writeCart(
      getSnapshot().filter((i) => !sameLine(i, productId, weight))
    );
  }, []);

  const removeMany = useCallback((productIds: string[]) => {
    const drop = new Set(productIds);
    writeCart(getSnapshot().filter((i) => !drop.has(i.productId)));
  }, []);

  const setQty = useCallback(
    (productId: string, quantity: number, weight?: number) => {
      if (quantity <= 0) {
        writeCart(
          getSnapshot().filter((i) => !sameLine(i, productId, weight))
        );
        return;
      }
      writeCart(
        getSnapshot().map((i) =>
          sameLine(i, productId, weight)
            ? { ...i, quantity: Math.max(1, Math.floor(quantity)) }
            : i
        )
      );
    },
    []
  );

  const clear = useCallback(() => {
    writeCart(EMPTY);
  }, []);

  const total = useCallback(
    (products: Product[]) =>
      items.reduce((sum, item) => {
        const p = products.find((x) => x.id === item.productId);
        return sum + (p ? effectivePrice(p) * item.quantity : 0);
      }, 0),
    [items]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      add,
      remove,
      removeMany,
      setQty,
      clear,
      total,
    }),
    [items, add, remove, removeMany, setQty, clear, total]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
