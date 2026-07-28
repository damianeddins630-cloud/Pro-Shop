"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { couponLabel, couponUsesLabel } from "@/lib/coupons";
import type { Coupon, CouponType } from "@/lib/types";

const empty = {
  code: "",
  description: "",
  type: "percent" as CouponType,
  value: "10",
  maxUses: "0",
  active: true,
};

export default function OpsCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/coupons", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCoupons([]);
      setError(
        res.status === 401
          ? "Sign in with an ops account to manage coupons."
          : data.error || "Could not load coupons"
      );
      setLoading(false);
      return;
    }
    setCoupons(Array.isArray(data.coupons) ? data.coupons : []);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(c: Coupon) {
    setEditingId(c.id);
    setForm({
      code: c.code,
      description: c.description,
      type: c.type,
      value: String(c.value),
      maxUses: String(c.maxUses ?? 0),
      active: c.active,
    });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(empty);
    setError("");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    const code = form.code.trim();
    if (!code) {
      setError("Coupon code is required");
      return;
    }

    const value = form.type === "free" ? 100 : Number(form.value);
    if (form.type !== "free" && (Number.isNaN(value) || value < 0)) {
      setError("Value must be a number 0 or greater");
      return;
    }
    if (form.type === "percent" && value > 100) {
      setError("Percent cannot be over 100");
      return;
    }

    const maxUsesNum = Number(form.maxUses);
    if (Number.isNaN(maxUsesNum) || maxUsesNum < 0) {
      setError("Times it can be used must be 0 or a whole number");
      return;
    }
    const maxUses = Math.max(0, Math.floor(maxUsesNum || 0));

    const payload = {
      code,
      description: form.description,
      type: form.type,
      value,
      maxUses,
      active: form.active,
    };

    setBusy(true);
    try {
      const res = await fetch(
        editingId ? `/api/coupons/${editingId}` : "/api/coupons",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setMessage(editingId ? "Coupon updated." : "Coupon added.");
      setForm(empty);
      setEditingId(null);
      if (Array.isArray(data.coupons)) {
        setCoupons(data.coupons);
      } else {
        await load();
      }
    } catch {
      setError("Save failed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Coupon) {
    if (
      !confirm(
        `Remove coupon "${c.code}"?\n\nCustomers will no longer be able to use it.`
      )
    ) {
      return;
    }
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const res = await fetch(`/api/coupons/${encodeURIComponent(c.id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Remove failed");
        return;
      }
      setMessage(`Removed "${c.code}".`);
      if (editingId === c.id) {
        setEditingId(null);
        setForm(empty);
      }
      // Prefer server list; also drop locally so UI updates even if response is odd
      if (Array.isArray(data.coupons)) {
        setCoupons(data.coupons);
      } else {
        setCoupons((prev) => prev.filter((x) => x.id !== c.id));
        await load();
      }
    } catch {
      setError("Remove failed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resetUses(c: Coupon) {
    if (!confirm(`Reset used count for "${c.code}" back to 0?`)) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const res = await fetch(`/api/coupons/${encodeURIComponent(c.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ usedCount: 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not reset uses");
        return;
      }
      setMessage(`Reset uses for "${c.code}".`);
      if (Array.isArray(data.coupons)) setCoupons(data.coupons);
      else await load();
    } catch {
      setError("Could not reset uses.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c: Coupon) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const res = await fetch(`/api/coupons/${encodeURIComponent(c.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ active: !c.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update coupon");
        return;
      }
      setMessage(
        !c.active ? `"${c.code}" is now active.` : `"${c.code}" is now inactive.`
      );
      if (Array.isArray(data.coupons)) setCoupons(data.coupons);
      else await load();
      if (editingId === c.id && data.coupon) {
        setForm((f) => ({ ...f, active: Boolean(data.coupon.active) }));
      }
    } catch {
      setError("Could not update coupon.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-mist">Loading coupons...</p>;

  return (
    <div>
      <h2 className="display text-4xl">Coupons</h2>
      <p className="mt-1 text-sm text-mist">
        Add, edit, or remove any redeem code. Set how many times each can be
        used (0 = unlimited).
      </p>
      {(message || error) && (
        <p className={`mt-4 text-sm ${error ? "text-red-300" : "text-emerald-300"}`}>
          {error || message}
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <form
          onSubmit={save}
          className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6"
        >
          <h3 className="display text-3xl">
            {editingId ? "Edit coupon" : "Add coupon"}
          </h3>
          <label className="block text-xs uppercase tracking-wide text-mist">
            Code
            <input
              className="field mt-1"
              placeholder="e.g. SUMMER10"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
              disabled={busy}
            />
          </label>
          <label className="block text-xs uppercase tracking-wide text-mist">
            Description
            <textarea
              className="field mt-1 min-h-[80px]"
              placeholder="What this coupon is for"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              disabled={busy}
            />
          </label>
          <label className="block text-xs uppercase tracking-wide text-mist">
            Discount type
            <select
              className="field mt-1"
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as CouponType })
              }
              disabled={busy}
            >
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed $ off</option>
              <option value="free">Free order</option>
            </select>
          </label>
          {form.type !== "free" && (
            <label className="block text-xs uppercase tracking-wide text-mist">
              {form.type === "percent" ? "Percent" : "Dollars off"}
              <input
                className="field mt-1"
                placeholder={form.type === "percent" ? "15" : "10"}
                value={form.value}
                onChange={(e) =>
                  setForm({
                    ...form,
                    value: e.target.value.replace(/[^0-9.]/g, ""),
                  })
                }
                required
                disabled={busy}
              />
            </label>
          )}
          <label className="block text-xs uppercase tracking-wide text-mist">
            How many times it can be used
            <input
              className="field mt-1"
              inputMode="numeric"
              placeholder="0 = unlimited"
              value={form.maxUses}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxUses: e.target.value.replace(/[^0-9]/g, ""),
                })
              }
              disabled={busy}
            />
            <span className="mt-1 block text-[11px] normal-case tracking-normal text-mist/80">
              Enter 0 for unlimited. Example: 10 means only 10 checkouts can use
              this code.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-mist">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              disabled={busy}
            />
            Active (can be redeemed at checkout)
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : "Add coupon"}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelEdit}
                disabled={busy}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="space-y-3">
          <h3 className="display text-3xl">All coupons</h3>
          {coupons.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-chalk">{c.code}</p>
                  <p className="text-sm text-red">{couponLabel(c)}</p>
                  {c.description ? (
                    <p className="mt-1 text-sm text-mist">{c.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-mist/80">
                    {c.active ? "Active" : "Inactive"}
                  </p>
                  <p className="mt-1 text-xs text-chalk/80">
                    {couponUsesLabel(c)}
                  </p>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost text-sm"
                      onClick={() => startEdit(c)}
                      disabled={busy}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-sm"
                      onClick={() => toggleActive(c)}
                      disabled={busy}
                    >
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost text-sm"
                      onClick={() => resetUses(c)}
                      disabled={busy || !(c.usedCount > 0)}
                    >
                      Reset uses
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary text-sm"
                      onClick={() => remove(c)}
                      disabled={busy}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!coupons.length && (
            <p className="text-mist">
              No coupons yet. Use the form to add your first code.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
