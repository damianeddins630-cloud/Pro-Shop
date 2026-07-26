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

const STORAGE_KEY = "bba_cart_v1";
const EMPTY: CartItem[] = [];

type CartContextValue = {
  items: CartItem[];
  count: number;
  add: (productId: string, quantity?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, quantity: number) => void;
  clear: () => void;
  total: (products: Product[]) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

let cachedRaw: string | null = null;
let cachedItems: CartItem[] = EMPTY;

function getSnapshot(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedItems;
    cachedRaw = raw;
    if (!raw) {
      cachedItems = EMPTY;
      return cachedItems;
    }
    const parsed = JSON.parse(raw) as CartItem[];
    cachedItems = Array.isArray(parsed) ? parsed : EMPTY;
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
  localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedItems = next;
  window.dispatchEvent(new Event("bba-cart"));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((productId: string, quantity = 1) => {
    const prev = getSnapshot();
    const next = prev.map((i) => ({ ...i }));
    const existing = next.find((i) => i.productId === productId);
    if (existing) existing.quantity += quantity;
    else next.push({ productId, quantity });
    writeCart(next);
  }, []);

  const remove = useCallback((productId: string) => {
    writeCart(getSnapshot().filter((i) => i.productId !== productId));
  }, []);

  const setQty = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      writeCart(getSnapshot().filter((i) => i.productId !== productId));
      return;
    }
    writeCart(
      getSnapshot().map((i) =>
        i.productId === productId ? { ...i, quantity } : i
      )
    );
  }, []);

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
      setQty,
      clear,
      total,
    }),
    [items, add, remove, setQty, clear, total]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
