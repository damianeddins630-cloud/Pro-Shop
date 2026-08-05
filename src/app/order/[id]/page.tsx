"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InStoreVisitCard } from "@/components/InStoreVisitCard";
import { IN_STORE_POLICY } from "@/lib/in-store";
import {
  ACTIVE_PIPELINE,
  memberOrderStatus,
  opsStatusMeta,
  pipelineStepIndex,
  statusToneClass,
} from "@/lib/order-status";
import type { Order } from "@/lib/types";
import { formatWeightLbs } from "@/lib/weights";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) {
            setError(data.error || "Could not load order");
            setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setOrder(data.order);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load order");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <section className="site-shell section-pad pt-24">
        <p className="text-mist">Loading your order…</p>
      </section>
    );
  }

  if (error || !order) {
    return (
      <section className="site-shell section-pad pt-24">
        <h1 className="display text-5xl">Order</h1>
        <p className="mt-4 text-mist">{error || "Order not found."}</p>
        <Link href="/profile" className="btn btn-primary mt-6">
          Back to account
        </Link>
      </section>
    );
  }

  const member = memberOrderStatus(order.status);
  const step = pipelineStepIndex(order.status);

  return (
    <section className="site-shell section-pad pt-24 space-y-8">
      <div>
        <p className="text-sm tracking-[0.2em] text-red uppercase">Your order</p>
        <h1 className="display mt-2 text-5xl md:text-6xl">
          ${order.total.toFixed(2)}
        </h1>
        <p className="mt-2 text-sm text-mist">
          {new Date(order.createdAt).toLocaleString()} ·{" "}
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusToneClass(member.tone)}`}
          >
            {member.label}
          </span>
        </p>
        <p className="mt-3 max-w-2xl text-mist">{member.detail}</p>
        <p className="mt-2 text-sm text-chalk">{IN_STORE_POLICY}</p>
      </div>

      <InStoreVisitCard />

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <p className="text-xs tracking-[0.18em] text-mist uppercase">
          Progress
        </p>
        <div className="ops-pipeline mt-4">
          {ACTIVE_PIPELINE.map((status, idx) => {
            const s = opsStatusMeta(status);
            const done = step >= 0 && idx < step;
            const current = step === idx;
            return (
              <div
                key={status}
                className={`ops-pipeline-step ${done ? "is-done" : ""} ${current ? "is-current" : ""}`}
              >
                <div className="ops-pipeline-dot" />
                <p className="ops-pipeline-label">{s.short}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <h2 className="display text-3xl">Items</h2>
        <ul className="mt-4 space-y-3">
          {order.items.map((item) => (
            <li
              key={`${item.productId}-${item.weight ?? "na"}-${item.name}`}
              className="flex gap-3"
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/40">
                <Image
                  src={item.image || "/images/logo.png"}
                  alt={item.name}
                  fill
                  className="object-contain p-1"
                  unoptimized
                />
              </div>
              <div>
                <p className="font-medium text-chalk">{item.name}</p>
                <p className="text-sm text-mist">
                  Qty {item.quantity}
                  {item.weight != null
                    ? ` · ${formatWeightLbs(item.weight)}`
                    : ""}{" "}
                  · ${item.price.toFixed(2)} each
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/profile" className="btn btn-primary">
          My account
        </Link>
        <Link href="/shop" className="btn btn-ghost">
          Back to shop
        </Link>
      </div>
    </section>
  );
}
