"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Deal, Product, PublicUser, Sponsor } from "@/lib/types";

type Tab = "inventory" | "deals" | "sponsors";

const emptyProduct = {
  name: "",
  description: "",
  price: 0,
  stock: 0,
  category: "Accessories",
  brand: "Ballard's Bowling",
  image: "",
  featured: false,
  active: true,
};

export default function AdminPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [tab, setTab] = useState<Tab>("inventory");
  const [products, setProducts] = useState<Product[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dealForm, setDealForm] = useState({
    title: "",
    description: "",
    image: "",
    active: true,
    featured: false,
  });
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [sponsorForm, setSponsorForm] = useState({ name: "", image: "", url: "#" });
  const [editingSponsorId, setEditingSponsorId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const me = await fetch("/api/auth/me").then((r) => r.json());
    setUser(me.user || null);
    if (me.user?.role !== "admin") {
      setLoading(false);
      return;
    }
    const [p, d, s] = await Promise.all([
      fetch("/api/products?admin=1").then((r) => r.json()),
      fetch("/api/deals").then((r) => r.json()),
      fetch("/api/sponsors").then((r) => r.json()),
    ]);
    setProducts(p.products || []);
    setDeals(d.deals || []);
    setSponsors(s.sponsors || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetch("/api/auth/me").then((r) => r.json());
      if (cancelled) return;
      setUser(me.user || null);
      if (me.user?.role !== "admin") {
        setLoading(false);
        return;
      }
      const [p, d, s] = await Promise.all([
        fetch("/api/products?admin=1").then((r) => r.json()),
        fetch("/api/deals").then((r) => r.json()),
        fetch("/api/sponsors").then((r) => r.json()),
      ]);
      if (cancelled) return;
      setProducts(p.products || []);
      setDeals(d.deals || []);
      setSponsors(s.sponsors || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function uploadImage(file: File): Promise<string | null> {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Upload failed");
      return null;
    }
    return data.url as string;
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const payload = {
      ...form,
      price: Number(form.price),
      stock: Number(form.stock),
    };
    const res = await fetch(editingId ? `/api/products/${editingId}` : "/api/products", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setMessage(editingId ? "Product updated" : "Product added");
    setForm(emptyProduct);
    setEditingId(null);
    load();
  }

  async function removeProduct(id: string) {
    if (!confirm("Delete this product from inventory?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Delete failed");
      return;
    }
    setMessage("Product deleted");
    load();
  }

  async function saveDeal(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(editingDealId ? `/api/deals/${editingDealId}` : "/api/deals", {
      method: editingDealId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dealForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setMessage(editingDealId ? "Deal updated" : "Deal added");
    setDealForm({ title: "", description: "", image: "", active: true, featured: false });
    setEditingDealId(null);
    load();
  }

  async function removeDeal(id: string) {
    if (!confirm("Delete this deal?")) return;
    await fetch(`/api/deals/${id}`, { method: "DELETE" });
    setMessage("Deal deleted");
    load();
  }

  async function saveSponsor(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(
      editingSponsorId ? `/api/sponsors/${editingSponsorId}` : "/api/sponsors",
      {
        method: editingSponsorId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sponsorForm),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setMessage(editingSponsorId ? "Sponsor updated" : "Sponsor added");
    setSponsorForm({ name: "", image: "", url: "#" });
    setEditingSponsorId(null);
    load();
  }

  async function removeSponsor(id: string) {
    if (!confirm("Delete this sponsor?")) return;
    await fetch(`/api/sponsors/${id}`, { method: "DELETE" });
    setMessage("Sponsor deleted");
    load();
  }

  if (loading) {
    return (
      <section className="site-shell section-pad pt-24">
        <p className="text-mist">Loading admin...</p>
      </section>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <section className="site-shell section-pad pt-24">
        <h1 className="display text-5xl">Admin</h1>
        <p className="mt-4 text-mist">Owner login required for inventory and site management.</p>
        <Link href="/login" className="btn btn-primary mt-6">
          Login as owner
        </Link>
      </section>
    );
  }

  return (
    <section className="site-shell section-pad pt-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm tracking-[0.2em] text-amber uppercase">Owner dashboard</p>
          <h1 className="display text-5xl md:text-6xl">Inventory & Site Admin</h1>
          <p className="mt-2 text-mist">
            Signed in as <span className="text-amber">{user.username}</span> — full permissions
          </p>
        </div>
        <div className="flex gap-2">
          {(["inventory", "deals", "sponsors"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-2 text-sm capitalize ${
                tab === t ? "bg-amber text-ink font-bold" : "border border-white/15 text-mist"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {(message || error) && (
        <p className={`mb-6 text-sm ${error ? "text-red-300" : "text-emerald-300"}`}>
          {error || message}
        </p>
      )}

      {tab === "inventory" && (
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={saveProduct} className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="display text-3xl">
              {editingId ? "Update product" : "Add inventory"}
            </h2>
            <input
              className="field"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <textarea
              className="field min-h-24"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="field"
                type="number"
                step="0.01"
                placeholder="Price"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                required
              />
              <input
                className="field"
                type="number"
                placeholder="Stock"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="field"
                placeholder="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <input
                className="field"
                placeholder="Brand"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </div>
            <input
              className="field"
              placeholder="Image URL or upload below"
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              required
            />
            <input
              type="file"
              accept="image/*"
              className="text-sm text-mist"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await uploadImage(file);
                if (url) setForm((f) => ({ ...f, image: url }));
              }}
            />
            {form.image && (
              <div className="relative h-28 w-28 overflow-hidden rounded-xl border border-white/10">
                <Image src={form.image} alt="" fill className="object-contain" unoptimized />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-mist">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm text-mist">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active on website
            </label>
            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit">
                {editingId ? "Update" : "Add product"}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyProduct);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="space-y-3">
            <h2 className="display text-3xl">Current inventory ({products.length})</h2>
            <div className="max-h-[70vh] space-y-3 overflow-auto pr-1">
              {products.map((p) => (
                <article
                  key={p.id}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/30">
                    <Image src={p.image} alt={p.name} fill className="object-contain p-1" unoptimized />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{p.name}</h3>
                    <p className="text-sm text-mist">
                      ${p.price.toFixed(2)} · stock {p.stock} · {p.brand}
                      {!p.active && " · hidden"}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="text-xs text-amber underline"
                        onClick={() => {
                          setEditingId(p.id);
                          setForm({
                            name: p.name,
                            description: p.description,
                            price: p.price,
                            stock: p.stock,
                            category: p.category,
                            brand: p.brand,
                            image: p.image,
                            featured: p.featured,
                            active: p.active,
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-300 underline"
                        onClick={() => removeProduct(p.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "deals" && (
        <div className="grid gap-8 lg:grid-cols-2">
          <form onSubmit={saveDeal} className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="display text-3xl">{editingDealId ? "Update deal" : "Add deal"}</h2>
            <input
              className="field"
              placeholder="Title"
              value={dealForm.title}
              onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })}
              required
            />
            <textarea
              className="field min-h-24"
              placeholder="Description"
              value={dealForm.description}
              onChange={(e) => setDealForm({ ...dealForm, description: e.target.value })}
            />
            <input
              className="field"
              placeholder="Image URL"
              value={dealForm.image}
              onChange={(e) => setDealForm({ ...dealForm, image: e.target.value })}
              required
            />
            <input
              type="file"
              accept="image/*"
              className="text-sm text-mist"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await uploadImage(file);
                if (url) setDealForm((f) => ({ ...f, image: url }));
              }}
            />
            <label className="flex items-center gap-2 text-sm text-mist">
              <input
                type="checkbox"
                checked={dealForm.featured}
                onChange={(e) => setDealForm({ ...dealForm, featured: e.target.checked })}
              />
              Deal of the month
            </label>
            <label className="flex items-center gap-2 text-sm text-mist">
              <input
                type="checkbox"
                checked={dealForm.active}
                onChange={(e) => setDealForm({ ...dealForm, active: e.target.checked })}
              />
              Active
            </label>
            <button className="btn btn-primary" type="submit">
              {editingDealId ? "Update deal" : "Add deal"}
            </button>
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
                        className="text-xs text-amber underline"
                        onClick={() => {
                          setEditingDealId(d.id);
                          setDealForm({
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
                        onClick={() => removeDeal(d.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === "sponsors" && (
        <div className="grid gap-8 lg:grid-cols-2">
          <form onSubmit={saveSponsor} className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="display text-3xl">
              {editingSponsorId ? "Update sponsor" : "Add sponsor (name + photo)"}
            </h2>
            <input
              className="field"
              placeholder="Sponsor name"
              value={sponsorForm.name}
              onChange={(e) => setSponsorForm({ ...sponsorForm, name: e.target.value })}
              required
            />
            <input
              className="field"
              placeholder="Image URL / logo"
              value={sponsorForm.image}
              onChange={(e) => setSponsorForm({ ...sponsorForm, image: e.target.value })}
              required
            />
            <input
              type="file"
              accept="image/*"
              className="text-sm text-mist"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await uploadImage(file);
                if (url) setSponsorForm((f) => ({ ...f, image: url }));
              }}
            />
            <input
              className="field"
              placeholder="Website URL"
              value={sponsorForm.url}
              onChange={(e) => setSponsorForm({ ...sponsorForm, url: e.target.value })}
            />
            <button className="btn btn-primary" type="submit">
              {editingSponsorId ? "Update sponsor" : "Add sponsor"}
            </button>
          </form>
          <div className="grid grid-cols-2 gap-3">
            {sponsors.map((s) => (
              <article key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="relative mb-3 h-20 w-full">
                  <Image src={s.image} alt={s.name} fill className="object-contain" unoptimized />
                </div>
                <h3 className="text-sm font-semibold">{s.name}</h3>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-amber underline"
                    onClick={() => {
                      setEditingSponsorId(s.id);
                      setSponsorForm({ name: s.name, image: s.image, url: s.url });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-300 underline"
                    onClick={() => removeSponsor(s.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
