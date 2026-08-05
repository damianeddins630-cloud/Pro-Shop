"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order, OrderStatus, Product } from "@/lib/types";
import { useEditMode } from "@/lib/edit-mode";
import {
  countOrdersByStatus,
  orderRevenue,
  summarizeBallInventory,
} from "@/lib/inventory-stats";
import {
  ACTIVE_PIPELINE,
  OPS_PIPELINE,
  memberOrderStatus,
  nextOpsStatus,
  opsStatusMeta,
  pipelineStepIndex,
  statusToneClass,
} from "@/lib/order-status";
import { formatWeightLbs } from "@/lib/weights";

type FilterKey = "all" | "active" | OrderStatus;

export default function OpsOrdersPage() {
  const { can } = useEditMode();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("active");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const canManage = can("manage_orders");

  const load = useCallback(async () => {
    const [ordersRes, productsRes] = await Promise.all([
      fetch("/api/orders?all=1", { cache: "no-store" }),
      fetch(`/api/products?admin=1&t=${Date.now()}`, { cache: "no-store" }),
    ]);
    const ordersData = await ordersRes.json();
    const productsData = await productsRes.json().catch(() => ({}));
    if (!ordersRes.ok) {
      setError(ordersData.error || "Could not load orders");
      setLoading(false);
      return;
    }
    setOrders(ordersData.orders || []);
    setProducts(productsData.products || []);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(id);
  }, [load]);

  async function setStatus(id: string, status: OrderStatus) {
    setBusyId(id);
    const res = await fetch(`/api/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Update failed");
      return;
    }
    await load();
  }

  const ballSummary = useMemo(
    () => summarizeBallInventory(products),
    [products]
  );
  const pipelineCounts = useMemo(() => countOrdersByStatus(orders), [orders]);
  const revenue = useMemo(() => orderRevenue(orders), [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (filter === "all") return true;
        if (filter === "active") {
          return (
            o.status === "awaiting_payment" ||
            o.status === "placed" ||
            o.status === "processing" ||
            o.status === "ready"
          );
        }
        return o.status === filter;
      })
      .filter((o) => {
        if (!q) return true;
        return (
          o.username.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          o.items.some((i) => i.name.toLowerCase().includes(q)) ||
          (o.couponCode || "").toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
      );
  }, [orders, filter, query]);

  if (loading) {
    return (
      <div className="ops-command-shell">
        <p className="text-mist">Loading command center…</p>
      </div>
    );
  }

  return (
    <div className="ops-command-shell space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.28em] text-red uppercase">
            Fulfillment command
          </p>
          <h2 className="display mt-1 text-5xl md:text-6xl">Orders</h2>
          <p className="mt-2 max-w-2xl text-sm text-mist">
            Live pipeline from payment through prep, ready, and handoff. Ball
            vault totals update with inventory — per weight when stock is set
            on each ball.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost text-sm"
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          Refresh
        </button>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Active pipeline"
          value={String(pipelineCounts.active)}
          hint="Awaiting pay → ready"
        />
        <Metric
          label="Settled revenue"
          value={`$${revenue.toFixed(0)}`}
          hint="Paid / completed (not pending)"
        />
        <Metric
          label="Balls in vault"
          value={String(ballSummary.totalBalls)}
          hint={`${ballSummary.ballSkus} ball SKU${ballSummary.ballSkus === 1 ? "" : "s"}`}
        />
        <Metric
          label="All catalog units"
          value={String(ballSummary.totalUnits)}
          hint={`${ballSummary.accessoryUnits} accessory units`}
        />
      </div>

      <section className="ops-vault rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] via-black/40 to-red/10 p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.22em] text-red uppercase">
              Ball vault
            </p>
            <h3 className="display mt-1 text-3xl">
              {ballSummary.totalBalls} total
            </h3>
            <p className="mt-1 text-sm text-mist">
              Units by weight across active ball inventory.
              {!ballSummary.byWeight.some((b) => b.stock > 0) &&
              ballSummary.totalBalls > 0
                ? " Set per-weight stock in Inventory for exact lb counts."
                : ""}
            </p>
          </div>
          <Link href="/ops/inventory" className="btn btn-ghost !py-2 text-sm">
            Manage inventory
          </Link>
        </div>
        {ballSummary.byWeight.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {ballSummary.byWeight.map((bucket) => (
              <div
                key={bucket.weight}
                className="min-w-[4.5rem] rounded-2xl border border-white/15 bg-black/35 px-3 py-3 text-center"
              >
                <p className="text-xs text-mist">{bucket.label}</p>
                <p className="display mt-1 text-3xl text-chalk">
                  {bucket.stock > 0 ? bucket.stock : "—"}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-steel">
                  {bucket.skus} sku{bucket.skus === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-mist">
            No weighted balls in inventory yet. Add weight options on a ball in
            Inventory.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "active" as const, label: "Active", count: pipelineCounts.active },
            { key: "all" as const, label: "All", count: pipelineCounts.all },
            ...OPS_PIPELINE.map((s) => ({
              key: s.value as FilterKey,
              label: s.label,
              count: pipelineCounts[s.value] || 0,
            })),
          ] as { key: FilterKey; label: string; count: number }[]
        ).map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition ${
                active
                  ? "border-red bg-red text-white"
                  : "border-white/15 bg-white/[0.03] text-mist hover:border-red/50 hover:text-chalk"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 opacity-80">{tab.count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="field max-w-md"
          placeholder="Search name, email, ball, order id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="text-sm text-mist">
          Showing {filtered.length} order{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-mist">
            {orders.length === 0
              ? "No orders yet. When a customer checks out, they appear here in the pipeline."
              : "No orders match this filter."}
          </div>
        ) : (
          filtered.map((order) => (
            <OrderCommandCard
              key={order.id}
              order={order}
              canManage={canManage}
              busy={busyId === order.id}
              onStatus={(status) => void setStatus(order.id, status)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs tracking-[0.18em] text-mist uppercase">{label}</p>
      <p className="display mt-2 text-4xl text-chalk">{value}</p>
      <p className="mt-1 text-xs text-steel">{hint}</p>
    </div>
  );
}

function OrderCommandCard({
  order,
  canManage,
  busy,
  onStatus,
}: {
  order: Order;
  canManage: boolean;
  busy: boolean;
  onStatus: (status: OrderStatus) => void;
}) {
  const meta = opsStatusMeta(order.status);
  const member = memberOrderStatus(order.status);
  const step = pipelineStepIndex(order.status);
  const next = nextOpsStatus(order.status);
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <article className="ops-order-card overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 bg-black/25 px-5 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-mist">
              {new Date(order.createdAt).toLocaleString()}
              {order.updatedAt && order.updatedAt !== order.createdAt
                ? ` · updated ${new Date(order.updatedAt).toLocaleString()}`
                : ""}
            </p>
            <h3 className="display mt-1 truncate text-3xl md:text-4xl">
              {order.username}
            </h3>
            <p className="truncate text-sm text-mist">{order.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusToneClass(meta.tone)}`}
              >
                Ops: {meta.label}
              </span>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusToneClass(member.tone)}`}
              >
                Customer: {member.label}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="display text-4xl">${order.total.toFixed(2)}</p>
            <p className="text-xs text-mist">
              {itemCount} item{itemCount === 1 ? "" : "s"} ·{" "}
              <span className="capitalize">{order.paymentProvider || "local"}</span>
              {order.inventoryApplied ? " · stock pulled" : " · stock held"}
            </p>
            {order.shopifyInvoiceUrl ? (
              <a
                href={order.shopifyInvoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-red underline"
              >
                Shopify invoice
              </a>
            ) : null}
          </div>
        </div>

        <div className="ops-pipeline mt-5" aria-label="Order processing pipeline">
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
        {order.status === "cancelled" ? (
          <p className="mt-3 text-xs text-mist">This order is cancelled.</p>
        ) : (
          <p className="mt-3 text-xs text-mist">{meta.help}</p>
        )}
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-[1.2fr_0.8fr] md:p-6">
        <ul className="space-y-3">
          {order.items.map((item) => (
            <li
              key={`${order.id}-${item.productId}-${item.weight ?? "na"}-${item.name}`}
              className="flex gap-3"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/40">
                <Image
                  src={item.image || "/images/logo.png"}
                  alt={item.name}
                  fill
                  className="object-contain p-1"
                  unoptimized
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-chalk">{item.name}</p>
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
          {order.couponCode ? (
            <li className="text-sm text-emerald-300">
              Coupon {order.couponCode}
              {order.discountAmount
                ? ` (−$${order.discountAmount.toFixed(2)})`
                : ""}
            </li>
          ) : null}
        </ul>

        <div className="space-y-3">
          <p className="text-xs tracking-[0.16em] text-mist uppercase">
            Process controls
          </p>
          {canManage ? (
            <>
              <select
                className="field"
                value={order.status}
                disabled={busy}
                onChange={(e) => onStatus(e.target.value as OrderStatus)}
              >
                {OPS_PIPELINE.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} — {s.help}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                {next ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-primary !py-2 text-sm"
                    onClick={() => onStatus(next)}
                  >
                    Advance → {opsStatusMeta(next).label}
                  </button>
                ) : null}
                {order.status !== "cancelled" &&
                order.status !== "completed" ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-ghost !py-2 text-sm"
                    onClick={() => onStatus("cancelled")}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-mist">View only — need manage_orders.</p>
          )}

          {order.statusHistory?.length ? (
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
              <p className="text-xs tracking-[0.16em] text-mist uppercase">
                Timeline
              </p>
              <ul className="mt-2 max-h-36 space-y-1.5 overflow-auto text-xs text-mist">
                {[...order.statusHistory].reverse().map((ev, i) => (
                  <li key={`${ev.at}-${ev.status}-${i}`}>
                    <span className="text-chalk">
                      {opsStatusMeta(ev.status).label}
                    </span>{" "}
                    · {new Date(ev.at).toLocaleString()}
                    {ev.note ? ` · ${ev.note}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-[11px] text-steel">ID {order.id}</p>
        </div>
      </div>
    </article>
  );
}
