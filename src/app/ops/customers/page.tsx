"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OpsPageHeader } from "@/components/ops/OpsUi";
import { isPurchasedOrder } from "@/lib/order-status";
import type { Order, PublicUser } from "@/lib/types";

type Row = {
  id: string;
  username: string;
  email: string;
  phoneNumber?: string;
  roleName: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt?: string;
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function OpsCustomersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [usersRes, ordersRes] = await Promise.all([
          fetch("/api/users", { cache: "no-store" }),
          fetch("/api/orders?all=1", { cache: "no-store" }),
        ]);
        const usersJson = await usersRes.json().catch(() => ({}));
        const ordersJson = await ordersRes.json().catch(() => ({}));

        if (!usersRes.ok) {
          throw new Error(usersJson.error || "Could not load customers");
        }
        if (!ordersRes.ok) {
          throw new Error(ordersJson.error || "Could not load orders");
        }

        const users: PublicUser[] = usersJson.users || [];
        const orders: Order[] = (ordersJson.orders || []).filter(
          isPurchasedOrder
        );
        const byUser = new Map<string, Order[]>();
        for (const o of orders) {
          const key = o.userId || o.email || o.username;
          if (!key) continue;
          const list = byUser.get(key) || [];
          list.push(o);
          byUser.set(key, list);
        }

        const mapped: Row[] = users
          .filter((u) => u.id !== "user_owner")
          .map((u) => {
            const list =
              byUser.get(u.id) ||
              byUser.get(u.email) ||
              byUser.get(u.username) ||
              [];
            const totalSpent = list.reduce(
              (s, o) => s + Math.max(0, Number(o.total) || 0),
              0
            );
            const last = [...list].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )[0];
            return {
              id: u.id,
              username: u.username,
              email: u.email,
              phoneNumber: u.phoneNumber,
              roleName: u.roleName || "member",
              orderCount: list.length || u.orderCount || 0,
              totalSpent: Math.round(totalSpent * 100) / 100,
              lastOrderAt: last?.createdAt || u.lastOrderAt,
            };
          })
          .sort((a, b) => b.totalSpent - a.totalSpent);

        if (!cancelled) {
          setRows(mapped);
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.username.toLowerCase().includes(needle) ||
        r.email.toLowerCase().includes(needle) ||
        (r.phoneNumber || "").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  return (
    <div className="ops-dash-grid">
      <OpsPageHeader
        title="Customers"
        description="One place for customer accounts linked to paid purchase history. Purchases should never create duplicate customer records."
      />

      {error ? (
        <div className="ops-stage-banner" role="alert">
          {error}
        </div>
      ) : null}

      <div className="ops-card">
        <div className="ops-card-head">
          <h2>{loading ? "Loading…" : `${filtered.length} customers`}</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone"
            style={{ minWidth: 220 }}
          />
        </div>

        {!loading && filtered.length === 0 ? (
          <p className="ops-empty">No customer accounts matched.</p>
        ) : (
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Paid orders</th>
                  <th>Total spent</th>
                  <th>Last order</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <td style={{ padding: "0.7rem 0.35rem" }}>
                      <strong>{r.username}</strong>
                      <div
                        style={{
                          color: "var(--ops-muted)",
                          fontSize: "0.75rem",
                        }}
                      >
                        {r.roleName}
                      </div>
                    </td>
                    <td style={{ padding: "0.7rem 0.35rem" }}>
                      <div>{r.email}</div>
                      <div
                        style={{
                          color: "var(--ops-muted)",
                          fontSize: "0.75rem",
                        }}
                      >
                        {r.phoneNumber || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "0.7rem 0.35rem" }}>{r.orderCount}</td>
                    <td style={{ padding: "0.7rem 0.35rem" }}>
                      {money(r.totalSpent)}
                    </td>
                    <td style={{ padding: "0.7rem 0.35rem" }}>
                      {r.lastOrderAt
                        ? new Date(r.lastOrderAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="ops-actions-grid" style={{ marginTop: "1rem" }}>
          <Link className="ops-action" href="/ops/orders">
            Sales & Orders
          </Link>
          <Link className="ops-action" href="/ops/users">
            Manage accounts
          </Link>
        </div>
      </div>
    </div>
  );
}
