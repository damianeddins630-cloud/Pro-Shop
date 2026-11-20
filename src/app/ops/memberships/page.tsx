"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  BillingFrequency,
  Membership,
  MembershipStatus,
  PaymentCollectStatus,
} from "@/lib/types";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function OpsMembershipsPage() {
  const [rows, setRows] = useState<Membership[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    name: "Academy Membership",
    membershipType: "Standard",
    price: "0",
    billingFrequency: "monthly" as BillingFrequency,
    startDate: "",
    renewalDate: "",
    paymentStatus: "unpaid" as PaymentCollectStatus,
    status: "pending" as MembershipStatus,
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/memberships", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load memberships");
      setLoading(false);
      return;
    }
    setRows(data.memberships || []);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const collected = useMemo(
    () =>
      rows
        .filter((m) => m.paymentStatus === "paid")
        .reduce((s, m) => s + m.price, 0),
    [rows]
  );
  const active = rows.filter((m) => m.status === "active").length;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    const res = await fetch("/api/ops/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: Number(form.price) || 0,
        renewalDate: form.renewalDate || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not save");
      return;
    }
    setMessage(
      "Membership saved. Unpaid / cancelled memberships never count as collected revenue."
    );
    await load();
  }

  async function patch(id: string, body: Partial<Membership>) {
    const res = await fetch("/api/ops/memberships", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Update failed");
      return;
    }
    await load();
  }

  if (loading) return <p className="ops-note">Loading memberships…</p>;

  return (
    <div className="ops-dash-grid">
      <div>
        <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", fontWeight: 750 }}>
          Membership Management
        </h2>
        <p className="ops-note" style={{ marginTop: 0 }}>
          Track renewals and payment status. Collected (paid only):{" "}
          {money(collected)} · Active: {active}
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

      <form className="ops-card" onSubmit={onSubmit}>
        <div className="ops-card-head">
          <h2>Add membership</h2>
        </div>
        <div className="ops-stat-list">
          <label className="ops-note">
            Customer
            <input
              required
              className="field"
              value={form.customerName}
              onChange={(e) =>
                setForm((f) => ({ ...f, customerName: e.target.value }))
              }
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
          <label className="ops-note">
            Email
            <input
              className="field"
              value={form.customerEmail}
              onChange={(e) =>
                setForm((f) => ({ ...f, customerEmail: e.target.value }))
              }
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
          <label className="ops-note">
            Name
            <input
              required
              className="field"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
          <label className="ops-note">
            Type
            <input
              required
              className="field"
              value={form.membershipType}
              onChange={(e) =>
                setForm((f) => ({ ...f, membershipType: e.target.value }))
              }
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
          <label className="ops-note">
            Price
            <input
              required
              type="number"
              min="0"
              step="0.01"
              className="field"
              value={form.price}
              onChange={(e) =>
                setForm((f) => ({ ...f, price: e.target.value }))
              }
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
          <label className="ops-note">
            Billing
            <select
              className="field"
              value={form.billingFrequency}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  billingFrequency: e.target.value as BillingFrequency,
                }))
              }
              style={{ display: "block", width: "100%", marginTop: 4 }}
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
              <option value="one_time">One-time</option>
            </select>
          </label>
          <label className="ops-note">
            Start
            <input
              required
              type="date"
              className="field"
              value={form.startDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, startDate: e.target.value }))
              }
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
          <label className="ops-note">
            Renewal
            <input
              type="date"
              className="field"
              value={form.renewalDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, renewalDate: e.target.value }))
              }
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
          <label className="ops-note">
            Payment
            <select
              className="field"
              value={form.paymentStatus}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  paymentStatus: e.target.value as PaymentCollectStatus,
                }))
              }
              style={{ display: "block", width: "100%", marginTop: 4 }}
            >
              <option value="unpaid">Unpaid</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <label className="ops-note">
            Status
            <select
              className="field"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as MembershipStatus,
                }))
              }
              style={{ display: "block", width: "100%", marginTop: 4 }}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </label>
        </div>
        <button type="submit" className="ops-primary-btn" style={{ marginTop: "0.85rem" }}>
          Save membership
        </button>
      </form>

      <article className="ops-card">
        <div className="ops-card-head">
          <h2>{rows.length} memberships</h2>
        </div>
        {!rows.length ? (
          <p className="ops-note">No memberships yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
              <thead>
                <tr style={{ color: "var(--ops-muted)", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem" }}>Customer</th>
                  <th style={{ padding: "0.5rem" }}>Plan</th>
                  <th style={{ padding: "0.5rem" }}>Price</th>
                  <th style={{ padding: "0.5rem" }}>Status</th>
                  <th style={{ padding: "0.5rem" }}>Payment</th>
                  <th style={{ padding: "0.5rem" }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      <strong>{m.customerName}</strong>
                      <div style={{ color: "var(--ops-muted)", fontSize: "0.75rem" }}>
                        {m.customerEmail || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      {m.name}
                      <div style={{ color: "var(--ops-muted)", fontSize: "0.75rem" }}>
                        {m.membershipType} · {m.billingFrequency}
                      </div>
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>{money(m.price)}</td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      <span className="ops-badge ops-badge-gray">{m.status}</span>
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      <span
                        className={
                          m.paymentStatus === "paid"
                            ? "ops-badge ops-badge-green"
                            : "ops-badge ops-badge-yellow"
                        }
                      >
                        {m.paymentStatus}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {m.paymentStatus !== "paid" ? (
                          <button
                            type="button"
                            className="ops-ghost-btn"
                            onClick={() =>
                              void patch(m.id, {
                                paymentStatus: "paid",
                                status: "active",
                              })
                            }
                          >
                            Mark paid
                          </button>
                        ) : null}
                        {m.status !== "cancelled" ? (
                          <button
                            type="button"
                            className="ops-ghost-btn"
                            onClick={() =>
                              void patch(m.id, { status: "cancelled" })
                            }
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}
