"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function OpsFinancesPage() {
  const [sales, setSales] = useState<{
    today: number;
    month: number;
    year: number;
    allTime: number;
    orderCountAll: number;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ops/overview", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");
        if (!cancelled) setSales(json.sales);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="ops-dash-grid">
      <div>
        <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", fontWeight: 750 }}>
          Finances
        </h2>
        <p className="ops-note" style={{ marginTop: 0 }}>
          Collected shop revenue from paid orders only. Expenses, refunds,
          processing fees, and coaching costs will be added in later stages —
          unpaid drafts are never treated as money collected.
        </p>
      </div>

      {error ? (
        <div className="ops-stage-banner" role="alert">
          {error}
        </div>
      ) : null}

      <section className="ops-kpi-row">
        <article className="ops-card ops-card-red">
          <p className="ops-kpi-label">Collected today</p>
          <p className="ops-kpi-value">
            {sales ? money(sales.today) : "…"}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">This month</p>
          <p className="ops-kpi-value">
            {sales ? money(sales.month) : "…"}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">This year</p>
          <p className="ops-kpi-value">
            {sales ? money(sales.year) : "…"}
          </p>
        </article>
        <article className="ops-card ops-card-green">
          <p className="ops-kpi-label">All-time paid</p>
          <p className="ops-kpi-value">
            {sales ? money(sales.allTime) : "…"}
          </p>
          <p className="ops-kpi-meta">
            {sales ? `${sales.orderCountAll} paid orders` : "—"}
          </p>
        </article>
      </section>

      <article className="ops-card">
        <div className="ops-card-head">
          <h2>Coming next</h2>
          <span className="ops-badge ops-badge-gray">Stage later</span>
        </div>
        <p className="ops-note">
          Business expenses, refunds, processing fees, product costs, coaching
          expenses, and net profit summaries. Until then, only verified paid shop
          totals are shown.
        </p>
        <div className="ops-actions-grid" style={{ marginTop: "0.85rem" }}>
          <Link className="ops-action" href="/ops/orders">
            Sales & Orders
          </Link>
          <Link className="ops-action" href="/ops/reports">
            Reports
          </Link>
        </div>
      </article>
    </div>
  );
}
