"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Overview = {
  generatedAt: string;
  sales: {
    today: number;
    month: number;
    year: number;
    allTime: number;
    orderCountToday: number;
    orderCountMonth: number;
    orderCountAll: number;
    averageOrder: number;
    dailySales: { day: number; total: number }[];
  };
  coaching: {
    revenueCollected: number;
    sessionsBooked: number;
    available: boolean;
    note: string;
  };
  memberships: {
    revenueCollected: number;
    activeCount: number;
    available: boolean;
    note: string;
  };
  inventory: {
    productCount: number;
    activeCount: number;
    lowStockCount: number;
    needsPriceCount: number;
    unitsInStock: number;
  };
  customers: {
    accountCount: number;
    subscriberCount: number;
  };
  recentOrders: {
    id: string;
    username: string;
    email: string;
    total: number;
    status: string;
    createdAt: string;
    itemCount: number;
  }[];
  system: {
    durableWriteConfigured: boolean;
    lastPersistOk: boolean | null;
    lastPersistDetail: string;
    shopifyCheckoutReady: boolean;
    shopifyConfigured: boolean;
    shopifyWebhookConfigured: boolean;
    googleSheetsConnected: boolean;
    googleSheetsNote: string;
  };
};

function money(n: number) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function statusBadge(status: string) {
  if (status === "completed") return "ops-badge ops-badge-green";
  if (status === "ready") return "ops-badge ops-badge-blue";
  if (status === "processing" || status === "placed")
    return "ops-badge ops-badge-yellow";
  if (status === "cancelled") return "ops-badge ops-badge-red";
  return "ops-badge ops-badge-gray";
}

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function OpsDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/ops/overview", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || "Could not load overview");
        }
        if (!cancelled) {
          setData(json as Overview);
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxDaily = useMemo(() => {
    if (!data?.sales.dailySales?.length) return 1;
    return Math.max(1, ...data.sales.dailySales.map((d) => d.total));
  }, [data]);

  const shopRevenue = data?.sales.month ?? 0;
  const coachingRevenue = data?.coaching.revenueCollected ?? 0;
  const membershipRevenue = data?.memberships.revenueCollected ?? 0;
  const netCollected = shopRevenue + coachingRevenue + membershipRevenue;

  return (
    <div className="ops-dash-grid">
      <div>
        <h2
          style={{
            margin: "0 0 0.35rem",
            fontSize: "1.35rem",
            fontWeight: 750,
            letterSpacing: "-0.02em",
          }}
        >
          Dashboard
        </h2>
        <p className="ops-note" style={{ marginTop: 0 }}>
          Live business overview from paid orders, inventory, and system health —
          no placeholder revenue.
        </p>
      </div>

      {!data?.system.durableWriteConfigured ? (
        <div className="ops-stage-banner" role="status">
          Durable storage is not fully configured. Configure Blob, Redis, or
          GitHub persistence before trusting this site with production business
          records. Google Sheets will be a backup later — not the primary
          database.
        </div>
      ) : null}

      {error ? (
        <div className="ops-stage-banner" role="alert">
          {error}
        </div>
      ) : null}

      <section className="ops-kpi-row" aria-label="Key metrics">
        <article className="ops-card ops-card-red">
          <p className="ops-kpi-label">Shop sales · this month</p>
          <p className="ops-kpi-value">{loading ? "…" : money(shopRevenue)}</p>
          <p className="ops-kpi-meta">
            {loading
              ? "Loading…"
              : `${data?.sales.orderCountMonth ?? 0} paid orders · today ${money(
                  data?.sales.today ?? 0
                )}`}
          </p>
        </article>
        <article className="ops-card ops-card-blue">
          <p className="ops-kpi-label">Coaching revenue</p>
          <p className="ops-kpi-value">{money(coachingRevenue)}</p>
          <p className="ops-kpi-meta">
            {data?.coaching.note || "Not enabled yet"}
          </p>
        </article>
        <article className="ops-card ops-card-purple">
          <p className="ops-kpi-label">Membership revenue</p>
          <p className="ops-kpi-value">{money(membershipRevenue)}</p>
          <p className="ops-kpi-meta">
            {data?.memberships.note || "Not enabled yet"}
          </p>
        </article>
        <article className="ops-card ops-card-green">
          <p className="ops-kpi-label">Collected · this month</p>
          <p className="ops-kpi-value">
            {loading ? "…" : money(netCollected)}
          </p>
          <p className="ops-kpi-meta">
            Paid only · year {loading ? "…" : money(data?.sales.year ?? 0)}
          </p>
        </article>
      </section>

      <section className="ops-dash-mid">
        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Revenue overview</h2>
            <span className="ops-badge ops-badge-gray">This month · paid</span>
          </div>
          <div className="ops-spark" aria-hidden>
            {(data?.sales.dailySales || []).map((d) => (
              <span
                key={d.day}
                title={`Day ${d.day}: ${money(d.total)}`}
                style={{
                  height: `${Math.max(4, (d.total / maxDaily) * 100)}%`,
                  opacity: d.total > 0 ? 0.95 : 0.2,
                }}
              />
            ))}
          </div>
          <p className="ops-note">
            Bars show paid shop sales by day this month. Unpaid Shopify drafts
            are excluded. Coaching and membership revenue will appear here once
            those modules are live.
          </p>
        </article>

        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Quick actions</h2>
            <span className="ops-badge ops-badge-red">Ops</span>
          </div>
          <div className="ops-actions-grid">
            <Link className="ops-action" href="/ops/orders">
              ◎ Sales & Orders
            </Link>
            <Link className="ops-action" href="/ops/inventory">
              ▤ Update inventory
            </Link>
            <Link className="ops-action" href="/ops/customers">
              ◉ Customers
            </Link>
            <Link className="ops-action" href="/ops/marketing">
              ✦ Marketing
            </Link>
            <Link className="ops-action" href="/ops/reports">
              ▦ Reports
            </Link>
            <Link className="ops-action" href="/ops/backups">
              ↻ Backups
            </Link>
          </div>
        </article>
      </section>

      <section className="ops-dash-bottom">
        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Business stats</h2>
          </div>
          <div className="ops-stat-list">
            <div>
              <strong>{data?.sales.orderCountAll ?? "—"}</strong>
              <span>Paid orders</span>
            </div>
            <div>
              <strong>{data ? money(data.sales.averageOrder) : "—"}</strong>
              <span>Avg order</span>
            </div>
            <div>
              <strong>{data?.inventory.activeCount ?? "—"}</strong>
              <span>Active products</span>
            </div>
            <div>
              <strong>{data?.customers.accountCount ?? "—"}</strong>
              <span>Customer accounts</span>
            </div>
            <div>
              <strong>{data?.inventory.lowStockCount ?? "—"}</strong>
              <span>Low stock</span>
            </div>
            <div>
              <strong>{data?.customers.subscriberCount ?? "—"}</strong>
              <span>Subscribers</span>
            </div>
          </div>
          {(data?.inventory.needsPriceCount || 0) > 0 ? (
            <p className="ops-note">
              {data?.inventory.needsPriceCount} catalog items still need a price
              before they should sell on the shop.
            </p>
          ) : null}
        </article>

        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Recent activity</h2>
            <Link href="/ops/orders" className="ops-ghost-btn">
              View all
            </Link>
          </div>
          {loading ? (
            <p className="ops-note">Loading paid orders…</p>
          ) : !data?.recentOrders?.length ? (
            <p className="ops-note">
              No paid orders yet. Completed checkouts will appear here.
            </p>
          ) : (
            <ul className="ops-activity">
              {data.recentOrders.map((o) => (
                <li key={o.id}>
                  <div>
                    <strong>
                      Order {o.id.slice(0, 8)} · {money(o.total)}
                    </strong>
                    <div
                      style={{
                        color: "var(--ops-muted)",
                        fontSize: "0.8rem",
                      }}
                    >
                      {o.username || o.email || "Customer"} · {o.itemCount} item
                      {o.itemCount === 1 ? "" : "s"} · {relTime(o.createdAt)}
                    </div>
                  </div>
                  <span className={statusBadge(o.status)}>{o.status}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="ops-card">
          <div className="ops-card-head">
            <h2>System & backups</h2>
            {data?.system.durableWriteConfigured ? (
              <span className="ops-badge ops-badge-green">Durable</span>
            ) : (
              <span className="ops-badge ops-badge-yellow">Setup needed</span>
            )}
          </div>
          <ul className="ops-activity">
            <li>
              <div>
                <strong>Durable store</strong>
                <div
                  style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}
                >
                  {data?.system.lastPersistDetail || "Checking…"}
                </div>
              </div>
              <span
                className={
                  data?.system.lastPersistOk === false
                    ? "ops-badge ops-badge-red"
                    : data?.system.durableWriteConfigured
                      ? "ops-badge ops-badge-green"
                      : "ops-badge ops-badge-yellow"
                }
              >
                {data?.system.durableWriteConfigured ? "Live" : "Local"}
              </span>
            </li>
            <li>
              <div>
                <strong>Shopify checkout</strong>
                <div
                  style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}
                >
                  {data?.system.shopifyCheckoutReady
                    ? "Ready for paid checkouts"
                    : "Not fully connected"}
                </div>
              </div>
              <span
                className={
                  data?.system.shopifyCheckoutReady
                    ? "ops-badge ops-badge-green"
                    : "ops-badge ops-badge-yellow"
                }
              >
                {data?.system.shopifyCheckoutReady ? "Ready" : "Pending"}
              </span>
            </li>
            <li>
              <div>
                <strong>Google Sheets backup</strong>
                <div
                  style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}
                >
                  {data?.system.googleSheetsNote}
                </div>
              </div>
              <span className="ops-badge ops-badge-gray">Later</span>
            </li>
          </ul>
          <div className="ops-actions-grid" style={{ marginTop: "0.75rem" }}>
            <Link className="ops-action" href="/ops/backups">
              Backups & System
            </Link>
            <Link className="ops-action" href="/ops/admin">
              Administration
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
