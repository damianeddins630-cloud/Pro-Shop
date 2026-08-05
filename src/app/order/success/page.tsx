"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { saveLocalInventory } from "@/lib/inventory-client";
import {
  clearPendingCheckout,
  readPendingCheckout,
} from "@/lib/pending-checkout";
import type { Order, Product } from "@/lib/types";

function SuccessInner() {
  const params = useSearchParams();
  const orderId = params.get("orderId");
  const { clear, removeMany } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [resuming, setResuming] = useState(false);
  const [message, setMessage] = useState(() =>
    orderId
      ? "Checking your payment..."
      : "If you paid on Shopify, your order will appear under your account once payment is confirmed."
  );

  async function resumeWithLivePrices() {
    if (!orderId || resuming) return;
    setResuming(true);
    setMessage("Refreshing Shopify payment with this website’s current prices…");
    try {
      const res = await fetch(`/api/orders/${orderId}/pay`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.checkoutUrl) {
        setMessage(data.error || "Could not rebuild payment link.");
        setResuming(false);
        return;
      }
      if (data.order) setOrder(data.order as Order);
      window.location.assign(String(data.checkoutUrl));
    } catch {
      setMessage("Could not rebuild payment link.");
      setResuming(false);
    }
  }

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    function clearCartAfterPaid(paidOrder: Order) {
      const pending = readPendingCheckout();
      const ids =
        pending?.orderId === paidOrder.id
          ? pending.productIds
          : paidOrder.items.map((i) => i.productId);
      if (ids.length) removeMany(ids);
      else clear();
      clearPendingCheckout();
    }

    async function settle() {
      try {
        const confirmRes = await fetch(`/api/orders/${orderId}/confirm`, {
          method: "POST",
        });
        const confirmData = await confirmRes.json().catch(() => ({}));
        if (
          confirmRes.ok &&
          Array.isArray(confirmData.products) &&
          confirmData.updatedAt
        ) {
          saveLocalInventory(
            confirmData.products as Product[],
            confirmData.updatedAt
          );
        }
        if (!cancelled && confirmData.order && !confirmData.awaiting) {
          const paid = confirmData.order as Order;
          setOrder(paid);
          clearCartAfterPaid(paid);
          setMessage(
            "Payment received. Your order is saved on this website and inventory was updated."
          );
          return;
        }
        if (!cancelled && confirmData.awaiting) {
          setOrder((confirmData.order as Order) || null);
          setMessage(
            "Waiting for Shopify to confirm payment. Your cart is still saved until payment finishes or you remove items."
          );
        }
      } catch {
        // fall through
      }

      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        const data = await res.json();
        const found = (data.orders || []).find((o: Order) => o.id === orderId);
        if (!cancelled) {
          setOrder(found || null);
          if (found?.status === "awaiting_payment") {
            setMessage(
              "Order saved — waiting for Shopify payment confirmation. Cart and stock stay unchanged until payment clears."
            );
          } else if (found && found.inventoryApplied) {
            clearCartAfterPaid(found);
            setMessage(
              "Your order is saved on your website account under Previous orders."
            );
          } else if (found) {
            setMessage(
              "Your order is saved on your website account under Previous orders."
            );
          } else {
            setMessage(
              "Thanks. If payment completed on Shopify, your order will show in your account shortly."
            );
          }
        }
      } catch {
        if (!cancelled) {
          setMessage(
            "Thanks. If payment completed on Shopify, your order will show in your account shortly."
          );
        }
      }
    }

    void settle();
    return () => {
      cancelled = true;
    };
  }, [orderId, clear, removeMany]);

  return (
    <section className="site-shell section-pad pt-24">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <p className="text-sm tracking-[0.2em] text-red uppercase">Thank you</p>
        <h1 className="display mt-2 text-5xl">Back on Ballard&apos;s</h1>
        <p className="mt-4 text-mist">{message}</p>
        {order && (
          <p className="mt-4 text-lg text-chalk">
            Order total ${order.total.toFixed(2)} ·{" "}
            <span className="capitalize text-red">
              {order.status.replace("_", " ")}
            </span>
          </p>
        )}
        {order?.items.some((i) => i.weight != null) ? (
          <p className="mt-4 text-sm text-mist">
            Remember: drilling is in-store only. Come in to Ballard&apos;s for
            drilling — we do not ship balls already drilled.
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/profile" className="btn btn-primary">
            View my account
          </Link>
          <Link href="/shop" className="btn btn-ghost">
            Keep shopping
          </Link>
          {order?.status === "awaiting_payment" ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={resuming}
              onClick={() => void resumeWithLivePrices()}
            >
              {resuming
                ? "Updating prices…"
                : "Resume Shopify payment (live website prices)"}
            </button>
          ) : null}
          {order?.status === "awaiting_payment" ? (
            <Link href="/cart" className="btn btn-ghost">
              Back to cart
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <section className="site-shell section-pad pt-24">
          <p className="text-mist">Loading...</p>
        </section>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
