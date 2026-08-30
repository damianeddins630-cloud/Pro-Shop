"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Sponsor } from "@/lib/types";

const empty = { name: "", image: "", url: "#" };

export default function OpsSponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/sponsors", { cache: "no-store" });
    const data = await res.json();
    setSponsors(data.sponsors || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const res = await fetch(
      editingId ? `/api/sponsors/${editingId}` : "/api/sponsors",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setMessage(editingId ? "Sponsor updated" : "Sponsor added");
    setForm(empty);
    setEditingId(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this sponsor?")) return;
    await fetch(`/api/sponsors/${id}`, { method: "DELETE" });
    setMessage("Sponsor removed");
    load();
  }

  if (loading) return <p className="text-mist">Loading sponsors...</p>;

  return (
    <div>
      <h2 className="display text-4xl">Sponsors</h2>
      <p className="mt-1 text-sm text-mist">Add, edit, or remove sponsors.</p>
      {(message || error) && (
        <p className={`mt-4 text-sm ${error ? "text-red-300" : "text-emerald-300"}`}>
          {error || message}
        </p>
      )}
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <form onSubmit={save} className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="display text-3xl">
            {editingId ? "Edit sponsor" : "Add sponsor"}
          </h3>
          <input
            className="field"
            placeholder="Sponsor name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="field"
            placeholder="Logo / image URL"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
            required
          />
          <input
            className="field"
            placeholder="Website URL"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <div className="flex gap-2">
            <button className="btn btn-primary" type="submit">
              {editingId ? "Save sponsor" : "Add sponsor"}
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
        <div className="grid grid-cols-2 gap-3">
          {sponsors.map((s) => (
            <article key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="logo-box relative mb-3 h-20 w-full">
                <span className="relative block h-full w-full">
                  <Image src={s.image} alt={s.name} fill className="img-clean" unoptimized />
                </span>
              </div>
              <h3 className="text-sm font-semibold">{s.name}</h3>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="text-xs text-red underline"
                  onClick={() => {
                    setEditingId(s.id);
                    setForm({ name: s.name, image: s.image, url: s.url });
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-xs text-red-300 underline"
                  onClick={() => remove(s.id)}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
