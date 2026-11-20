"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ProductPrice } from "@/components/ProductPrice";
import { OpsPageHeader, OpsStatCard } from "@/components/ops/OpsUi";
import { saveLocalInventory } from "@/lib/inventory-client";
import type { Product } from "@/lib/types";
import { summarizeBallInventory } from "@/lib/inventory-stats";
import {
  STANDARD_BALL_WEIGHTS,
  formatWeightLbs,
  normalizeWeightOptions,
  weightKey,
} from "@/lib/weights";

const empty = {
  name: "",
  description: "",
  price: "0",
  cost: "0",
  discountPercent: "0",
  stock: "0",
  lowStockThreshold: "3",
  supplier: "",
  category: "Accessories",
  brand: "Storm",
  image: "",
  sku: "",
  upc: "",
  featured: false,
  active: true,
  weightOptions: [] as number[],
  weightStock: {} as Record<string, string>,
  variantMeta: {} as Record<string, { sku: string; upc: string }>,
  customWeight: "",
};

const PAGE_SIZE = 40;

export default function OpsInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [persistWarning, setPersistWarning] = useState("");
  const [editingWeight, setEditingWeight] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [onlyNeedsPrice, setOnlyNeedsPrice] = useState(false);
  const [onlyActive, setOnlyActive] = useState(false);
  const [page, setPage] = useState(0);
  const [adjustments, setAdjustments] = useState<
    {
      id: string;
      productName: string;
      previousStock: number;
      nextStock: number;
      delta: number;
      reason: string;
      at: string;
      actorName?: string;
    }[]
  >([]);

  const load = useCallback(async () => {
    const [res, adjRes] = await Promise.all([
      fetch(`/api/products?admin=1&t=${Date.now()}`, { cache: "no-store" }),
      fetch("/api/ops/inventory/adjustments", { cache: "no-store" }),
    ]);
    const data = await res.json();
    const list = data.products || [];
    setProducts(list);
    if (adjRes.ok) {
      const adj = await adjRes.json().catch(() => ({}));
      setAdjustments(adj.adjustments || []);
    }
    if (data.persist?.lastPersistOk === false) {
      const detail = String(data.persist.lastPersistDetail || "unknown");
      const coldStart = detail.includes("No durable save verified");
      const blobOk = Boolean(data.persist.backends?.blob?.ok);
      if (coldStart && (blobOk || data.persist.durableWriteConfigured)) {
        setPersistWarning("");
        saveLocalInventory(list, data.updatedAt);
      } else if (blobOk) {
        setPersistWarning(
          `Optional backups offline (${detail}). Blob is working — price/stock changes still stick.`
        );
        saveLocalInventory(list, data.updatedAt);
      } else {
        setPersistWarning(
          `Durable save is broken (${detail}). Fixes will not stick until Blob (or Redis/GITHUB_TOKEN) works.`
        );
      }
    } else {
      setPersistWarning("");
      saveLocalInventory(list, data.updatedAt);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [products]
  );
  const brands = useMemo(
    () =>
      Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [products]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (brand !== "all" && p.brand !== brand) return false;
      if (onlyNeedsPrice && !(Number(p.price) <= 0)) return false;
      if (onlyActive && !p.active) return false;
      if (!needle) return true;
      const meta = Object.values(p.variantMeta || {})
        .map((m) => `${m.sku} ${m.upc}`)
        .join(" ");
      const hay = `${p.name} ${p.brand} ${p.category} ${p.sku || ""} ${p.upc || ""} ${meta}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [products, q, category, brand, onlyNeedsPrice, onlyActive]);

  useEffect(() => {
    setPage(0);
  }, [q, category, brand, onlyNeedsPrice, onlyActive]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const needsPriceCount = products.filter((p) => Number(p.price) <= 0).length;

  function startEdit(p: Product) {
    const weightOptions = normalizeWeightOptions(p.weightOptions) || [];
    const weightStock: Record<string, string> = {};
    for (const w of weightOptions) {
      const key = weightKey(w);
      weightStock[key] = String(p.weightStock?.[key] ?? 0);
    }
    setEditingId(p.id);
    setEditingWeight(weightOptions[0] ?? null);
    setForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price ?? 0),
      cost: String(p.cost ?? 0),
      discountPercent: String(p.discountPercent ?? 0),
      stock: String(p.stock ?? 0),
      lowStockThreshold: String(p.lowStockThreshold ?? 3),
      supplier: p.supplier || "",
      category: p.category || "Accessories",
      brand: p.brand || "Storm",
      image: p.image || "",
      sku: p.sku || "",
      upc: p.upc || "",
      featured: Boolean(p.featured),
      active: Boolean(p.active),
      weightOptions,
      weightStock,
      variantMeta: p.variantMeta || {},
      customWeight: "",
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    const price = Math.max(0, Number(form.price));
    const discountPercent = Math.min(
      100,
      Math.max(0, Number(form.discountPercent))
    );
    const weightOptions = normalizeWeightOptions(form.weightOptions) || [];
    const weightStock: Record<string, number> = {};
    if (weightOptions.length) {
      for (const w of weightOptions) {
        const key = weightKey(w);
        weightStock[key] = Math.max(
          0,
          Math.floor(Number(form.weightStock[key] ?? "0") || 0)
        );
      }
    }
    const stock = weightOptions.length
      ? Object.values(weightStock).reduce((s, n) => s + n, 0)
      : Math.max(0, Math.floor(Number(form.stock)));
    if ([price, discountPercent, stock].some((n) => Number.isNaN(n))) {
      setError("Price, discount, and stock must be numbers. $0 is allowed.");
      setSaving(false);
      return;
    }
    const variantMeta =
      weightOptions.length && Object.keys(form.variantMeta || {}).length
        ? Object.fromEntries(
            weightOptions.map((w) => {
              const key = weightKey(w);
              const row = form.variantMeta[key] || { sku: "", upc: "" };
              return [key, { sku: row.sku || "", upc: row.upc || "" }];
            })
          )
        : undefined;
    const payload = {
      name: form.name.trim(),
      description: form.description,
      price,
      cost: Math.max(0, Number(form.cost) || 0),
      discountPercent,
      stock,
      lowStockThreshold: Math.max(0, Math.floor(Number(form.lowStockThreshold) || 0)),
      supplier: form.supplier.trim() || undefined,
      category: form.category,
      brand: form.brand,
      image: form.image.trim() || "/images/logo.png",
      featured: form.featured,
      active: form.active,
      weightOptions,
      weightStock: weightOptions.length ? weightStock : {},
      sku: form.sku.trim() || undefined,
      upc: form.upc.trim() || undefined,
      variantMeta,
    };
    try {
      const res = await fetch(
        editingId ? `/api/products/${editingId}` : "/api/products",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
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
        `${editingId ? "Updated" : "Added"} "${payload.name}" — saved for every shopper.${
          data.voidedUnpaidCheckouts
            ? ` Voided ${data.voidedUnpaidCheckouts} unpaid invoice(s).`
            : ""
        }`
      );
      setForm(empty);
      setEditingId(null);
      setEditingWeight(null);
    } finally {
      setSaving(false);
    }
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
    setMessage("Item removed.");
    if (editingId === id) {
      setEditingId(null);
      setForm(empty);
      setEditingWeight(null);
    }
  }

  const ballSummary = summarizeBallInventory(products);
  const valuation = useMemo(() => {
    let atCost = 0;
    let atPrice = 0;
    let profitIfSold = 0;
    for (const p of products.filter((x) => x.active)) {
      const stock = Math.max(0, p.stock || 0);
      const cost = Math.max(0, Number(p.cost) || 0);
      const price = Math.max(0, Number(p.price) || 0);
      atCost += cost * stock;
      atPrice += price * stock;
      profitIfSold += (price - cost) * stock;
    }
    return {
      atCost: Math.round(atCost * 100) / 100,
      atPrice: Math.round(atPrice * 100) / 100,
      profitIfSold: Math.round(profitIfSold * 100) / 100,
    };
  }, [products]);

  if (loading) return <p className="text-mist">Loading inventory…</p>;

  return (
    <div className="ops-dash-grid">
      <OpsPageHeader
        title="Inventory"
        description="Website prices & stock are the source of truth. Search SKU/UPC, set cost and selling price, then save — Shopify only takes payment. Paid orders automatically decrement stock and write adjustment history."
        actions={
          <>
            <span className="ops-filter-chip">{products.length} items</span>
            <span className="ops-filter-chip">
              {ballSummary.totalBalls} balls in stock
            </span>
            {needsPriceCount > 0 ? (
              <button
                type="button"
                className={`ops-filter-chip ${onlyNeedsPrice ? "active" : ""}`}
                onClick={() => setOnlyNeedsPrice((v) => !v)}
              >
                {needsPriceCount} need price
              </button>
            ) : null}
          </>
        }
      />

      <div className="ops-kpi-row">
        <OpsStatCard
          tone="red"
          label="Valuation at cost"
          value={`$${valuation.atCost.toLocaleString()}`}
        />
        <OpsStatCard
          tone="blue"
          label="At sell price"
          value={`$${valuation.atPrice.toLocaleString()}`}
        />
        <OpsStatCard
          tone="green"
          label="Potential profit"
          value={`$${valuation.profitIfSold.toLocaleString()}`}
        />
        <OpsStatCard
          tone="amber"
          label="Ball units"
          value={String(ballSummary.totalBalls)}
          meta={`${products.filter((p) => p.active).length} active SKUs`}
        />
      </div>

      {persistWarning ? (
        <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold text-amber-200">Storage warning</p>
          <p className="mt-1">{persistWarning}</p>
        </div>
      ) : null}

      {(message || error) && (
        <p
          className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
            error
              ? "border-red/40 bg-red/10 text-red-200"
              : "border-emerald-400/35 bg-emerald-400/10 text-emerald-100"
          }`}
        >
          {error || message}
        </p>
      )}

      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className="field"
          placeholder="Search name, SKU, UPC…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="field"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        >
          <option value="all">All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-3 text-sm text-mist">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
            />
            Active only
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={onlyNeedsPrice}
              onChange={(e) => setOnlyNeedsPrice(e.target.checked)}
            />
            Needs price
          </label>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-white/12">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="sticky top-0 bg-black/90 text-xs tracking-wide text-steel uppercase">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Item</th>
                    <th className="px-3 py-2.5 font-medium">SKU / UPC</th>
                    <th className="px-3 py-2.5 font-medium">Price</th>
                    <th className="px-3 py-2.5 font-medium">Stock</th>
                    <th className="px-3 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => {
                    const sku =
                      p.sku ||
                      Object.values(p.variantMeta || {})
                        .map((m) => m.sku)
                        .filter(Boolean)
                        .slice(0, 2)
                        .join(", ") ||
                      "—";
                    const upc =
                      p.upc ||
                      Object.values(p.variantMeta || {})
                        .map((m) => m.upc)
                        .filter(Boolean)[0] ||
                      "";
                    return (
                      <tr
                        key={p.id}
                        className="border-t border-white/8 hover:bg-white/[0.03]"
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="media-box relative h-10 w-10 shrink-0 overflow-hidden !rounded-lg !p-1">
                              <Image
                                src={p.image || "/images/logo.png"}
                                alt=""
                                fill
                                className="img-clean"
                                unoptimized
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-chalk">
                                {p.name}
                              </p>
                              <p className="truncate text-xs text-mist">
                                {p.brand} · {p.category}
                                {!p.active && (
                                  <span className="ml-1 text-amber-200">
                                    · hidden
                                  </span>
                                )}
                                {Number(p.price) <= 0 && (
                                  <span className="ml-1 text-amber-200">
                                    · set price
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-mist">
                          <div className="truncate">{sku}</div>
                          {upc ? (
                            <div className="truncate text-[11px] text-steel">
                              {upc}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5">
                          <ProductPrice product={p} size="sm" />
                        </td>
                        <td className="px-3 py-2.5 text-mist">{p.stock}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            className="text-xs text-red hover:underline"
                            onClick={() => startEdit(p)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!pageItems.length && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-8 text-center text-mist"
                      >
                        No items match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-mist">
            <p>
              Showing {pageItems.length} of {filtered.length}
              {filtered.length !== products.length
                ? ` (filtered from ${products.length})`
                : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost !px-3 !py-1.5 text-xs"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </button>
              <span>
                {page + 1} / {pageCount}
              </span>
              <button
                type="button"
                className="btn btn-ghost !px-3 !py-1.5 text-xs"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <form
          onSubmit={save}
          className="h-fit space-y-3 rounded-2xl border border-white/12 bg-white/[0.03] p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="display text-3xl">
              {editingId ? "Edit item" : "Add item"}
            </h3>
            {editingId && (
              <button
                type="button"
                className="text-xs text-mist hover:text-chalk"
                onClick={() => {
                  setEditingId(null);
                  setForm(empty);
                  setEditingWeight(null);
                }}
              >
                Clear
              </button>
            )}
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            <input
              className="field"
              placeholder="SKU"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
            <input
              className="field"
              placeholder="UPC"
              value={form.upc}
              onChange={(e) => setForm({ ...form, upc: e.target.value })}
            />
            <input
              className="field"
              placeholder="Supplier"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            />
            <div>
              <label className="label">Low-stock alert at</label>
              <input
                className="field"
                inputMode="numeric"
                value={form.lowStockThreshold}
                onChange={(e) =>
                  setForm({
                    ...form,
                    lowStockThreshold: e.target.value.replace(/[^0-9]/g, ""),
                  })
                }
              />
            </div>
          </div>
          <div
            className={`grid gap-3 ${
              form.weightOptions.length ? "grid-cols-2" : "grid-cols-3"
            }`}
          >
            <div>
              <label className="label">Selling price ($0 = needs price)</label>
              <input
                className="field"
                inputMode="decimal"
                value={form.price}
                onChange={(e) =>
                  setForm({
                    ...form,
                    price: e.target.value.replace(/[^0-9.]/g, ""),
                  })
                }
              />
            </div>
            <div>
              <label className="label">Purchase cost</label>
              <input
                className="field"
                inputMode="decimal"
                value={form.cost}
                onChange={(e) =>
                  setForm({
                    ...form,
                    cost: e.target.value.replace(/[^0-9.]/g, ""),
                  })
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
            {!form.weightOptions.length ? (
              <div>
                <label className="label">In stock</label>
                <input
                  className="field"
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      stock: e.target.value.replace(/[^0-9]/g, ""),
                    })
                  }
                />
              </div>
            ) : null}
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
            placeholder="Image URL (optional)"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
          />

          <div className="rounded-xl border border-white/10 p-3">
            <p className="mb-2 text-xs tracking-[0.16em] text-red uppercase">
              Ball weights
            </p>
            <div className="flex flex-wrap gap-2">
              {STANDARD_BALL_WEIGHTS.map((w) => {
                const on = form.weightOptions.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      on
                        ? "border-red bg-red/20 text-chalk"
                        : "border-white/15 text-mist"
                    }`}
                    onClick={() => {
                      const next = on
                        ? form.weightOptions.filter((x) => x !== w)
                        : [...form.weightOptions, w].sort((a, b) => a - b);
                      setForm({ ...form, weightOptions: next });
                      if (!on) setEditingWeight(w);
                      if (on && editingWeight === w) setEditingWeight(null);
                    }}
                  >
                    {formatWeightLbs(w)}
                  </button>
                );
              })}
            </div>
            {form.weightOptions.length > 0 && (
              <div className="mt-3 space-y-2">
                <label className="label">Stock for selected weight</label>
                <div className="flex flex-wrap gap-2">
                  {form.weightOptions.map((w) => (
                    <button
                      key={w}
                      type="button"
                      className={`rounded-lg border px-2 py-1 text-xs ${
                        editingWeight === w
                          ? "border-red text-chalk"
                          : "border-white/15 text-mist"
                      }`}
                      onClick={() => setEditingWeight(w)}
                    >
                      {formatWeightLbs(w)}:{" "}
                      {form.weightStock[weightKey(w)] || "0"}
                    </button>
                  ))}
                </div>
                {editingWeight != null && (
                  <>
                    <input
                      className="field"
                      inputMode="numeric"
                      value={form.weightStock[weightKey(editingWeight)] || "0"}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          weightStock: {
                            ...form.weightStock,
                            [weightKey(editingWeight)]: e.target.value.replace(
                              /[^0-9]/g,
                              ""
                            ),
                          },
                        })
                      }
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="field"
                        placeholder={`${formatWeightLbs(editingWeight)} SKU`}
                        value={
                          form.variantMeta[weightKey(editingWeight)]?.sku || ""
                        }
                        onChange={(e) =>
                          setForm({
                            ...form,
                            variantMeta: {
                              ...form.variantMeta,
                              [weightKey(editingWeight)]: {
                                sku: e.target.value,
                                upc:
                                  form.variantMeta[weightKey(editingWeight)]
                                    ?.upc || "",
                              },
                            },
                          })
                        }
                      />
                      <input
                        className="field"
                        placeholder={`${formatWeightLbs(editingWeight)} UPC`}
                        value={
                          form.variantMeta[weightKey(editingWeight)]?.upc || ""
                        }
                        onChange={(e) =>
                          setForm({
                            ...form,
                            variantMeta: {
                              ...form.variantMeta,
                              [weightKey(editingWeight)]: {
                                sku:
                                  form.variantMeta[weightKey(editingWeight)]
                                    ?.sku || "",
                                upc: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-mist">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.checked })
                }
              />
              Active on shop
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) =>
                  setForm({ ...form, featured: e.target.checked })
                }
              />
              Featured
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Add item"}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void remove(editingId)}
              >
                Delete
              </button>
            )}
            <Link href="/shop" className="btn btn-ghost">
              Open shop
            </Link>
          </div>
        </form>
      </div>

      <section className="mt-8 rounded-2xl border border-white/12 bg-black/40 p-5">
        <h3 className="display text-3xl">Stock adjustment history</h3>
        <p className="mt-1 text-sm text-mist">
          Manual edits and paid-order stock drops are logged. Records are never
          silently overwritten without a history entry.
        </p>
        {!adjustments.length ? (
          <p className="mt-3 text-sm text-mist">No adjustments recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {adjustments.slice(0, 40).map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 py-2"
              >
                <div>
                  <strong>{a.productName}</strong>
                  <div className="text-mist">
                    {a.previousStock} → {a.nextStock} ({a.delta >= 0 ? "+" : ""}
                    {a.delta}) · {a.reason} · {a.actorName || "system"}
                  </div>
                </div>
                <span className="text-xs text-mist">
                  {new Date(a.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
