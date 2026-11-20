"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  Coach,
  CoachingBooking,
  CoachingPackage,
  CoachingServiceType,
  PaymentCollectStatus,
} from "@/lib/types";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

const emptyBooking = {
  customerName: "",
  customerEmail: "",
  coachId: "",
  coachName: "",
  serviceType: "private" as CoachingServiceType,
  title: "Private lesson",
  date: "",
  startTime: "10:00",
  endTime: "11:00",
  price: "0",
  paymentStatus: "unpaid" as PaymentCollectStatus,
  bookingStatus: "scheduled" as const,
  notes: "",
};

export default function OpsCoachingPage() {
  const [bookings, setBookings] = useState<CoachingBooking[]>([]);
  const [packages, setPackages] = useState<CoachingPackage[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [form, setForm] = useState(emptyBooking);
  const [pkg, setPkg] = useState({
    customerName: "",
    customerEmail: "",
    name: "5-Pack Lessons",
    price: "0",
    sessionsPurchased: "5",
    paymentStatus: "unpaid" as PaymentCollectStatus,
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/coaching", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load coaching");
      setLoading(false);
      return;
    }
    setBookings(data.bookings || []);
    setPackages(data.packages || []);
    setCoaches(data.coaches || []);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const collected = useMemo(
    () =>
      bookings
        .filter((b) => b.paymentStatus === "paid")
        .reduce((s, b) => s + b.price, 0) +
      packages
        .filter((p) => p.paymentStatus === "paid")
        .reduce((s, p) => s + p.price, 0),
    [bookings, packages]
  );

  async function saveBooking(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const coach = coaches.find((c) => c.id === form.coachId);
    const res = await fetch("/api/ops/coaching", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "booking",
        ...form,
        coachName: coach?.name || form.coachName,
        price: Number(form.price) || 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not save booking");
      return;
    }
    setMessage("Booking saved. Unpaid sessions do not count as revenue.");
    setForm((f) => ({ ...emptyBooking, coachId: f.coachId, date: f.date }));
    await load();
  }

  async function savePackage(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/ops/coaching", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "package",
        ...pkg,
        price: Number(pkg.price) || 0,
        sessionsPurchased: Number(pkg.sessionsPurchased) || 1,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not save package");
      return;
    }
    setMessage("Package saved.");
    await load();
  }

  async function markPaid(id: string) {
    const res = await fetch("/api/ops/coaching", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, paymentStatus: "paid" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Update failed");
      return;
    }
    await load();
  }

  if (loading) return <p className="ops-note">Loading coaching…</p>;

  return (
    <div className="ops-dash-grid">
      <div>
        <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", fontWeight: 750 }}>
          Coaching Management
        </h2>
        <p className="ops-note" style={{ marginTop: 0 }}>
          Private, group, and online lessons plus packages. Double-booking the
          same coach is blocked. Only <strong>paid</strong> sessions/packages
          count as collected revenue ({money(collected)} so far).
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

      {!coaches.length ? (
        <div className="ops-stage-banner">
          Add coaches under the public coaching roster (API /ops coaches list is
          empty). You can still create bookings once a coach exists.
        </div>
      ) : null}

      <section className="ops-dash-mid">
        <form className="ops-card" onSubmit={saveBooking}>
          <div className="ops-card-head">
            <h2>New booking</h2>
          </div>
          <div className="ops-stat-list" style={{ gridTemplateColumns: "1fr 1fr" }}>
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
              Coach
              <select
                required
                className="field"
                value={form.coachId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, coachId: e.target.value }))
                }
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                <option value="">Select…</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ops-note">
              Service
              <select
                className="field"
                value={form.serviceType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    serviceType: e.target.value as CoachingServiceType,
                  }))
                }
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                <option value="private">Private</option>
                <option value="group">Group</option>
                <option value="online">Online</option>
                <option value="package_session">Package session</option>
              </select>
            </label>
            <label className="ops-note">
              Title
              <input
                required
                className="field"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
            <label className="ops-note">
              Date
              <input
                required
                type="date"
                className="field"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
            <label className="ops-note">
              Start
              <input
                required
                type="time"
                className="field"
                value={form.startTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startTime: e.target.value }))
                }
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
            <label className="ops-note">
              End
              <input
                required
                type="time"
                className="field"
                value={form.endTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endTime: e.target.value }))
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
                <option value="waived">Waived</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            className="ops-primary-btn"
            style={{ marginTop: "0.85rem" }}
            disabled={saving}
          >
            {saving ? "Saving…" : "Add booking"}
          </button>
        </form>

        <form className="ops-card" onSubmit={savePackage}>
          <div className="ops-card-head">
            <h2>New package</h2>
          </div>
          <div className="ops-stat-list" style={{ gridTemplateColumns: "1fr" }}>
            <label className="ops-note">
              Customer
              <input
                required
                className="field"
                value={pkg.customerName}
                onChange={(e) =>
                  setPkg((p) => ({ ...p, customerName: e.target.value }))
                }
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
            <label className="ops-note">
              Package name
              <input
                required
                className="field"
                value={pkg.name}
                onChange={(e) => setPkg((p) => ({ ...p, name: e.target.value }))}
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
            <label className="ops-note">
              Sessions
              <input
                required
                type="number"
                min="1"
                className="field"
                value={pkg.sessionsPurchased}
                onChange={(e) =>
                  setPkg((p) => ({ ...p, sessionsPurchased: e.target.value }))
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
                value={pkg.price}
                onChange={(e) =>
                  setPkg((p) => ({ ...p, price: e.target.value }))
                }
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
            <label className="ops-note">
              Payment
              <select
                className="field"
                value={pkg.paymentStatus}
                onChange={(e) =>
                  setPkg((p) => ({
                    ...p,
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
          </div>
          <button
            type="submit"
            className="ops-primary-btn"
            style={{ marginTop: "0.85rem" }}
            disabled={saving}
          >
            Add package
          </button>
        </form>
      </section>

      <article className="ops-card">
        <div className="ops-card-head">
          <h2>Bookings ({bookings.length})</h2>
        </div>
        {!bookings.length ? (
          <p className="ops-note">No bookings yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
              <thead>
                <tr style={{ color: "var(--ops-muted)", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem" }}>When</th>
                  <th style={{ padding: "0.5rem" }}>Customer</th>
                  <th style={{ padding: "0.5rem" }}>Coach</th>
                  <th style={{ padding: "0.5rem" }}>Price</th>
                  <th style={{ padding: "0.5rem" }}>Payment</th>
                  <th style={{ padding: "0.5rem" }} />
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      {b.date} {b.startTime}–{b.endTime}
                      <div style={{ color: "var(--ops-muted)", fontSize: "0.75rem" }}>
                        {b.title} · {b.serviceType}
                      </div>
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>{b.customerName}</td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>{b.coachName}</td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>{money(b.price)}</td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      <span
                        className={
                          b.paymentStatus === "paid"
                            ? "ops-badge ops-badge-green"
                            : "ops-badge ops-badge-yellow"
                        }
                      >
                        {b.paymentStatus}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      {b.paymentStatus !== "paid" ? (
                        <button
                          type="button"
                          className="ops-ghost-btn"
                          onClick={() => void markPaid(b.id)}
                        >
                          Mark paid
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="ops-card">
        <div className="ops-card-head">
          <h2>Packages ({packages.length})</h2>
        </div>
        {!packages.length ? (
          <p className="ops-note">No packages yet.</p>
        ) : (
          <ul className="ops-activity">
            {packages.map((p) => (
              <li key={p.id}>
                <div>
                  <strong>
                    {p.name} · {p.customerName}
                  </strong>
                  <div style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}>
                    {p.sessionsUsed}/{p.sessionsPurchased} used · {money(p.price)} ·{" "}
                    {p.paymentStatus}
                  </div>
                </div>
                <span
                  className={
                    p.paymentStatus === "paid"
                      ? "ops-badge ops-badge-green"
                      : "ops-badge ops-badge-yellow"
                  }
                >
                  {p.sessionsPurchased - p.sessionsUsed} left
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}
