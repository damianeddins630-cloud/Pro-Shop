"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Order } from "@/lib/types";

function SuccessInner() {
  const params = useSearchParams();
  const orderId = params.get("orderId");
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!orderId) return;
    fetch("/api/orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const found = (d.orders || []).find((o: Order) => o.id === orderId);
        setOrder(found || null);
      })
      .catch(() => setOrder(null));
  }, [orderId]);

  return (
    <section className="site-shell section-pad pt-24">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <p className="text-sm tracking-[0.2em] text-red uppercase">Thank you</p>
        <h1 className="display mt-2 text-5xl">Back on Ballard&apos;s</h1>
        <p className="mt-4 text-mist">
          Your payment runs through Shopify. This order is saved on your website
          account under Previous orders.
        </p>
        {order && (
          <p className="mt-4 text-lg text-chalk">
            Order total ${order.total.toFixed(2)} ·{" "}
            <span className="capitalize text-red">{order.status.replace("_", " ")}</span>
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
