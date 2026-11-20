"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Attempt = {
  id: string;
  at: string;
  status: string;
  destination: string;
  detail: string;
  recordCounts?: Record<string, number>;
};

export default function OpsBackupsPage() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [sheets, setSheets] = useState<{
    connected?: boolean;
    spreadsheetId?: string;
    spreadsheetName?: string;
    envReady?: boolean;
    lastBackupDetail?: string;
    serviceAccountEmail?: string;
  }>({});
  const [persist, setPersist] = useState<{
    durableWriteConfigured?: boolean;
    lastPersistOk?: boolean;
    lastPersistDetail?: string;
  }>({});
  const [requiredEnv, setRequiredEnv] = useState<string[]>([]);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/backups", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load backups");
      return;
    }
    setAttempts(data.attempts || []);
    setSheets(data.googleSheets || {});
    setPersist(data.persist || {});
    setRequiredEnv(data.requiredEnv || []);
    setSpreadsheetId(data.googleSheets?.spreadsheetId || "");
    setError("");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveConfig(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/ops/backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_sheets_config",
        spreadsheetId,
        spreadsheetName:
          "Ballard's Bowling Academy — Business Management & Backup",
        connected: Boolean(spreadsheetId.trim()),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setMessage("Sheets spreadsheet ID saved. Durable store remains source of truth.");
    await load();
  }

  async function runAction(action: string) {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/ops/backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Action failed");
      return;
    }
    setMessage(data.message || data.attempt?.detail || "Done");
    await load();
  }

  return (
    <div className="ops-dash-grid">
      <div>
        <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", fontWeight: 750 }}>
          Backups & System
        </h2>
        <p className="ops-note" style={{ marginTop: 0 }}>
          Protect business information. The durable store is the source of truth.
          Google Sheets is a secondary backup — if Sheets is down, the site keeps
          working and queues retry jobs.
        </p>
      </div>

      {error ? (
        <div className="ops-stage-banner" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="ops-stage-banner" role="status">
          {message}
        </div>
      ) : null}
      {!persist.durableWriteConfigured ? (
        <div className="ops-stage-banner" role="status">
          Durable write is not configured on this environment. Set Blob / Redis /
          GitHub token in Vercel before trusting production records.
        </div>
      ) : null}

      <section className="ops-kpi-row">
        <article className="ops-card">
          <p className="ops-kpi-label">Durable write</p>
          <p className="ops-kpi-value" style={{ fontSize: "1.1rem" }}>
            {persist.durableWriteConfigured ? "Configured" : "Not set"}
          </p>
          <p className="ops-kpi-meta">{persist.lastPersistDetail || "—"}</p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">Sheets env</p>
          <p className="ops-kpi-value" style={{ fontSize: "1.1rem" }}>
            {sheets.envReady ? "Credentials present" : "Needs env"}
          </p>
          <p className="ops-kpi-meta">
            {sheets.connected ? "Spreadsheet linked" : "No spreadsheet ID yet"}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">Last attempt</p>
          <p className="ops-kpi-value" style={{ fontSize: "1.1rem" }}>
            {attempts[0]?.status || "None"}
          </p>
          <p className="ops-kpi-meta">
            {attempts[0]
              ? new Date(attempts[0].at).toLocaleString()
              : "No backups yet"}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">Actions</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="ops-primary-btn"
              disabled={busy}
              onClick={() => void runAction("manual_backup")}
            >
              Run backup / queue
            </button>
            <button
              type="button"
              className="ops-ghost-btn"
              disabled={busy}
              onClick={() => void runAction("self_test")}
            >
              Durable self-test
            </button>
          </div>
        </article>
      </section>

      <section className="ops-dash-mid">
        <form className="ops-card" onSubmit={saveConfig}>
          <div className="ops-card-head">
            <h2>Google Sheets connection</h2>
            <span
              className={
                sheets.connected
                  ? "ops-badge ops-badge-green"
                  : "ops-badge ops-badge-gray"
              }
            >
              {sheets.connected ? "Linked" : "Not linked"}
            </span>
          </div>
          <p className="ops-note">
            Spreadsheet name:{" "}
            <strong>
              Ballard&apos;s Bowling Academy — Business Management & Backup
            </strong>
            . Tabs: Dashboard, Sales, Orders, Coaching, Memberships, Customers,
            Expenses, Inventory, Refunds, Backup Log. Put service-account
            credentials in Vercel env — not in git.
          </p>
          <label className="ops-note" style={{ display: "block", marginTop: 12 }}>
            Spreadsheet ID
            <input
              className="field"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="from sheets.google.com/…/d/SPREADSHEET_ID/edit"
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
          <button
            type="submit"
            className="ops-primary-btn"
            style={{ marginTop: "0.85rem" }}
            disabled={busy}
          >
            Save spreadsheet ID
          </button>
          <ul className="ops-note" style={{ marginTop: "0.85rem", paddingLeft: "1.1rem" }}>
            {requiredEnv.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </form>

        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Backup history</h2>
            <Link href="/ops/integrations" className="ops-ghost-btn">
              Integrations
            </Link>
          </div>
          {!attempts.length ? (
            <p className="ops-note">No backup attempts recorded yet.</p>
          ) : (
            <ul className="ops-activity">
              {attempts.map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>
                      {a.destination} · {a.status}
                    </strong>
                    <div style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}>
                      {new Date(a.at).toLocaleString()} · {a.detail}
                      {a.recordCounts
                        ? ` · ${Object.entries(a.recordCounts)
                            .map(([k, v]) => `${k}:${v}`)
                            .join(", ")}`
                        : ""}
                    </div>
                  </div>
                  <span
                    className={
                      a.status === "success"
                        ? "ops-badge ops-badge-green"
                        : a.status === "failed"
                          ? "ops-badge ops-badge-red"
                          : "ops-badge ops-badge-yellow"
                    }
                  >
                    {a.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
