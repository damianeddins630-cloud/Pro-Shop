"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order, OrderStatus, Product } from "@/lib/types";
import { useEditMode } from "@/lib/edit-mode";
import {
  countOrdersByStatus,
  summarizeBallInventory,
} from "@/lib/inventory-stats";
import { IN_STORE_POLICY, STAFF_WORKFLOW } from "@/lib/in-store";
import {
  CUSTOMER_PIPELINE,
  customerPipelineIndex,
  memberOrderStatus,
  nextOpsStatus,
  opsStatusMeta,
  statusToneClass,
} from "@/lib/order-status";
import { formatWeightLbs } from "@/lib/weights";

type FilterKey =
  | "all"
  | "active"
  | "awaiting_payment"
  | "balls_in"
  | "ready"
  | "completed"
  | "cancelled";

const FILTER_TABS: { key: FilterKey; label: string; statuses?: OrderStatus[] }[] =
  [
    { key: "active", label: "Active" },
    { key: "all", label: "All" },
    { key: "awaiting_payment", label: "Pending payment" },
    {
      key: "balls_in",
      label: "Balls in",
      statuses: ["placed", "processing"],
    },
    { key: "ready", label: "Come do drilling" },
    { key: "completed", label: "Order complete" },
    { key: "cancelled", label: "Cancelled" },
  ];

