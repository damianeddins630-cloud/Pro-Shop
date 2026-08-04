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
  const [message, setMessage] = useState("Confirming your order...");

  useEffect(() => {
    if (!orderId) {
      setMessage("Thanks — your Shopify payment is complete.");
      return;
    }

    let cancelled = false;

    async function settle() {
      try {
        // Backup path: if webhook is slow, apply inventory when shopper returns
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
        if (!cancelled && confirmData.order) {
          setOrder(confirmData.order as Order);
          setMessage(
            "Payment received. Your order is saved on this website and inventory was updated."
          );
          return;
        }
      } catch {
        // fall through to load order list
      }

      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        const data = await res.json();
        const found = (data.orders || []).find((o: Order) => o.id === orderId);
        if (!cancelled) {
          setOrder(found || null);
          setMessage(
            found
              ? "Your order is saved on your website account under Previous orders."
              : "Thanks — your Shopify payment is complete."
          );
        }
      } catch {
        if (!cancelled) {
          setMessage("Thanks — your Shopify payment is complete.");
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
