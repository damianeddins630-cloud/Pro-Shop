"use client";

import { useCallback, useEffect, useState } from "react";
import type { Order, OrderStatus } from "@/lib/types";
import { useEditMode } from "@/lib/edit-mode";

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
        Plain list of every shop purchase. Stock is taken when an order is placed.
      </p>
      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      <div className="mt-6 space-y-3">
        {orders.length === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-mist">
            No orders yet.
          </p>
        ) : (
          orders.map((order) => (
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
                  </p>
                </div>
                {canManage ? (
                  <select
                    className="field !w-auto !py-2 capitalize"
                    value={order.status}
                    onChange={(e) =>
                      setStatus(order.id, e.target.value as OrderStatus)
                    }
                  >
                    {(
                      [
                        "awaiting_payment",
                        "placed",
                        "processing",
                        "completed",
                        "cancelled",
                      ] as OrderStatus[]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-full border border-red/40 px-3 py-1 text-xs capitalize text-red">
                    {order.status.replace(/_/g, " ")}
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
          ))
        )}
      </div>
    </div>
  );
}
