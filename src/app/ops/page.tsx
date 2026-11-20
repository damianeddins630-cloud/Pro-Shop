"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Overview = {
  generatedAt: string;
  range: { label: string; from: string; to: string };
  sales: {
    today: number;
    week: number;
    month: number;
    year: number;
    range: number;
    allTime: number;
    orderCountToday: number;
    orderCountWeek: number;
    orderCountMonth: number;
    orderCountRange: number;
    orderCountAll: number;
    averageOrder: number;
    dailySales: { day: string; total: number }[];
  };
  coaching: {
    revenueCollected: number;
    sessionsBooked: number;
    packages: number;
    upcomingLessons: number;
    upcomingBookings: {
      id: string;
      title: string;
      date: string;
      startTime: string;
      customerName: string;
      coachName: string;
    }[];
    note: string;
  };
  memberships: {
    revenueCollected: number;
    activeCount: number;
    totalCount: number;
    note: string;
  };
  finances: {
    shopRevenueMonth: number;
    coachingRevenue: number;
    membershipRevenue: number;
    totalCollectedMonth: number;
    expensesTotal: number;
    netProfitMonth: number;
  };
  salesBreakdown: { shop: number; coaching: number; memberships: number };
  inventory: {
    productCount: number;
    activeCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    needsPriceCount: number;
    unitsInStock: number;
    alerts: { id: string; name: string; stock: number; kind: "low" | "out" }[];
  };
  customers: {
    accountCount: number;
    subscriberCount: number;
    recent: { id: string; username: string; email: string; createdAt: string }[];
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
  activity: {
    id: string;
    at: string;
    actorName?: string;
    action: string;
    entityType: string;
    detail?: string;
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
    lastBackupAt: string | null;
  };
};

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
] as const;

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
  const [range, setRange] = useState<string>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (range === "custom" && customFrom) {
        params.set("range", "custom");
        params.set("from", customFrom);
        if (customTo) params.set("to", customTo);
      } else {
        params.set("range", range);
      }
      const res = await fetch(`/api/ops/overview?${params}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not load overview");
      setData(json as Overview);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [range, customFrom, customTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDaily = useMemo(() => {
    if (!data?.sales.dailySales?.length) return 1;
    return Math.max(1, ...data.sales.dailySales.map((d) => d.total));
  }, [data]);

  const breakdownMax = useMemo(() => {
    if (!data) return 1;
    return Math.max(
      1,
      data.salesBreakdown.shop,
      data.salesBreakdown.coaching,
      data.salesBreakdown.memberships
    );
  }, [data]);

  return (
    <div className="ops-dash-grid">
      <div className="ops-card-head" style={{ marginBottom: 0 }}>
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
            Live business overview from paid orders, coaching, memberships,
            expenses, and system health — no placeholder revenue.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={
                range === r.key ? "ops-primary-btn" : "ops-ghost-btn"
              }
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            className={range === "custom" ? "ops-primary-btn" : "ops-ghost-btn"}
            onClick={() => setRange("custom")}
          >
            Custom
          </button>
        </div>
      </div>

      {range === "custom" ? (
        <div className="ops-card" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ fontSize: "0.8rem", color: "var(--ops-muted)" }}>
            From
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{
                display: "block",
                marginTop: 4,
                background: "#0c0c0f",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: "0.4rem 0.6rem",
                color: "#fff",
              }}
            />
          </label>
          <label style={{ fontSize: "0.8rem", color: "var(--ops-muted)" }}>
            To
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{
                display: "block",
                marginTop: 4,
                background: "#0c0c0f",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: "0.4rem 0.6rem",
                color: "#fff",
              }}
            />
          </label>
          <button type="button" className="ops-primary-btn" onClick={() => void load()}>
            Apply
          </button>
        </div>
      ) : null}

      {!data?.system.durableWriteConfigured ? (
        <div className="ops-stage-banner" role="status">
          Durable storage is not fully configured. Add Blob, Redis, or GitHub
          persistence in Vercel before trusting production business records.
          Google Sheets is a backup only — never the primary database.
        </div>
      ) : null}

      {error ? (
        <div className="ops-stage-banner" role="alert">
          {error}
        </div>
      ) : null}

      <section className="ops-kpi-row" aria-label="Key metrics">
        <article className="ops-card ops-card-red">
          <p className="ops-kpi-label">Shop sales · range</p>
          <p className="ops-kpi-value">
            {loading ? "…" : money(data?.sales.range ?? 0)}
          </p>
          <p className="ops-kpi-meta">
            Today {money(data?.sales.today ?? 0)} · Week{" "}
            {money(data?.sales.week ?? 0)} · Month{" "}
            {money(data?.sales.month ?? 0)}
          </p>
        </article>
        <article className="ops-card ops-card-blue">
          <p className="ops-kpi-label">Coaching revenue</p>
          <p className="ops-kpi-value">
            {money(data?.coaching.revenueCollected ?? 0)}
          </p>
          <p className="ops-kpi-meta">
            {data?.coaching.upcomingLessons ?? 0} upcoming ·{" "}
            {data?.coaching.sessionsBooked ?? 0} bookings
          </p>
        </article>
        <article className="ops-card ops-card-purple">
          <p className="ops-kpi-label">Membership revenue</p>
          <p className="ops-kpi-value">
            {money(data?.memberships.revenueCollected ?? 0)}
          </p>
          <p className="ops-kpi-meta">
            {data?.memberships.activeCount ?? 0} active ·{" "}
            {data?.memberships.totalCount ?? 0} total
          </p>
        </article>
        <article className="ops-card ops-card-green">
          <p className="ops-kpi-label">Net · this month</p>
          <p className="ops-kpi-value">
            {loading ? "…" : money(data?.finances.netProfitMonth ?? 0)}
          </p>
          <p className="ops-kpi-meta">
            Collected {money(data?.finances.totalCollectedMonth ?? 0)} −
            expenses {money(data?.finances.expensesTotal ?? 0)}
          </p>
        </article>
      </section>

      <section className="ops-dash-mid">
        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Revenue overview</h2>
            <span className="ops-badge ops-badge-gray">
              {data?.range.label || range} · paid
            </span>
          </div>
          <div className="ops-spark" aria-hidden>
            {(data?.sales.dailySales || []).map((d) => (
              <span
                key={d.day}
                title={`${d.day}: ${money(d.total)}`}
                style={{
                  height: `${Math.max(4, (d.total / maxDaily) * 100)}%`,
                  opacity: d.total > 0 ? 0.95 : 0.2,
                }}
              />
            ))}
          </div>
          <p className="ops-note">
            Paid shop sales by day in the selected range. Unpaid Shopify drafts
            and refunds are excluded from collected totals.
          </p>
        </article>

        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Sales breakdown</h2>
            <span className="ops-badge ops-badge-red">Paid only</span>
          </div>
          {(
            [
              ["Shop", data?.salesBreakdown.shop ?? 0, "#e10600"],
              ["Coaching", data?.salesBreakdown.coaching ?? 0, "#3b82f6"],
              ["Memberships", data?.salesBreakdown.memberships ?? 0, "#a855f7"],
            ] as const
          ).map(([label, value, color]) => (
            <div key={label} style={{ marginBottom: "0.75rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.85rem",
                  marginBottom: 4,
                }}
              >
                <span>{label}</span>
                <strong>{money(value)}</strong>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(2, (value / breakdownMax) * 100)}%`,
                    height: "100%",
                    background: color,
                    opacity: value > 0 ? 1 : 0.25,
                  }}
                />
              </div>
            </div>
          ))}
          <div className="ops-actions-grid" style={{ marginTop: "0.5rem" }}>
            <Link className="ops-action" href="/ops/orders">
              ◎ Sales & Orders
            </Link>
            <Link className="ops-action" href="/ops/coaching">
              ◈ Coaching
            </Link>
            <Link className="ops-action" href="/ops/memberships">
              ◇ Memberships
            </Link>
            <Link className="ops-action" href="/ops/finances">
              ⬡ Finances
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
              <span>Avg (range)</span>
            </div>
            <div>
              <strong>{data?.inventory.activeCount ?? "—"}</strong>
              <span>Active products</span>
            </div>
            <div>
              <strong>{data?.customers.accountCount ?? "—"}</strong>
              <span>Customers</span>
            </div>
            <div>
              <strong>{data?.inventory.lowStockCount ?? "—"}</strong>
              <span>Low stock</span>
            </div>
            <div>
              <strong>{data?.memberships.activeCount ?? "—"}</strong>
              <span>Active members</span>
            </div>
          </div>
          {(data?.inventory.alerts?.length || 0) > 0 ? (
            <ul className="ops-activity" style={{ marginTop: "0.75rem" }}>
              {data!.inventory.alerts.map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>{a.name}</strong>
                    <div style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}>
                      {a.stock} in stock
                    </div>
                  </div>
                  <span
                    className={
                      a.kind === "out"
                        ? "ops-badge ops-badge-red"
                        : "ops-badge ops-badge-yellow"
                    }
                  >
                    {a.kind === "out" ? "Out" : "Low"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ops-note">No inventory alerts right now.</p>
          )}
        </article>

        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Recent orders</h2>
            <Link href="/ops/orders" className="ops-ghost-btn">
              View all
            </Link>
          </div>
          {loading ? (
            <p className="ops-note">Loading…</p>
          ) : !data?.recentOrders?.length ? (
            <p className="ops-note">No paid orders yet.</p>
          ) : (
            <ul className="ops-activity">
              {data.recentOrders.map((o) => (
                <li key={o.id}>
                  <div>
                    <strong>
                      Order {o.id.slice(0, 8)} · {money(o.total)}
                    </strong>
                    <div style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}>
                      {o.username || o.email} · {relTime(o.createdAt)}
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
            <h2>Upcoming & system</h2>
          </div>
          {(data?.coaching.upcomingBookings?.length || 0) > 0 ? (
            <ul className="ops-activity">
              {data!.coaching.upcomingBookings.map((b) => (
                <li key={b.id}>
                  <div>
                    <strong>{b.title}</strong>
                    <div style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}>
                      {b.date} {b.startTime} · {b.customerName} · {b.coachName}
                    </div>
                  </div>
                  <span className="ops-badge ops-badge-blue">Lesson</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ops-note">{data?.coaching.note}</p>
          )}
          <ul className="ops-activity" style={{ marginTop: "0.5rem" }}>
            <li>
              <div>
                <strong>Durable store</strong>
                <div style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}>
                  {data?.system.lastPersistDetail || "—"}
                </div>
              </div>
              <span
                className={
                  data?.system.durableWriteConfigured
                    ? "ops-badge ops-badge-green"
                    : "ops-badge ops-badge-yellow"
                }
              >
                {data?.system.durableWriteConfigured ? "Live" : "Local"}
              </span>
            </li>
            <li>
              <div>
                <strong>Google Sheets backup</strong>
                <div style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}>
                  {data?.system.googleSheetsNote}
                </div>
              </div>
              <span
                className={
                  data?.system.googleSheetsConnected
                    ? "ops-badge ops-badge-green"
                    : "ops-badge ops-badge-gray"
                }
              >
                {data?.system.googleSheetsConnected ? "On" : "Later"}
              </span>
            </li>
          </ul>
          {(data?.activity?.length || 0) > 0 ? (
            <>
              <p className="ops-kpi-label" style={{ marginTop: "0.75rem" }}>
                Recent activity
              </p>
              <ul className="ops-activity">
                {data!.activity.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <div>
                      <strong>
                        {a.action} · {a.entityType}
                      </strong>
                      <div style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}>
                        {a.actorName || "system"} · {a.detail || ""} ·{" "}
                        {relTime(a.at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </article>
      </section>
    </div>
  );
}
