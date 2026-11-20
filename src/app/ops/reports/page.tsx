"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Overview = {
  range: { label: string };
  sales: {
    today: number;
    week: number;
    month: number;
    year: number;
    range: number;
    orderCountRange: number;
    averageOrder: number;
    dailySales: { day: string; total: number }[];
  };
  coaching: { revenueCollected: number; sessionsBooked: number };
  memberships: { revenueCollected: number; activeCount: number };
  finances: {
    totalCollectedMonth: number;
    expensesTotal: number;
    netProfitMonth: number;
  };
  inventory: {
    activeCount: number;
    lowStockCount: number;
    needsPriceCount: number;
  };
  customers: { accountCount: number; subscriberCount: number };
  salesBreakdown: { shop: number; coaching: number; memberships: number };
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function OpsReportsPage() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/ops/overview?range=${range}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Failed to load");
      return;
    }
    setData(json);
    setError("");
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDaily = useMemo(() => {
    if (!data?.sales.dailySales?.length) return 1;
    return Math.max(1, ...data.sales.dailySales.map((d) => d.total));
  }, [data]);

  return (
    <div className="ops-dash-grid">
      <div className="ops-card-head" style={{ marginBottom: 0 }}>
        <div>
          <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", fontWeight: 750 }}>
            Reports & Analytics
          </h2>
          <p className="ops-note" style={{ marginTop: 0 }}>
            Every figure comes from paid orders, paid coaching/memberships, and
            recorded expenses — not sample data.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["today", "7d", "30d", "90d"].map((r) => (
            <button
              key={r}
              type="button"
              className={range === r ? "ops-primary-btn" : "ops-ghost-btn"}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
          <a className="ops-ghost-btn" href="/api/ops/sales/export">
            Export sales CSV
          </a>
        </div>
      </div>

      {error ? (
        <div className="ops-stage-banner" role="alert">
          {error}
        </div>
      ) : null}

      <section className="ops-kpi-row">
        <article className="ops-card ops-card-red">
          <p className="ops-kpi-label">Shop sales · range</p>
          <p className="ops-kpi-value">{money(data?.sales.range ?? 0)}</p>
          <p className="ops-kpi-meta">
            {data?.sales.orderCountRange ?? 0} paid orders · avg{" "}
            {money(data?.sales.averageOrder ?? 0)}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">Coaching collected</p>
          <p className="ops-kpi-value">
            {money(data?.coaching.revenueCollected ?? 0)}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">Memberships collected</p>
          <p className="ops-kpi-value">
            {money(data?.memberships.revenueCollected ?? 0)}
          </p>
        </article>
        <article className="ops-card ops-card-green">
          <p className="ops-kpi-label">Net · month</p>
          <p className="ops-kpi-value">
            {money(data?.finances.netProfitMonth ?? 0)}
          </p>
          <p className="ops-kpi-meta">
            Expenses {money(data?.finances.expensesTotal ?? 0)}
          </p>
        </article>
      </section>

      <section className="ops-dash-mid">
        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Daily paid shop sales</h2>
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
        </article>
        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Snapshot</h2>
          </div>
          <div className="ops-stat-list">
            <div>
              <strong>{money(data?.sales.today ?? 0)}</strong>
              <span>Today</span>
            </div>
            <div>
              <strong>{money(data?.sales.week ?? 0)}</strong>
              <span>Week</span>
            </div>
            <div>
              <strong>{money(data?.sales.month ?? 0)}</strong>
              <span>Month</span>
            </div>
            <div>
              <strong>{money(data?.sales.year ?? 0)}</strong>
              <span>Year</span>
            </div>
            <div>
              <strong>{data?.memberships.activeCount ?? 0}</strong>
              <span>Active members</span>
            </div>
            <div>
              <strong>{data?.customers.accountCount ?? 0}</strong>
              <span>Customers</span>
            </div>
          </div>
          <div className="ops-actions-grid" style={{ marginTop: "0.85rem" }}>
            <Link className="ops-action" href="/ops/finances">
              Finances
            </Link>
            <Link className="ops-action" href="/ops/orders">
              Sales & Orders
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
