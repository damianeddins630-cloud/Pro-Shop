"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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

  const load = useCallback(async () => {
    const res = await fetch("/api/coupons", { cache: "no-store" });
    const data = await res.json();
    setCoupons(data.coupons || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const payload = {
      code: form.code.trim(),
      description: form.description,
      type: form.type,
      value: form.type === "free" ? 100 : Number(form.value),
      active: form.active,
    };
    if (form.type !== "free" && Number.isNaN(payload.value)) {
      setError("Value must be a number");
      return;
    }
    const res = await fetch(editingId ? `/api/coupons/${editingId}` : "/api/coupons", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setMessage(editingId ? "Coupon updated" : "Coupon added");
    setForm(empty);
    setEditingId(null);
    setCoupons(data.coupons || []);
  }

  async function remove(id: string) {
    if (!confirm("Remove this coupon?")) return;
    const res = await fetch(`/api/coupons/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Delete failed");
      return;
    }
    setMessage("Coupon removed");
    setCoupons(data.coupons || []);
  }

  if (loading) return <p className="text-mist">Loading coupons...</p>;

  return (
    <div>
      <h2 className="display text-4xl">Coupons</h2>
      <p className="mt-1 text-sm text-mist">
        Add or remove redeemable codes. Owner free code:{" "}
        <span className="text-red">cityviewlanes.com</span>
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
          <input
            className="field"
            placeholder="Code (e.g. SUMMER10)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            required
            disabled={Boolean(editingId && coupons.find((c) => c.id === editingId)?.system)}
          />
          <textarea
            className="field min-h-[80px]"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <select
            className="field"
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as CouponType })
            }
            disabled={Boolean(editingId && coupons.find((c) => c.id === editingId)?.system)}
          >
            <option value="percent">Percent off</option>
            <option value="fixed">Fixed $ off</option>
            <option value="free">Free order</option>
          </select>
          {form.type !== "free" && (
            <input
              className="field"
              placeholder={form.type === "percent" ? "Percent (e.g. 15)" : "Dollars off"}
              value={form.value}
              onChange={(e) =>
                setForm({ ...form, value: e.target.value.replace(/[^0-9.]/g, "") })
              }
              required
            />
          )}
          <label className="flex items-center gap-2 text-sm text-mist">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active (can be redeemed)
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn btn-primary">
              {editingId ? "Save changes" : "Add coupon"}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(empty);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="space-y-3">
          {coupons.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-chalk">{c.code}</p>
                  <p className="text-sm text-red">{couponLabel(c)}</p>
                  <p className="mt-1 text-sm text-mist">{c.description}</p>
                  <p className="mt-1 text-xs text-mist/80">
                    {c.active ? "Active" : "Inactive"}
                    {c.system ? " · Owner system coupon" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-sm text-red underline"
                    onClick={() => {
                      setEditingId(c.id);
                      setForm({
                        code: c.code,
                        description: c.description,
                        type: c.type,
                        value: String(c.value),
                        active: c.active,
                      });
                    }}
                  >
                    Edit
                  </button>
                  {!c.system && (
                    <button
                      type="button"
                      className="text-sm text-red-300 underline"
                      onClick={() => remove(c.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!coupons.length && <p className="text-mist">No coupons yet.</p>}
        </div>
      </div>
    </div>
  );
}
