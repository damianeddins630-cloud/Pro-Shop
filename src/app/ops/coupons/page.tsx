"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { couponLabel } from "@/lib/coupons";
import type { Coupon, CouponType } from "@/lib/types";

const empty = {
  code: "",
  description: "",
  type: "percent" as CouponType,
  value: "10",
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

  const editing = useMemo(
    () => coupons.find((c) => c.id === editingId) || null,
    [coupons, editingId]
  );
  const editingIsSystem = Boolean(editing?.system);

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

    const value =
      form.type === "free" ? 100 : Number(form.value);
    if (form.type !== "free" && (Number.isNaN(value) || value < 0)) {
      setError("Value must be a number 0 or greater");
      return;
    }
    if (form.type === "percent" && value > 100) {
      setError("Percent cannot be over 100");
      return;
    }

    const payload = {
      code,
      description: form.description,
      type: form.type,
      value,
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
    if (c.system) {
      setError("The owner free coupon cannot be deleted.");
      return;
    }
    if (!confirm(`Delete coupon "${c.code}"? Customers will no longer be able to use it.`)) {
      return;
    }
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const res = await fetch(`/api/coupons/${c.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Delete failed");
        return;
      }
      setMessage(`Deleted "${c.code}".`);
      if (editingId === c.id) {
        setEditingId(null);
        setForm(empty);
      }
      if (Array.isArray(data.coupons)) {
        setCoupons(data.coupons);
      } else {
        await load();
      }
    } catch {
      setError("Delete failed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c: Coupon) {
    if (c.system) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const res = await fetch(`/api/coupons/${c.id}`, {
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
      if (Array.isArray(data.coupons)) {
        setCoupons(data.coupons);
      } else {
        await load();
      }
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
        Add, edit, or delete redeem codes for the cart. The locked owner free code is{" "}
        <span className="text-red">cityviewlanes.com</span>.
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
          {editingIsSystem && (
            <p className="text-xs text-mist">
              System coupon: code and discount stay locked. You can still update the note.
            </p>
          )}
          <label className="block text-xs uppercase tracking-wide text-mist">
            Code
            <input
              className="field mt-1"
              placeholder="e.g. SUMMER10"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
              disabled={busy || editingIsSystem}
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
              disabled={busy || editingIsSystem}
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
                disabled={busy || editingIsSystem}
              />
            </label>
          )}
          {!editingIsSystem && (
            <label className="flex items-center gap-2 text-sm text-mist">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                disabled={busy}
              />
              Active (can be redeemed at checkout)
            </label>
          )}
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
                <div>
                  <p className="font-semibold text-chalk">{c.code}</p>
                  <p className="text-sm text-red">{couponLabel(c)}</p>
                  {c.description ? (
                    <p className="mt-1 text-sm text-mist">{c.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-mist/80">
                    {c.active ? "Active" : "Inactive"}
                    {c.system ? " · Locked system coupon" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-sm text-red underline disabled:opacity-40"
                    onClick={() => startEdit(c)}
                    disabled={busy}
                  >
                    Edit
                  </button>
                  {!c.system && (
                    <>
                      <button
                        type="button"
                        className="text-sm text-mist underline disabled:opacity-40"
                        onClick={() => toggleActive(c)}
                        disabled={busy}
                      >
                        {c.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        className="text-sm text-red-300 underline disabled:opacity-40"
                        onClick={() => remove(c)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </>
                  )}
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
