"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Deal } from "@/lib/types";

const empty = {
  title: "",
  description: "",
  image: "",
  active: true,
  featured: false,
};

export default function OpsDealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/deals", { cache: "no-store" });
    const data = await res.json();
    setDeals(data.deals || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const res = await fetch(editingId ? `/api/deals/${editingId}` : "/api/deals", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setMessage(editingId ? "Deal updated" : "Deal added");
    setForm(empty);
    setEditingId(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this deal?")) return;
    await fetch(`/api/deals/${id}`, { method: "DELETE" });
    setMessage("Deal removed");
    load();
  }

  if (loading) return <p className="text-mist">Loading deals...</p>;

  return (
    <div>
      <h2 className="display text-4xl">Deals</h2>
      <p className="mt-1 text-sm text-mist">Add, edit, or remove deals shown on the site.</p>
      {(message || error) && (
        <p className={`mt-4 text-sm ${error ? "text-red-300" : "text-emerald-300"}`}>
          {error || message}
        </p>
      )}
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <form onSubmit={save} className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="display text-3xl">{editingId ? "Edit deal" : "Add deal"}</h3>
          <input
            className="field"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <textarea
            className="field min-h-24"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <input
            className="field"
            placeholder="Image URL"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
            required
          />
          <label className="flex items-center gap-2 text-sm text-mist">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
            />
            Deal of the month
          </label>
          <label className="flex items-center gap-2 text-sm text-mist">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active
          </label>
          <div className="flex gap-2">
            <button className="btn btn-primary" type="submit">
              {editingId ? "Save deal" : "Add deal"}
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
          {deals.map((d) => (
            <article key={d.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex gap-3">
                <div className="relative h-20 w-28 overflow-hidden rounded-lg">
                  <Image src={d.image} alt={d.title} fill className="object-cover" unoptimized />
                </div>
                <div>
                  <h3 className="font-semibold">{d.title}</h3>
                  <p className="text-xs text-mist">
                    {d.featured ? "Deal of the month · " : ""}
                    {d.active ? "Active" : "Hidden"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-red underline"
                      onClick={() => {
                        setEditingId(d.id);
                        setForm({
                          title: d.title,
                          description: d.description,
                          image: d.image,
                          active: d.active,
                          featured: d.featured,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-300 underline"
                      onClick={() => remove(d.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
