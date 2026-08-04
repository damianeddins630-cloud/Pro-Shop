"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { ProductPrice } from "@/components/ProductPrice";
import { useCart } from "@/lib/cart";
import { useEditMode } from "@/lib/edit-mode";
import {
  pickNewestProducts,
  saveLocalInventory,
} from "@/lib/inventory-client";
import { savePendingCheckout } from "@/lib/pending-checkout";
import { effectivePrice } from "@/lib/pricing";
import type { Product } from "@/lib/types";

type AppliedCoupon = {
  code: string;
  label: string;
  discountAmount: number;
  total: number;
};

type ShopifyClientStatus = {
  configured: boolean;
  webhookConfigured?: boolean;
  checkoutReady?: boolean;
  storeDomain?: string | null;
  missing?: string[];
  hints?: string[];
};

export default function CartPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useEditMode();
  const { items, setQty, remove, clear, total, count } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shopify, setShopify] = useState<ShopifyClientStatus | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const shopifyReady = Boolean(
    shopify?.checkoutReady ?? shopify?.configured
  );

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetch(`/api/products?t=${Date.now()}`, {
          cache: "no-store",
        });
        const d = await res.json();
        const merged = pickNewestProducts(
          d.products || [],
          typeof d.updatedAt === "string" ? d.updatedAt : undefined
        );
        setProducts(merged);
      } catch {
        setProducts(pickNewestProducts([]));
      }
    };
    const loadShopify = async () => {
      try {
        const res = await fetch("/api/shopify/status", { cache: "no-store" });
        const d = await res.json();
        const s = (d.shopify || { configured: false }) as ShopifyClientStatus;
        // Prefer live Admin ping (top-level ok) when present.
        if (typeof d.ok === "boolean") {
          s.checkoutReady = d.ok;
          s.configured = d.ok || Boolean(s.configured);
        }
        setShopify(s);
      } catch {
        try {
          const res = await fetch("/api/checkout", { cache: "no-store" });
          const d = await res.json();
          setShopify(d.shopify || { configured: false });
        } catch {
          setShopify({ configured: false });
        }
      }
    };
    const onRefresh = () => {
      void loadProducts();
      void loadShopify();
    };
    void loadProducts();
    void loadShopify();
    window.addEventListener("bba-inventory", onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.removeEventListener("bba-inventory", onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
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

  const subtotal = useMemo(() => total(products), [total, products]);

  useEffect(() => {
    if (!coupon) return;
    void (async () => {
      try {
        const res = await fetch("/api/coupons/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: coupon.code, subtotal }),
        });
        const data = await res.json();
        if (!res.ok) {
          setCoupon(null);
          setCouponError(data.error || "Coupon no longer valid");
          return;
        }
        setCoupon({
          code: data.coupon.code,
          label: data.coupon.label,
          discountAmount: data.discountAmount,
          total: data.total,
        });
      } catch {
        // keep previous
      }
    })();
  }, [subtotal, coupon]);

  async function redeemCoupon() {
    setCouponError("");
    setMessage("");
    if (!couponInput.trim()) {
      setCouponError("Enter a coupon code");
      return;
    }
    setRedeeming(true);
    try {
      const res = await fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim(), subtotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCoupon(null);
        setCouponError(data.error || "Could not redeem coupon");
        setRedeeming(false);
        return;
      }
      setCoupon({
        code: data.coupon.code,
        label: data.coupon.label,
        discountAmount: data.discountAmount,
        total: data.total,
      });
      setCouponInput(data.coupon.code);
      setMessage(`Coupon applied: ${data.coupon.label}`);
    } catch {
      setCouponError("Could not redeem coupon");
    }
    setRedeeming(false);
  }

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
        credentials: "same-origin",
        body: JSON.stringify({
          items,
          couponCode: coupon?.code || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.shopify) setShopify(data.shopify);
        setError(
          data.error ||
            (res.status === 503
              ? "Shopify payment is not connected yet."
              : "Checkout failed")
        );
        setLoading(false);
        return;
      }

      if (Array.isArray(data.products)) {
        saveLocalInventory(data.products, data.updatedAt);
        setProducts(data.products);
      }

      // Paid path: open Shopify payment — keep cart until paid or shopper removes items.
      if (data.provider === "shopify" && data.checkoutUrl) {
        savePendingCheckout({
          orderId: String(data.orderId || ""),
          productIds: items.map((i) => i.productId),
          checkoutUrl: String(data.checkoutUrl),
          createdAt: new Date().toISOString(),
        });
        setCoupon(null);
        setMessage(
          "Opening Shopify payment… Your cart stays here until you finish paying or remove items. Stock only drops after payment."
        );
        window.location.assign(String(data.checkoutUrl));
        return;
      }

      // Free / local path — purchase completed on this site, so clear cart.
      clear();
      setCoupon(null);
      setMessage(
        data.message ||
          (data.orderId
            ? `Order ${data.orderId} recorded.`
            : "Order placed!")
      );
      setLoading(false);
    } catch {
      setError("Checkout failed — check your connection and try again.");
      setLoading(false);
    }
  }

  const due = coupon ? coupon.total : subtotal;
  const paidCheckoutBlocked = due > 0 && !shopifyReady;
  const checkoutDisabled = loading || authLoading || paidCheckoutBlocked;

  const checkoutLabel = !user
    ? "Login to checkout"
    : loading
      ? "Starting checkout..."
      : due <= 0
        ? "Place free order"
        : shopifyReady
          ? "Pay with Shopify"
          : "Shopify not connected";

  return (
    <section className="site-shell section-pad pt-24">
      <div className="mb-8 flex items-center gap-4">
        <BrandMark mode="cart" size={64} />
        <div>
          <p className="text-sm tracking-[0.2em] text-red uppercase">Checkout</p>
          <h1 className="display text-5xl">Your Cart</h1>
        </div>
      </div>

      {paidCheckoutBlocked && (
        <div className="mb-6 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-4 text-sm text-amber-100">
          <p className="font-semibold text-amber-200">
            Shopify payment is warming up — refresh this page in a moment.
          </p>
          <p className="mt-2 text-amber-100/90">
            If this stays blocked, open{" "}
            <Link href="/ops/shopify" className="underline text-amber-50">
              Ops → Shopify
            </Link>{" "}
            and tap <strong>Refresh status</strong> (or Save Connect). The app
            needs Shopify Admin scope{" "}
            <code className="text-amber-50">write_draft_orders</code>.
          </p>
          <p className="mt-2">
            Status:{" "}
            <Link href="/api/shopify/status" className="underline text-amber-50">
              /api/shopify/status
            </Link>
          </p>
        </div>
      )}

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
                  <ProductPrice product={product} size="sm" />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={product.stock}
                      value={item.quantity}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setQty(
                          product.id,
                          Math.min(product.stock, Math.max(1, Math.floor(n)))
                        );
                      }}
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
                  ${(effectivePrice(product) * item.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <aside className="h-fit rounded-3xl border border-red/25 bg-lane/40 p-6">
            <h2 className="display text-3xl">Order summary</h2>
            <div className="mt-4 space-y-1 text-sm text-mist">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {coupon && (
                <div className="flex justify-between text-emerald-300">
                  <span>Coupon ({coupon.code})</span>
                  <span>-${coupon.discountAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
            <p className="mt-3 text-2xl">${due.toFixed(2)}</p>
            {coupon && (
              <p className="mt-1 text-sm text-emerald-300">{coupon.label}</p>
            )}

            <div className="mt-5 space-y-2">
              <label className="label" htmlFor="coupon">
                Coupon code
              </label>
              <div className="flex gap-2">
                <input
                  id="coupon"
                  className="field"
                  placeholder="Enter code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-ghost shrink-0"
                  disabled={redeeming}
                  onClick={() => void redeemCoupon()}
                >
                  {redeeming ? "..." : "Redeem"}
                </button>
              </div>
              {coupon && (
                <button
                  type="button"
                  className="text-xs text-mist underline"
                  onClick={() => {
                    setCoupon(null);
                    setCouponInput("");
                    setCouponError("");
                    setMessage("");
                  }}
                >
                  Remove coupon
                </button>
              )}
              {couponError && (
                <p className="text-sm text-red-300">{couponError}</p>
              )}
            </div>

            <p className="mt-4 text-sm text-mist">
              Login required to buy. This website owns the catalog, prices, cart,
              and stock. Shopify is payment only. Cart items stay until you pay
              or remove them — stock drops only after a successful purchase.{" "}
              {due <= 0
                ? "This is a free coupon order — it records on the website with no Shopify payment page."
                : shopifyReady
                  ? "Pay with Shopify opens Shopify’s secure payment page using this website’s prices."
                  : "Paid checkout opens after Shopify status shows Ready — refresh or check Ops → Shopify."}
            </p>
            {shopifyReady && shopify?.storeDomain && (
              <p className="mt-2 text-xs text-emerald-300">
                Shopify ready · {shopify.storeDomain}
                {!shopify.webhookConfigured
                  ? " · webhook secret still missing (inventory after pay needs it)"
                  : ""}
              </p>
            )}
            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
            <button
              type="button"
              disabled={checkoutDisabled}
              onClick={() => void checkout()}
              className="btn btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkoutLabel}
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
