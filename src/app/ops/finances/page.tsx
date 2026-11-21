"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { OpsPageHeader, OpsStatCard } from "@/components/ops/OpsUi";
import type { Expense, ExpenseCategory } from "@/lib/types";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function OpsFinancesPage() {
  const [overview, setOverview] = useState<{
    finances: {
      shopRevenueMonth: number;
      coachingRevenue: number;
      membershipRevenue: number;
      totalCollectedMonth: number;
      expensesTotal: number;
      netProfitMonth: number;
    };
    sales: { today: number; week: number; month: number; year: number; allTime: number };
  } | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    category: "operating" as ExpenseCategory,
    label: "",
    amount: "",
    date: "",
    notes: "",
  });

  const load = useCallback(async () => {
    const [ov, ex] = await Promise.all([
      fetch("/api/ops/overview?range=30d", { cache: "no-store" }),
      fetch("/api/ops/expenses", { cache: "no-store" }),
    ]);
    const ovJson = await ov.json().catch(() => ({}));
    const exJson = await ex.json().catch(() => ({}));
    if (!ov.ok) {
      setError(ovJson.error || "Could not load finances");
      return;
    }
    setOverview(ovJson);
    if (ex.ok) setExpenses(exJson.expenses || []);
    setError("");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addExpense(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/ops/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount) || 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not save expense");
      return;
    }
    setForm({
      category: "operating",
      label: "",
      amount: "",
      date: "",
      notes: "",
    });
    await load();
  }

  async function removeExpense(id: string) {
    if (!confirm("Delete this expense?")) return;
    const res = await fetch(`/api/ops/expenses?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Delete failed");
      return;
    }
    await load();
  }

  const f = overview?.finances;

  return (
    <div className="ops-dash-grid">
      <OpsPageHeader
        title="Finances"
        description="Collected revenue (paid only) stays separate from expenses and net profit. Unpaid drafts never count as money collected."
        actions={
          <Link href="/ops/reports" className="ops-ghost-btn">
            Open reports
          </Link>
        }
      />

      {error ? (
        <div className="ops-stage-banner" role="alert">
          {error}
        </div>
      ) : null}

      <section className="ops-kpi-row">
        <OpsStatCard
          tone="red"
          label="Shop · month"
          value={money(f?.shopRevenueMonth ?? 0)}
        />
        <OpsStatCard
          tone="blue"
          label="Coaching collected"
          value={money(f?.coachingRevenue ?? 0)}
        />
        <OpsStatCard
          tone="purple"
          label="Memberships collected"
          value={money(f?.membershipRevenue ?? 0)}
        />
        <OpsStatCard
          tone="green"
          label="Net · month"
          value={money(f?.netProfitMonth ?? 0)}
          meta={`${money(f?.totalCollectedMonth ?? 0)} collected − ${money(f?.expensesTotal ?? 0)} expenses`}
        />
      </section>

      <section className="ops-kpi-row">
        <article className="ops-card">
          <p className="ops-kpi-label">Today</p>
          <p className="ops-kpi-value" style={{ fontSize: "1.25rem" }}>
            {money(overview?.sales.today ?? 0)}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">This week</p>
          <p className="ops-kpi-value" style={{ fontSize: "1.25rem" }}>
            {money(overview?.sales.week ?? 0)}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">This year</p>
          <p className="ops-kpi-value" style={{ fontSize: "1.25rem" }}>
            {money(overview?.sales.year ?? 0)}
          </p>
        </article>
        <article className="ops-card">
          <p className="ops-kpi-label">All-time shop</p>
          <p className="ops-kpi-value" style={{ fontSize: "1.25rem" }}>
            {money(overview?.sales.allTime ?? 0)}
          </p>
        </article>
      </section>

      <section className="ops-dash-mid">
        <form className="ops-card" onSubmit={addExpense}>
          <div className="ops-card-head">
            <h2>Add expense</h2>
          </div>
          <div className="ops-stat-list" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label className="ops-note">
              Category
              <select
                className="field"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as ExpenseCategory,
                  }))
                }
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                <option value="inventory">Inventory purchases</option>
                <option value="coaching">Coaching expenses</option>
                <option value="website">Website</option>
                <option value="marketing">Marketing</option>
                <option value="payment_fees">Payment processing fees</option>
                <option value="operating">Operating</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="ops-note">
              Date
              <input
                required
                type="date"
                className="field"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
            <label className="ops-note">
              Label
              <input
                required
                className="field"
                value={form.label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, label: e.target.value }))
                }
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
            <label className="ops-note">
              Amount
              <input
                required
                type="number"
                min="0"
                step="0.01"
                className="field"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
          </div>
          <button type="submit" className="ops-primary-btn" style={{ marginTop: "0.85rem" }}>
            Save expense
          </button>
        </form>

        <article className="ops-card">
          <div className="ops-card-head">
            <h2>Expenses ({expenses.length})</h2>
            <Link href="/ops/reports" className="ops-ghost-btn">
              Reports
            </Link>
          </div>
          {!expenses.length ? (
            <p className="ops-note">No expenses recorded yet.</p>
          ) : (
            <ul className="ops-activity">
              {expenses.map((ex) => (
                <li key={ex.id}>
                  <div>
                    <strong>
                      {ex.label} · {money(ex.amount)}
                    </strong>
                    <div style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}>
                      {ex.date} · {ex.category}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ops-ghost-btn"
                    onClick={() => void removeExpense(ex.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
