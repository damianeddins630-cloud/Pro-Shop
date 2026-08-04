"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { saveLocalInventory } from "@/lib/inventory-client";
import type { Order, Product } from "@/lib/types";

function SuccessInner() {
  const params = useSearchParams();
  const orderId = params.get("orderId");
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState("Checking your payment...");

  useEffect(() => {
    if (!orderId) {
      setMessage(
        "If you paid on Shopify, your order will appear under your account once payment is confirmed."
      );
      return;
    }

    let cancelled = false;

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
          saveLocalInventory(confirmData.products as Product[], confirmData.updatedAt);
        }
        if (!cancelled && confirmData.order && !confirmData.awaiting) {
          setOrder(confirmData.order as Order);
          setMessage(
            "Payment received. Your order is saved on this website and inventory was updated."
          );
          return;
        }
        if (!cancelled && confirmData.awaiting) {
          setOrder((confirmData.order as Order) || null);
          setMessage(
            "Waiting for Shopify to confirm payment. This usually finishes within a minute — check Previous orders shortly."
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
              "Order saved — waiting for Shopify payment confirmation. Inventory updates after payment clears."
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
  }, [orderId]);

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
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/profile" className="btn btn-primary">
            View my account
          </Link>
          <Link href="/shop" className="btn btn-ghost">
            Keep shopping
          </Link>
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
