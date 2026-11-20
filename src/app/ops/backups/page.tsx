"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Health = {
  warning?: string;
  productCount?: number;
  persist?: {
    durableWriteConfigured?: boolean;
    lastPersistOk?: boolean;
    lastPersistDetail?: string;
    backends?: {
      blob?: { ok?: boolean; detail?: string };
      redis?: { ok?: boolean; detail?: string };
      github?: { ok?: boolean; detail?: string };
    };
  };
  shopify?: {
    checkoutReady?: boolean;
    configured?: boolean;
    webhookConfigured?: boolean;
  };
};

export default function OpsBackupsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Health check failed");
      setHealth(d);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSelfTest() {
    setTesting(true);
    setTestMsg("");
    try {
      const res = await fetch("/api/persist/self-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const d = await res.json();
      setTestMsg(
        d.ok
          ? d.help || "Save/load OK."
          : d.help || d.detail || "Save/load failed."
      );
      await load();
    } catch {
      setTestMsg("Could not reach save/load self-test.");
    } finally {
      setTesting(false);
    }
  }

  const persist = health?.persist;

  return (
    <div className="ops-dash-grid">
      <div>
        <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", fontWeight: 750 }}>
          Backups & System
        </h2>
        <p className="ops-note" style={{ marginTop: 0 }}>
          Protect business information. The durable store (Blob / Redis / GitHub)
          is the source of truth today. Google Sheets backup comes in a later
          stage and will never replace the main database.
        </p>
      </div>

      {error ? (
        <div className="ops-stage-banner" role="alert">
          {error}
        </div>
      ) : null}
      {health?.warning ? (
        <div className="ops-stage-banner" role="status">
          {health.warning}
        </div>
      ) : null}
      {testMsg ? (
        <div className="ops-stage-banner" role="status">
          {testMsg}
        </div>
      ) : null}

      <section className="ops-kpi-row">
        <article className="ops-card">
          <p className="ops-kpi-label">Durable write</p>
          <p className="ops-kpi-value" style={{ fontSize: "1.15rem" }}>
            {persist?.durableWriteConfigured ? "Configured" : "Not set"}
          </p>
          <p className="ops-kpi-meta">
            {persist?.lastPersistDetail || "No detail yet"}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">Last persist</p>
          <p className="ops-kpi-value" style={{ fontSize: "1.15rem" }}>
            {persist?.lastPersistOk === true
              ? "OK"
              : persist?.lastPersistOk === false
                ? "Failed"
                : "Unknown"}
          </p>
          <p className="ops-kpi-meta">
            {health?.productCount != null
              ? `${health.productCount} products in catalog`
              : "—"}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">Shopify</p>
          <p className="ops-kpi-value" style={{ fontSize: "1.15rem" }}>
            {health?.shopify?.checkoutReady ? "Checkout ready" : "Setup needed"}
          </p>
          <p className="ops-kpi-meta">
            Webhook{" "}
            {health?.shopify?.webhookConfigured ? "configured" : "missing"}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">Google Sheets</p>
          <p className="ops-kpi-value" style={{ fontSize: "1.15rem" }}>
            Planned
          </p>
          <p className="ops-kpi-meta">
            Backup spreadsheet tabs come after Sales, Coaching, and Memberships.
          </p>
        </article>
      </section>

      <section className="ops-dash-mid">
        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Backend status</h2>
            <button
              type="button"
              className="ops-primary-btn"
              onClick={() => void runSelfTest()}
              disabled={testing}
            >
              {testing ? "Testing…" : "Run save/load test"}
            </button>
          </div>
          <ul className="ops-activity">
            {(
              [
                ["Blob", persist?.backends?.blob],
                ["Redis", persist?.backends?.redis],
                ["GitHub", persist?.backends?.github],
              ] as const
            ).map(([name, backend]) => (
              <li key={name}>
                <div>
                  <strong>{name}</strong>
                  <div style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}>
                    {backend?.detail || "No recent result"}
                  </div>
                </div>
                <span
                  className={
                    backend?.ok
                      ? "ops-badge ops-badge-green"
                      : "ops-badge ops-badge-yellow"
                  }
                >
                  {backend?.ok ? "OK" : "Check"}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Planned Sheets tabs</h2>
            <span className="ops-badge ops-badge-gray">Later stage</span>
          </div>
          <p className="ops-note">
            One spreadsheet:{" "}
            <strong>
              Ballard&apos;s Bowling Academy – Business Management & Backup
            </strong>
            . Tabs: Dashboard, Sales, Orders, Coaching, Memberships, Customers,
            Expenses, Inventory, Refunds, Backup Log, Settings. Each transaction
            gets a unique ID so rows are never duplicated.
          </p>
          <div className="ops-actions-grid" style={{ marginTop: "0.85rem" }}>
            <Link className="ops-action" href="/ops/admin">
              Administration
            </Link>
            <Link className="ops-action" href="/ops">
              Dashboard
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
