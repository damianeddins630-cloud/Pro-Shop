"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Overview = {
  sales: {
    today: number;
    month: number;
    year: number;
    orderCountMonth: number;
    orderCountAll: number;
    averageOrder: number;
    dailySales: { day: number; total: number }[];
  };
  inventory: {
    activeCount: number;
    lowStockCount: number;
    needsPriceCount: number;
  };
  customers: { accountCount: number; subscriberCount: number };
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function OpsReportsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ops/overview", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
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

  return (
    <div className="ops-dash-grid">
      <div>
        <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", fontWeight: 750 }}>
          Reports & Analytics
        </h2>
        <p className="ops-note" style={{ marginTop: 0 }}>
          Performance from live paid sales and catalog data. Best-sellers,
          coaching popularity, and membership growth reports arrive after those
          modules ship — staff should not need to calculate figures the system
          can generate.
        </p>
      </div>

      {error ? (
        <div className="ops-stage-banner" role="alert">
          {error}
        </div>
      ) : null}

      <section className="ops-kpi-row">
        <article className="ops-card ops-card-red">
          <p className="ops-kpi-label">Month sales</p>
          <p className="ops-kpi-value">
            {data ? money(data.sales.month) : "…"}
          </p>
          <p className="ops-kpi-meta">
            {data ? `${data.sales.orderCountMonth} paid orders` : "—"}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">Year sales</p>
          <p className="ops-kpi-value">
            {data ? money(data.sales.year) : "…"}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">Average order</p>
          <p className="ops-kpi-value">
            {data ? money(data.sales.averageOrder) : "…"}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">Today</p>
          <p className="ops-kpi-value">
            {data ? money(data.sales.today) : "…"}
          </p>
        </article>
      </section>

      <section className="ops-dash-mid">
        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Daily paid sales · this month</h2>
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
        </article>
        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Catalog snapshot</h2>
          </div>
          <div className="ops-stat-list">
            <div>
              <strong>{data?.inventory.activeCount ?? "—"}</strong>
              <span>Active products</span>
            </div>
            <div>
              <strong>{data?.inventory.lowStockCount ?? "—"}</strong>
              <span>Low stock</span>
            </div>
            <div>
              <strong>{data?.customers.accountCount ?? "—"}</strong>
              <span>Customers</span>
            </div>
            <div>
              <strong>{data?.customers.subscriberCount ?? "—"}</strong>
              <span>Subscribers</span>
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
