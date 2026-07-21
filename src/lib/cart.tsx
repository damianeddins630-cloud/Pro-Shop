"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CartItem, Product } from "./types";

const STORAGE_KEY = "bba_cart_v1";

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

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("bba-cart"));
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("bba-cart", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("bba-cart", cb);
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, readCart, () => []);

  const value: CartContextValue = {
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    add(productId, quantity = 1) {
      const next = [...readCart()];
      const existing = next.find((i) => i.productId === productId);
      if (existing) existing.quantity += quantity;
      else next.push({ productId, quantity });
      writeCart(next);
    },
    remove(productId) {
      writeCart(readCart().filter((i) => i.productId !== productId));
    },
    setQty(productId, quantity) {
      if (quantity <= 0) {
        writeCart(readCart().filter((i) => i.productId !== productId));
        return;
      }
      writeCart(
        readCart().map((i) =>
          i.productId === productId ? { ...i, quantity } : i
        )
      );
    },
    clear() {
      writeCart([]);
    },
    total(products) {
      return items.reduce((sum, item) => {
        const p = products.find((x) => x.id === item.productId);
        return sum + (p ? p.price * item.quantity : 0);
      }, 0);
    },
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
