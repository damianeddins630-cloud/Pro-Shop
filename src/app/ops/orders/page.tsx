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
      <h2 className="display text-4xl">Orders</h2>
      <p className="mt-1 text-sm text-mist">
        Update status so members can track their order: Pending (no payment), Processing
        (not received yet), Completed (they have the ball).
      </p>
      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      <div className="mt-6 space-y-3">
        {orders.length === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-mist">
            No orders yet.
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
                    <p className="text-xs capitalize text-mist">
                      {order.paymentProvider || "local"} payment
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