export default function OpsOrdersPage() {
  const { can } = useEditMode();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("active");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState("");
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

  async function clearOrders() {
    if (
      !confirm(
        "Clear ALL orders? This cannot be undone. Inventory / ball stock stays the same."
      )
    ) {
      return;
    }
    setClearing(true);
    setError("");
    setMessage("");
    try {
      let res = await fetch("/api/orders?all=1", { method: "DELETE" });
      if (res.status === 405) {
        res = await fetch("/api/orders?clear=1&all=1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: true }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not clear orders");
        setClearing(false);
        return;
      }
      setOrders([]);
      setMessage(data.message || "All orders cleared.");
    } catch {
      setError("Could not clear orders");
    }
    setClearing(false);
  }

  async function patchOrder(
    id: string,
    body: {
      status?: OrderStatus;
      drillingNotes?: string;
      customerNotified?: boolean;
      markHandedOff?: boolean;
    }
  ) {
    setBusyId(id);
    const res = await fetch(`/api/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Update failed");
      return;
    }
    const data = await res.json();
    if (data.order) {
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...data.order } : o))
      );
    } else {
      await load();
    }
  }

  const ballSummary = useMemo(
    () => summarizeBallInventory(products),
    [products]
  );
  const pipelineCounts = useMemo(() => countOrdersByStatus(orders), [orders]);

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
        if (filter === "balls_in") {
          return o.status === "placed" || o.status === "processing";
        }
        return o.status === filter;
      })
      .filter((o) => {
        if (!q) return true;
        return (
          o.username.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q) ||
          (o.phoneNumber || "").toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          (o.drillingNotes || "").toLowerCase().includes(q) ||
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
    return <p className="text-mist">Loading in-store command center…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.28em] text-red uppercase">
            In-store fulfillment
          </p>
          <h2 className="display mt-1 text-5xl md:text-6xl">Orders</h2>
          <p className="mt-2 max-w-2xl text-sm text-mist">{IN_STORE_POLICY}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <button
              type="button"
              className="btn btn-ghost text-sm text-red-300"
              disabled={clearing || orders.length === 0}
              onClick={() => void clearOrders()}
            >
              {clearing ? "Clearing…" : "Clear all orders"}
            </button>
          ) : null}
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
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs tracking-[0.2em] text-red uppercase">
          Order flow
        </p>
        <p className="mt-1 text-sm text-mist">
          Balls in → Come do drilling → Order complete
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {STAFF_WORKFLOW.map((step) => (
            <div
              key={step.n}
              className="rounded-2xl border border-white/10 bg-black/30 p-3"
            >
              <p className="text-xs text-red">{step.n}</p>
              <p className="mt-1 text-sm font-semibold text-chalk">{step.title}</p>
              <p className="mt-1 text-xs text-mist">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Active in shop"
          value={String(pipelineCounts.active)}
          hint="Pay → balls in → drilling"
        />
        <Metric
          label="Balls in"
          value={String(
            (pipelineCounts.placed || 0) + (pipelineCounts.processing || 0)
          )}
          hint="Waiting for customer to come drill"
        />
        <Metric
          label="Balls in vault"
          value={String(ballSummary.totalBalls)}
          hint={`${ballSummary.ballSkus} ball SKU${ballSummary.ballSkus === 1 ? "" : "s"}`}
        />
        <Metric
          label="Come do drilling"
          value={String(pipelineCounts.ready || 0)}
          hint="Customer should come in now"
        />
      </div>

      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] via-black/40 to-red/10 p-5 md:p-6">
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
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-mist">
            No weighted balls yet — add weights + qty in Inventory.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.key;
          const count =
            tab.key === "active"
              ? pipelineCounts.active
              : tab.key === "all"
                ? pipelineCounts.all
                : tab.key === "balls_in"
                  ? (pipelineCounts.placed || 0) +
                    (pipelineCounts.processing || 0)
                  : pipelineCounts[tab.key as OrderStatus] || 0;
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
              <span className="ml-1.5 opacity-80">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="field max-w-md"
          placeholder="Search name, phone, email, ball, notes…"
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
              ? "No orders yet. Online buys land here for in-store drilling and pickup."
              : "No orders match this filter."}
          </div>
        ) : (
          filtered.map((order) => (
            <OrderWorkstationCard
              key={order.id}
              order={order}
              canManage={canManage}
              busy={busyId === order.id}
              onPatch={(body) => void patchOrder(order.id, body)}
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

function OrderWorkstationCard({
  order,
  canManage,
  busy,
  onPatch,
}: {
  order: Order;
  canManage: boolean;
  busy: boolean;
  onPatch: (body: {
    status?: OrderStatus;
    drillingNotes?: string;
    customerNotified?: boolean;
    markHandedOff?: boolean;
  }) => void;
}) {
  const meta = opsStatusMeta(order.status);
  const member = memberOrderStatus(order.status);
  const step = customerPipelineIndex(order.status);
  const next = nextOpsStatus(order.status);
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const [notes, setNotes] = useState(order.drillingNotes || "");

  useEffect(() => {
    setNotes(order.drillingNotes || "");
  }, [order.id, order.drillingNotes]);

  const phone = (order.phoneNumber || "").trim();
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;

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
            {phone ? (
              <p className="mt-1 text-sm text-chalk">
                Phone{" "}
                {telHref ? (
                  <a href={telHref} className="underline decoration-red/50">
                    {phone}
                  </a>
                ) : (
                  phone
                )}
              </p>
            ) : (
              <p className="mt-1 text-xs text-steel">No phone on file</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-chalk">
                In-store · no shipping
              </span>
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
              {order.customerNotifiedAt ? (
                <span className="inline-flex rounded-full border border-teal-400/40 bg-teal-400/10 px-3 py-1 text-xs text-teal-200">
                  Notified
                </span>
              ) : null}
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

        <div
          className="ops-pipeline ops-pipeline-3 mt-5"
          aria-label="Balls in → drilling → complete"
        >
          {CUSTOMER_PIPELINE.map((s, idx) => {
            const done = step >= 0 && idx < step;
            const current = step === idx;
            return (
              <div
                key={s.key}
                className={`ops-pipeline-step ${done ? "is-done" : ""} ${current ? "is-current" : ""}`}
              >
                <div className="ops-pipeline-dot" />
                <p className="ops-pipeline-label">{s.label}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-mist">
          {order.status === "cancelled" ? "This order is cancelled." : meta.help}
        </p>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-[1.15fr_0.85fr] md:p-6">
        <div className="space-y-3">
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
          </ul>
          {order.couponCode ? (
            <p className="text-sm text-emerald-300">
              Coupon {order.couponCode}
              {order.discountAmount
                ? ` (−$${order.discountAmount.toFixed(2)})`
                : ""}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="text-xs tracking-[0.16em] text-mist uppercase">
            Drill bay / handoff
          </p>
          {canManage ? (
            <>
              <label className="block">
                <span className="label">Drilling / fit notes</span>
                <textarea
                  className="field min-h-24"
                  placeholder="Span, pitches, layout, hand, thumb slug, staff notes…"
                  value={notes}
                  disabled={busy}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => {
                    if ((order.drillingNotes || "") !== notes) {
                      onPatch({ drillingNotes: notes });
                    }
                  }}
                />
              </label>
              <select
                className="field"
                value={
                  order.status === "placed" ? "processing" : order.status
                }
                disabled={busy}
                onChange={(e) =>
                  onPatch({ status: e.target.value as OrderStatus })
                }
              >
                {(
                  [
                    "awaiting_payment",
                    "processing",
                    "ready",
                    "completed",
                    "cancelled",
                  ] as OrderStatus[]
                ).map((value) => {
                  const s = opsStatusMeta(value);
                  return (
                    <option key={value} value={value}>
                      {s.label} — {s.help}
                    </option>
                  );
                })}
              </select>
              <div className="flex flex-wrap gap-2">
                {next ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-primary !py-2 text-sm"
                    onClick={() => onPatch({ status: next })}
                  >
                    Advance → {opsStatusMeta(next).label}
                  </button>
                ) : null}
                {(order.status === "ready" || order.status === "processing") &&
                !order.customerNotifiedAt ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-ghost !py-2 text-sm"
                    onClick={() => onPatch({ customerNotified: true })}
                  >
                    Mark notified
                  </button>
                ) : null}
                {order.status === "ready" ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-primary !py-2 text-sm"
                    onClick={() =>
                      onPatch({ status: "completed", markHandedOff: true })
                    }
                  >
                    Hand off in store
                  </button>
                ) : null}
                {order.status !== "cancelled" &&
                order.status !== "completed" ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-ghost !py-2 text-sm"
                    onClick={() => onPatch({ status: "cancelled" })}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-mist">View only — need manage_orders.</p>
          )}

          {order.drillingNotes ? (
            <p className="rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-mist">
              <span className="text-chalk">Notes:</span> {order.drillingNotes}
            </p>
          ) : null}

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
