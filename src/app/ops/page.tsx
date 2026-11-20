"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconBackups,
  IconFinances,
  IconInventory,
  IconMemberships,
  IconOrders,
} from "@/components/ops/OpsIcons";
import { OpsEmpty, OpsPageHeader, OpsStatCard } from "@/components/ops/OpsUi";

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

  const breakdown = data?.salesBreakdown || {
    shop: 0,
    coaching: 0,
    memberships: 0,
  };
  const breakdownTotal =
    breakdown.shop + breakdown.coaching + breakdown.memberships;
  const breakdownMax = Math.max(
    1,
    breakdown.shop,
    breakdown.coaching,
    breakdown.memberships
  );

  const donutStyle = useMemo(() => {
    const total = Math.max(breakdownTotal, 0.0001);
    const shop = (breakdown.shop / total) * 100;
    const coaching = (breakdown.coaching / total) * 100;
    const memberships = (breakdown.memberships / total) * 100;
    const a = shop;
    const b = shop + coaching;
    return {
      background: `conic-gradient(#e10600 0 ${a}%, #38bdf8 ${a}% ${b}%, #a78bfa ${b}% 100%)`,
    };
  }, [breakdown.shop, breakdown.coaching, breakdown.memberships, breakdownTotal]);

  return (
    <div className="ops-dash-grid">
      <OpsPageHeader
        title="Business overview"
        description="Live paid revenue, orders, memberships, coaching, inventory alerts, and system health — no placeholder totals."
        actions={
          <>
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={range === r.key ? "ops-primary-btn" : "ops-ghost-btn"}
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
          </>
        }
      />

      {range === "custom" ? (
        <div
          className="ops-card"
          style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}
        >
          <label className="ops-note" style={{ margin: 0 }}>
            From
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="ops-note" style={{ margin: 0 }}>
            To
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
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
        <OpsStatCard
          tone="red"
          label="Today's revenue"
          value={loading ? "…" : money(data?.sales.today ?? 0)}
          meta={`Week ${money(data?.sales.week ?? 0)}`}
          icon={<IconFinances />}
        />
        <OpsStatCard
          tone="blue"
          label="Monthly revenue"
          value={loading ? "…" : money(data?.sales.month ?? 0)}
          meta={`Range ${money(data?.sales.range ?? 0)} · ${data?.range.label || range}`}
          icon={<IconOrders />}
        />
        <OpsStatCard
          tone="purple"
          label="Total orders"
          value={loading ? "…" : String(data?.sales.orderCountAll ?? 0)}
          meta={`${data?.sales.orderCountRange ?? 0} in range · avg ${money(data?.sales.averageOrder ?? 0)}`}
          icon={<IconOrders />}
        />
        <OpsStatCard
          tone="green"
          label="Active memberships"
          value={String(data?.memberships.activeCount ?? 0)}
          meta={`${money(data?.memberships.revenueCollected ?? 0)} collected`}
          icon={<IconMemberships />}
        />
      </section>

      <section className="ops-dash-mid">
        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Revenue over time</h2>
            <span className="ops-badge ops-badge-gray">
              {data?.range.label || range} · paid shop
            </span>
          </div>
          <div className="ops-spark" aria-hidden>
            {(data?.sales.dailySales || []).map((d) => (
              <span
                key={d.day}
                title={`${d.day}: ${money(d.total)}`}
                style={{
                  height: `${Math.max(6, (d.total / maxDaily) * 100)}%`,
                  opacity: d.total > 0 ? 0.95 : 0.18,
                }}
              />
            ))}
          </div>
          <p className="ops-note">
            Paid shop sales by day. Unpaid drafts and incomplete refunds are
            excluded from collected totals.
          </p>
        </article>

        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Sales breakdown</h2>
            <span className="ops-badge ops-badge-red">Paid only</span>
          </div>
          <div className="ops-donut-wrap">
            <div className="ops-donut" style={donutStyle}>
              <div className="ops-donut-center">
                <strong>{money(breakdownTotal)}</strong>
                <span>combined</span>
              </div>
            </div>
            <div className="ops-breakdown-list">
              {(
                [
                  ["Shop", breakdown.shop, "#e10600"],
                  ["Coaching", breakdown.coaching, "#38bdf8"],
                  ["Memberships", breakdown.memberships, "#a78bfa"],
                ] as const
              ).map(([label, value, color]) => (
                <div key={label} className="ops-breakdown-row">
                  <header>
                    <span>{label}</span>
                    <strong>{money(value)}</strong>
                  </header>
                  <div className="ops-breakdown-track">
                    <div
                      className="ops-breakdown-fill"
                      style={{
                        width: `${Math.max(2, (value / breakdownMax) * 100)}%`,
                        background: color,
                        opacity: value > 0 ? 1 : 0.25,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="ops-dash-third">
        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Recent orders</h2>
            <Link href="/ops/orders" className="ops-ghost-btn">
              View all
            </Link>
          </div>
          {loading ? (
            <OpsEmpty>Loading…</OpsEmpty>
          ) : !data?.recentOrders?.length ? (
            <OpsEmpty>No paid orders yet.</OpsEmpty>
          ) : (
            <div className="ops-table-wrap">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.username || o.email}</strong>
                        <div style={{ color: "var(--ops-muted)", fontSize: "0.75rem" }}>
                          #{o.id.slice(0, 8)} · {o.itemCount} item
                          {o.itemCount === 1 ? "" : "s"}
                        </div>
                      </td>
                      <td>{money(o.total)}</td>
                      <td>
                        <span className={statusBadge(o.status)}>{o.status}</span>
                      </td>
                      <td>{relTime(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Upcoming coaching</h2>
            <Link href="/ops/coaching" className="ops-ghost-btn">
              Manage
            </Link>
          </div>
          {(data?.coaching.upcomingBookings?.length || 0) > 0 ? (
            <ul className="ops-activity">
              {data!.coaching.upcomingBookings.map((b) => (
                <li key={b.id}>
                  <span className="ops-activity-dot" aria-hidden />
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
            <OpsEmpty>{data?.coaching.note || "No upcoming lessons."}</OpsEmpty>
          )}
        </article>

        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Recent activity</h2>
          </div>
          {(data?.activity?.length || 0) > 0 ? (
            <ul className="ops-activity">
              {data!.activity.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <span
                    className="ops-activity-dot"
                    style={{ background: "#38bdf8", boxShadow: "0 0 0 4px rgba(56,189,248,0.12)" }}
                    aria-hidden
                  />
                  <div>
                    <strong>
                      {a.action} · {a.entityType}
                    </strong>
                    <div style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}>
                      {a.actorName || "system"}
                      {a.detail ? ` · ${a.detail}` : ""}
                    </div>
                  </div>
                  <span style={{ color: "var(--ops-muted)", fontSize: "0.75rem" }}>
                    {relTime(a.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <OpsEmpty>No recent activity logged.</OpsEmpty>
          )}
        </article>
      </section>

      <section className="ops-dash-bottom">
        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Inventory alerts</h2>
            <IconInventory aria-hidden />
          </div>
          {(data?.inventory.alerts?.length || 0) > 0 ? (
            <ul className="ops-activity">
              {data!.inventory.alerts.map((a) => (
                <li key={a.id}>
                  <span
                    className="ops-activity-dot"
                    style={{
                      background: a.kind === "out" ? "#e10600" : "#fbbf24",
                      boxShadow:
                        a.kind === "out"
                          ? "0 0 0 4px rgba(225,6,0,0.12)"
                          : "0 0 0 4px rgba(251,191,36,0.12)",
                    }}
                    aria-hidden
                  />
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
            <OpsEmpty>No inventory alerts right now.</OpsEmpty>
          )}
          <p className="ops-note">
            {data?.inventory.activeCount ?? 0} active ·{" "}
            {data?.inventory.lowStockCount ?? 0} low ·{" "}
            {data?.inventory.outOfStockCount ?? 0} out
          </p>
        </article>

        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Membership alerts</h2>
            <IconMemberships aria-hidden />
          </div>
          <div className="ops-stat-list">
            <div>
              <strong>{data?.memberships.activeCount ?? 0}</strong>
              <span>Active</span>
            </div>
            <div>
              <strong>{data?.memberships.totalCount ?? 0}</strong>
              <span>Total</span>
            </div>
          </div>
          <p className="ops-note">
            {money(data?.memberships.revenueCollected ?? 0)} collected from paid
            memberships. Renewals and cancellations are managed on the
            Memberships page.
          </p>
          <Link href="/ops/memberships" className="ops-action" style={{ marginTop: "0.75rem" }}>
            Open memberships
          </Link>
        </article>

        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Google Sheets backup</h2>
            <IconBackups aria-hidden />
          </div>
          <p style={{ margin: 0, fontSize: "0.92rem" }}>
            <span
              className={
                data?.system.googleSheetsConnected
                  ? "ops-badge ops-badge-green"
                  : "ops-badge ops-badge-gray"
              }
            >
              {data?.system.googleSheetsConnected ? "Connected" : "Not connected"}
            </span>
          </p>
          <p className="ops-note">{data?.system.googleSheetsNote}</p>
          {data?.system.lastBackupAt ? (
            <p className="ops-note">Last backup {relTime(data.system.lastBackupAt)}</p>
          ) : null}
          <Link href="/ops/backups" className="ops-action" style={{ marginTop: "0.75rem" }}>
            Backup settings
          </Link>
        </article>

        <article className="ops-card">
          <div className="ops-card-head">
            <h2>System health</h2>
          </div>
          <ul className="ops-activity">
            <li>
              <span
                className="ops-activity-dot"
                style={{
                  background: data?.system.durableWriteConfigured ? "#22c55e" : "#fbbf24",
                  boxShadow: data?.system.durableWriteConfigured
                    ? "0 0 0 4px rgba(34,197,94,0.12)"
                    : "0 0 0 4px rgba(251,191,36,0.12)",
                }}
                aria-hidden
              />
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
              <span
                className="ops-activity-dot"
                style={{
                  background: data?.system.shopifyCheckoutReady ? "#22c55e" : "#38bdf8",
                  boxShadow: "0 0 0 4px rgba(56,189,248,0.12)",
                }}
                aria-hidden
              />
              <div>
                <strong>Shopify checkout</strong>
                <div style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}>
                  {data?.system.shopifyCheckoutReady
                    ? "Ready for paid checkouts"
                    : "Needs connection"}
                </div>
              </div>
              <span
                className={
                  data?.system.shopifyCheckoutReady
                    ? "ops-badge ops-badge-green"
                    : "ops-badge ops-badge-blue"
                }
              >
                {data?.system.shopifyCheckoutReady ? "Ready" : "Setup"}
              </span>
            </li>
          </ul>
          <div className="ops-actions-grid" style={{ marginTop: "0.5rem" }}>
            <Link className="ops-action" href="/ops/backups">
              Backups
            </Link>
            <Link className="ops-action" href="/ops/integrations">
              Integrations
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
