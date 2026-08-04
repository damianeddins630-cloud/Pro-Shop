"use client";

import { useCallback, useEffect, useState } from "react";
import type { Order, OrderStatus } from "@/lib/types";
import { useEditMode } from "@/lib/edit-mode";
import { memberOrderStatus, statusToneClass } from "@/lib/order-status";

const STATUS_OPTIONS: { value: OrderStatus; label: string; help: string }[] = [
  {
    value: "awaiting_payment",
    label: "Pending",
    help: "No payment yet",
  },
  {
    value: "placed",
    label: "Processing (placed)",
    help: "Paid / received — preparing",
  },
  {
    value: "processing",
    label: "Processing",
    help: "Customer does not have it yet",
  },
  {
    value: "completed",
    label: "Completed",
    help: "Customer has the ball / item",
  },
  {
    value: "cancelled",
    label: "Cancelled",
    help: "Order cancelled",
  },
];

export default function OpsOrdersPage() {
  const { can } = useEditMode();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canManage = can("manage_orders");

  const load = useCallback(async () => {
    const res = await fetch("/api/orders?all=1", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load orders");
      setLoading(false);
      return;
    }
    setOrders(data.orders || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: string, status: OrderStatus) {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Update failed");
      return;
    }
    load();
  }

  if (loading) return <p className="text-mist">Loading orders...</p>;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-4xl">Orders</h2>
          <p className="mt-1 text-sm text-mist">
            Website order records. Shopify payment orders start as Pending, then move to
            Processing after the paid webhook. Free coupon orders complete immediately.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-chalk">
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            className="btn btn-ghost text-sm"
            onClick={() => {
              setLoading(true);
              setError("");
              void load();
            }}
          >
            Refresh
          </button>
        </div>
      </div>
      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      <div className="mt-6 space-y-3">
        {orders.length === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-mist">
            No orders recorded yet. After a customer checks out, a row appears here —
            even when payment is still awaiting on Shopify. If paid checkout is blocked,
            open <code className="text-chalk">/api/shopify/status</code> and connect
            Shopify on Vercel project pro-shop-lemon.
          </p>
        ) : (
          orders.map((order) => {
            const member = memberOrderStatus(order.status);
            return (
              <article
                key={order.id}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-mist">
                      {new Date(order.createdAt).toLocaleString()} · {order.username} (
                      {order.email})
                    </p>
                    <h3 className="display mt-1 text-3xl">${order.total.toFixed(2)}</h3>
                    <p className="text-xs text-mist">
                      ID {order.id.slice(0, 8)}… ·{" "}
                      <span className="capitalize">
                        {order.paymentProvider || "local"}
                      </span>{" "}
                      payment
                      {order.shopifyInvoiceUrl ? " · Shopify link saved" : ""}
                      {order.couponCode
                        ? ` · coupon ${order.couponCode}${
                            order.discountAmount
                              ? ` (−$${order.discountAmount.toFixed(2)})`
                              : ""
                          }`
                        : ""}
                    </p>
                    <span
                      className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusToneClass(member.tone)}`}
                    >
                      Member sees: {member.label}
                    </span>
                  </div>
                  {canManage ? (
                    <select
                      className="field !w-auto !py-2"
                      value={order.status}
                      onChange={(e) =>
                        setStatus(order.id, e.target.value as OrderStatus)
                      }
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label} — {s.help}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="rounded-full border border-red/40 px-3 py-1 text-xs capitalize text-red">
                      {member.label}
                    </span>
                  )}
                </div>
                <ul className="mt-4 space-y-1 text-sm text-mist">
                  {order.items.map((item) => (
                    <li key={`${order.id}-${item.productId}`}>
                      {item.name} × {item.quantity} — ${item.price.toFixed(2)} each
                    </li>
                  ))}
                </ul>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
