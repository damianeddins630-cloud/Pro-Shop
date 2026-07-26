"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { useCart } from "@/lib/cart";
import { useEditMode } from "@/lib/edit-mode";
import type { Product } from "@/lib/types";

export default function CartPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useEditMode();
  const { items, setQty, remove, clear, total, count } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shopifyReady, setShopifyReady] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []));
    fetch("/api/checkout")
      .then((r) => r.json())
      .then((d) => setShopifyReady(Boolean(d.shopify?.configured)))
      .catch(() => setShopifyReady(false));
  }, []);

  const lines = items
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return product ? { item, product } : null;
    })
    .filter(Boolean) as {
    item: { productId: string; quantity: number };
    product: Product;
  }[];

  async function checkout() {
    if (!user) {
      router.push("/login?next=/cart");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Checkout failed");
        setLoading(false);
        return;
      }

      if (data.provider === "shopify" && data.checkoutUrl) {
        // Keep cart until they finish; clear as they leave for Shopify pay
        clear();
        window.location.href = data.checkoutUrl as string;
        return;
      }

      clear();
      setMessage(data.message || "Order placed!");
      setLoading(false);
    } catch {
      setError("Checkout failed");
      setLoading(false);
    }
  }

  return (
    <section className="site-shell section-pad pt-24">
      <div className="mb-8 flex items-center gap-4">
        <BrandMark mode="cart" size={64} />
        <div>
          <p className="text-sm tracking-[0.2em] text-red uppercase">Checkout</p>
          <h1 className="display text-5xl">Your Cart</h1>
        </div>
      </div>

      {count === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <p className="text-mist">{message || "Your cart is empty."}</p>
          <Link href="/shop" className="btn btn-primary mt-6">
            Browse inventory
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-4">
            {lines.map(({ item, product }) => (
              <div
                key={product.id}
                className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-black/30">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-contain p-2"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{product.name}</h3>
                  <p className="text-sm text-mist">${product.price.toFixed(2)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={product.stock}
                      value={item.quantity}
                      onChange={(e) => setQty(product.id, Number(e.target.value))}
                      className="field w-24"
                    />
                    <button
                      type="button"
                      onClick={() => remove(product.id)}
                      className="text-sm text-red-300 underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="font-semibold">
                  ${(product.price * item.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <aside className="h-fit rounded-3xl border border-red/25 bg-lane/40 p-6">
            <h2 className="display text-3xl">Order summary</h2>
            <p className="mt-4 text-2xl">${total(products).toFixed(2)}</p>
            <p className="mt-2 text-sm text-mist">
              Login required to buy. Shop and cart stay on this website.{" "}
              {shopifyReady
                ? "Payment is collected securely by Shopify, then you return here."
                : "Shopify payments are not connected yet — orders save on the site only."}
            </p>
            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
            <button
              type="button"
              disabled={loading || authLoading}
              onClick={checkout}
              className="btn btn-primary mt-6 w-full"
            >
              {!user
                ? "Login to checkout"
                : loading
                  ? "Starting checkout..."
                  : shopifyReady
                    ? "Pay with Shopify"
                    : "Place order"}
            </button>
            {!user && (
              <div className="mt-3 flex justify-center gap-3 text-sm">
                <Link href="/login?next=/cart" className="text-red underline">
                  Login
                </Link>
                <Link href="/register?next=/cart" className="text-mist underline">
                  Create account
                </Link>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
