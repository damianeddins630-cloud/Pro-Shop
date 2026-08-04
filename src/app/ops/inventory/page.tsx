"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ProductPrice } from "@/components/ProductPrice";
import { saveLocalInventory } from "@/lib/inventory-client";
import type { Product } from "@/lib/types";

const empty = {
  name: "",
  description: "",
  price: "0",
  discountPercent: "0",
  stock: "0",
  category: "Accessories",
  brand: "Ballard's Bowling",
  image: "",
  featured: false,
  active: true,
};

export default function OpsInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [persistWarning, setPersistWarning] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/products?admin=1&t=${Date.now()}`, {
      cache: "no-store",
    });
    const data = await res.json();
    const list = data.products || [];
    setProducts(list);
    if (data.persist?.lastPersistOk === false) {
      setPersistWarning(
        `Durable save is broken (${data.persist.lastPersistDetail || "unknown"}). Fixes will not stick for shoppers until Redis/Blob/GITHUB_TOKEN works.`
      );
    } else {
      setPersistWarning("");
      saveLocalInventory(list, data.updatedAt);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const price = Math.max(0, Number(form.price));
    const discountPercent = Math.min(100, Math.max(0, Number(form.discountPercent)));
    const stock = Math.max(0, Math.floor(Number(form.stock)));
    if ([price, discountPercent, stock].some((n) => Number.isNaN(n))) {
      setError("Price, discount, and stock must be numbers. $0 is allowed.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description,
      price,
      discountPercent,
      stock,
      category: form.category,
      brand: form.brand,
      image: form.image.trim() || "/images/logo.png",
      featured: form.featured,
      active: form.active,
    };
    const res = await fetch(editingId ? `/api/products/${editingId}` : "/api/products", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      if (data.persist?.lastPersistDetail) {
        setPersistWarning(String(data.persist.lastPersistDetail));
      }
      return;
    }
    if (data.savedDurably === false || data.persist?.lastPersistOk === false) {
      setError(
        data.error ||
          "Save did not stick in durable storage — shoppers may still see the old price."
      );
      setPersistWarning(String(data.persist?.lastPersistDetail || ""));
      return;
    }
    const next = Array.isArray(data.products)
      ? data.products
      : data.product
        ? [data.product, ...products.filter((p) => p.id !== data.product.id)]
        : products;
    setProducts(next);
    saveLocalInventory(next, data.updatedAt);
    setPersistWarning("");
    setMessage(
      `${editingId ? "Updated" : "Added"} "${payload.name}" — saved for every shopper. Shopify will charge this website price on the next Pay click${
        data.voidedUnpaidCheckouts
          ? ` (${data.voidedUnpaidCheckouts} old unpaid invoice${data.voidedUnpaidCheckouts === 1 ? "" : "s"} voided)`
          : ""
      }.`
    );
    setForm(empty);
    setEditingId(null);
  }

  async function remove(id: string) {
    if (!confirm("Remove this item from inventory and the shop?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Delete failed");
      return;
    }
    const next = Array.isArray(data.products)
      ? data.products
      : products.filter((p) => p.id !== id);
    setProducts(next);
    saveLocalInventory(next, data.updatedAt);
    setMessage("Item removed from inventory and shop.");
    if (editingId === id) {
      setEditingId(null);
      setForm(empty);
    }
  }

  if (loading) return <p className="text-mist">Loading inventory...</p>;

  return (
    <div>
      {persistWarning ? (
        <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold text-amber-200">Storage warning</p>
          <p className="mt-1">{persistWarning}</p>
          <p className="mt-2">
            Run{" "}
            <Link href="/api/persist/self-test" className="underline text-amber-50">
              /api/persist/self-test
            </Link>{" "}
            while logged into Ops, then fix the failing backend in Vercel env vars.
          </p>
        </div>
      ) : null}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-4xl">Inventory</h2>
          <p className="mt-1 text-sm text-mist">
            Changes here update the shop. When someone buys, stock drops and an order is created.
          </p>
        </div>
        <Link href="/shop" className="btn btn-ghost !py-2 text-sm">
          Open shop
        </Link>
      </div>

      {(message || error) && (
        <p className={`mb-4 text-sm ${error ? "text-red-300" : "text-emerald-300"}`}>
          {error || message}
        </p>
      )}

      <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <form
          onSubmit={save}
          className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6"
        >
          <h3 className="display text-3xl">
            {editingId ? "Edit item" : "Add item"}
          </h3>
          <input
            className="field"
            placeholder="Item name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <textarea
            className="field min-h-20"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Price ($0 OK)</label>
              <input
                className="field"
                inputMode="decimal"
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: e.target.value.replace(/[^0-9.]/g, "") })
                }
              />
            </div>
            <div>
              <label className="label">Discount %</label>
              <input
                className="field"
                inputMode="numeric"
                value={form.discountPercent}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discountPercent: e.target.value.replace(/[^0-9.]/g, ""),
                  })
                }
              />
            </div>
            <div>
              <label className="label">In stock</label>
              <input
                className="field"
                inputMode="numeric"
                value={form.stock}
                onChange={(e) =>
                  setForm({ ...form, stock: e.target.value.replace(/[^0-9]/g, "") })
                }
              />
            </div>
          </div>
          <p className="text-xs text-mist">
            Discount keeps the regular price. Example: $100 + 20% = $80 on the shop.
            {Number(form.price) > 0 && Number(form.discountPercent) > 0
              ? ` Preview $${(
                  Number(form.price) *
                  (1 - Math.min(100, Number(form.discountPercent)) / 100)
                ).toFixed(2)}`
              : Number(form.price) === 0
                ? " Preview: FREE"
                : ""}
          </p>
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
            placeholder="Image URL (optional)"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-mist">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Show on shop
          </label>
          <label className="flex items-center gap-2 text-sm text-mist">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
            />
            Featured on home
          </label>
          <div className="flex gap-2">
            <button className="btn btn-primary" type="submit">
              {editingId ? "Save changes" : "Add to inventory"}
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
          <h3 className="display text-3xl">Current stock ({products.length})</h3>
          <div className="max-h-[70vh] space-y-3 overflow-auto pr-1">
            {products.map((p) => (
              <article
                key={p.id}
                className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/40">
                  <Image src={p.image} alt={p.name} fill className="object-contain p-1" unoptimized />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-semibold">{p.name}</h4>
                  <ProductPrice product={p} size="sm" />
                  <p className="text-xs text-mist">
                    Stock {p.stock}
                    {!p.active ? " · hidden" : ""}
                  </p>
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      className="text-xs text-red underline"
                      onClick={() => {
                        setEditingId(p.id);
                        setForm({
                          name: p.name,
                          description: p.description,
                          price: String(p.price ?? 0),
                          discountPercent: String(p.discountPercent ?? 0),
                          stock: String(p.stock ?? 0),
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
                      onClick={() => remove(p.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
