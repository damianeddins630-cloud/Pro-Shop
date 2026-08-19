"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ProductPrice } from "@/components/ProductPrice";
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
  discountPercent: "0",
  stock: "0",
  category: "Accessories",
  brand: "Ballard's Bowling",
  image: "",
  featured: false,
  active: true,
  weightOptions: [] as number[],
  weightStock: {} as Record<string, string>,
  customWeight: "",
};

export default function OpsInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [persistWarning, setPersistWarning] = useState("");
  /** Size currently selected for entering "how many in stock". */
  const [editingWeight, setEditingWeight] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/products?admin=1&t=${Date.now()}`, {
      cache: "no-store",
    });
    const data = await res.json();
    const list = data.products || [];
    setProducts(list);
    if (data.persist?.lastPersistOk === false) {
      const detail = String(data.persist.lastPersistDetail || "unknown");
      const coldStart = detail.includes("No durable save verified");
      const blobOk = Boolean(data.persist.backends?.blob?.ok);
      // Cold instance + Blob already readable (or write-configured) is not "broken".
      if (coldStart && (blobOk || data.persist.durableWriteConfigured)) {
        setPersistWarning("");
        saveLocalInventory(list, data.updatedAt);
      } else if (blobOk) {
        setPersistWarning(
          `Optional backups offline (${detail}). Blob is working — price/stock changes still stick for shoppers.`
        );
        saveLocalInventory(list, data.updatedAt);
      } else {
        setPersistWarning(
          `Durable save is broken (${detail}). Fixes will not stick for shoppers until Blob (or Redis/GITHUB_TOKEN) works.`
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

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const price = Math.max(0, Number(form.price));
    const discountPercent = Math.min(100, Math.max(0, Number(form.discountPercent)));
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
      weightOptions,
      weightStock: weightOptions.length ? weightStock : {},
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
    setEditingWeight(null);
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
      setEditingWeight(null);
    }
  }

  const ballSummary = summarizeBallInventory(products);

  if (loading) return <p className="text-mist">Loading inventory...</p>;

  return (
    <div>
      <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] via-black/30 to-red/10 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.22em] text-red uppercase">Ball vault</p>
            <h3 className="display mt-1 text-4xl">
              {ballSummary.totalBalls} balls in stock
            </h3>
            <p className="mt-1 text-sm text-mist">
              {ballSummary.ballSkus} ball SKUs · {ballSummary.accessoryUnits} accessory
              units · pick a size, then enter how many you have
            </p>
          </div>
          <Link href="/ops/orders" className="btn btn-ghost !py-2 text-sm">
            Open order command →
          </Link>
        </div>
        {ballSummary.byWeight.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {ballSummary.byWeight.map((b) => (
              <div
                key={b.weight}
                className="min-w-[4.25rem] rounded-2xl border border-white/15 bg-black/35 px-3 py-2 text-center"
              >
                <p className="text-xs text-mist">{b.label}</p>
                <p className="display text-2xl">{b.stock || "—"}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

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
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-mist">
        This website owns prices. Shopify is payment only — Shopify Admin product
        prices will <span className="text-chalk">not</span> change. After you save
        here, the next <span className="text-chalk">Pay with Shopify</span> charge
        uses these website amounts.
      </div>
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
              <label className="label">
                {form.weightOptions.length ? "Total (all sizes)" : "In stock"}
              </label>
              <input
                className="field"
                inputMode="numeric"
                disabled={form.weightOptions.length > 0}
                value={
                  form.weightOptions.length
                    ? String(
                        form.weightOptions.reduce((sum, w) => {
                          const key = weightKey(w);
                          return (
                            sum +
                            Math.max(
                              0,
                              Math.floor(Number(form.weightStock[key] ?? "0") || 0)
                            )
                          );
                        }, 0)
                      )
                    : form.stock
                }
                onChange={(e) =>
                  setForm({ ...form, stock: e.target.value.replace(/[^0-9]/g, "") })
                }
              />
            </div>
          </div>
          {form.weightOptions.length ? (
            <p className="text-xs text-mist">
              Total stock is the sum of each size. Shoppers pick a size first — sizes
              with 0 cannot be selected on the shop.
            </p>
          ) : null}
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

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-chalk">Ball sizes (lb)</p>
                <p className="mt-1 text-xs text-mist">
                  1) Select a size · 2) Enter how many you have. Shoppers can only
                  pick sizes with stock above 0.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs text-red underline"
                  onClick={() => {
                    const nextStock = { ...form.weightStock };
                    for (const w of STANDARD_BALL_WEIGHTS) {
                      const key = weightKey(w);
                      if (nextStock[key] == null) nextStock[key] = "0";
                    }
                    setForm({
                      ...form,
                      weightOptions: [...STANDARD_BALL_WEIGHTS],
                      weightStock: nextStock,
                    });
                    setEditingWeight(15);
                  }}
                >
                  Add 8–16 lb
                </button>
                <button
                  type="button"
                  className="text-xs text-mist underline"
                  onClick={() => {
                    setForm({ ...form, weightOptions: [], weightStock: {} });
                    setEditingWeight(null);
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {STANDARD_BALL_WEIGHTS.map((weight) => {
                const on = form.weightOptions.some(
                  (w) => Math.abs(w - weight) < 0.001
                );
                const key = weightKey(weight);
                const qty = Math.max(
                  0,
                  Math.floor(Number(form.weightStock[key] ?? "0") || 0)
                );
                const selected =
                  editingWeight != null &&
                  Math.abs(editingWeight - weight) < 0.001;
                return (
                  <button
                    key={weight}
                    type="button"
                    className={`weight-bubble ${selected ? "is-selected" : ""} ${on && qty <= 0 ? "is-soldout" : ""}`}
                    title={
                      on
                        ? `${formatWeightLbs(weight)} · ${qty} in stock — click to edit qty`
                        : `Add ${formatWeightLbs(weight)}`
                    }
                    onClick={() => {
                      if (!on) {
                        setForm({
                          ...form,
                          weightOptions: [...form.weightOptions, weight].sort(
                            (a, b) => a - b
                          ),
                          weightStock: {
                            ...form.weightStock,
                            [key]: form.weightStock[key] ?? "0",
                          },
                        });
                      }
                      setEditingWeight(weight);
                    }}
                  >
                    <span className="weight-bubble-main">
                      {formatWeightLbs(weight)}
                    </span>
                    {on ? (
                      <span className="weight-bubble-qty">{qty}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {editingWeight != null &&
            form.weightOptions.some(
              (w) => Math.abs(w - editingWeight) < 0.001
            ) ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-[10rem] flex-1">
                    <span className="label">
                      How many in stock · {formatWeightLbs(editingWeight)}
                    </span>
                    <input
                      className="field"
                      inputMode="numeric"
                      autoFocus
                      value={
                        form.weightStock[weightKey(editingWeight)] ?? "0"
                      }
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
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost !py-2 text-sm"
                    onClick={() => {
                      const key = weightKey(editingWeight);
                      const nextStock = { ...form.weightStock };
                      delete nextStock[key];
                      const nextOptions = form.weightOptions.filter(
                        (w) => Math.abs(w - editingWeight) >= 0.001
                      );
                      setForm({
                        ...form,
                        weightOptions: nextOptions,
                        weightStock: nextStock,
                      });
                      setEditingWeight(nextOptions[0] ?? null);
                    }}
                  >
                    Remove size
                  </button>
                </div>
                <p className="mt-2 text-xs text-mist">
                  Enter 0 if you are out of this size — shoppers will not be able
                  to select it.
                </p>
              </div>
            ) : form.weightOptions.length ? (
              <p className="mt-3 text-xs text-mist">
                Tap a size above to set how many you have.
              </p>
            ) : (
              <p className="mt-3 text-xs text-mist">
                No sizes yet — tap a weight (or Add 8–16 lb) to start.
              </p>
            )}

            {form.weightOptions.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {form.weightOptions.map((weight) => {
                  const key = weightKey(weight);
                  const qty = Math.max(
                    0,
                    Math.floor(Number(form.weightStock[key] ?? "0") || 0)
                  );
                  return (
                    <button
                      key={`summary-${key}`}
                      type="button"
                      className={`rounded-full border px-3 py-1 text-xs ${
                        qty > 0
                          ? "border-white/20 text-chalk"
                          : "border-white/10 text-mist line-through"
                      }`}
                      onClick={() => setEditingWeight(weight)}
                    >
                      {formatWeightLbs(weight)} · {qty}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {form.weightOptions.some(
              (w) =>
                !STANDARD_BALL_WEIGHTS.some((s) => Math.abs(s - w) < 0.001)
            ) ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {form.weightOptions
                  .filter(
                    (w) =>
                      !STANDARD_BALL_WEIGHTS.some(
                        (s) => Math.abs(s - w) < 0.001
                      )
                  )
                  .map((weight) => (
                    <button
                      key={`custom-${weight}`}
                      type="button"
                      className={`weight-bubble ${
                        editingWeight != null &&
                        Math.abs(editingWeight - weight) < 0.001
                          ? "is-selected"
                          : ""
                      }`}
                      onClick={() => setEditingWeight(weight)}
                      title="Edit custom weight qty"
                    >
                      <span className="weight-bubble-main">
                        {formatWeightLbs(weight)}
                      </span>
                      <span className="weight-bubble-qty">
                        {Math.max(
                          0,
                          Math.floor(
                            Number(form.weightStock[weightKey(weight)] ?? "0") ||
                              0
                          )
                        )}
                      </span>
                    </button>
                  ))}
              </div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <input
                className="field"
                inputMode="decimal"
                placeholder="Custom lb"
                value={form.customWeight}
                onChange={(e) =>
                  setForm({
                    ...form,
                    customWeight: e.target.value.replace(/[^0-9.]/g, ""),
                  })
                }
              />
              <button
                type="button"
                className="btn btn-ghost shrink-0 !py-2"
                onClick={() => {
                  const n = Number(form.customWeight);
                  if (!Number.isFinite(n) || n <= 0 || n > 30) return;
                  const rounded = Math.round(n * 10) / 10;
                  const key = weightKey(rounded);
                  if (
                    form.weightOptions.some(
                      (w) => Math.abs(w - rounded) < 0.001
                    )
                  ) {
                    setForm({ ...form, customWeight: "" });
                    setEditingWeight(rounded);
                    return;
                  }
                  setForm({
                    ...form,
                    customWeight: "",
                    weightOptions: [...form.weightOptions, rounded].sort(
                      (a, b) => a - b
                    ),
                    weightStock: {
                      ...form.weightStock,
                      [key]: form.weightStock[key] ?? "0",
                    },
                  });
                  setEditingWeight(rounded);
                }}
              >
                Add
              </button>
            </div>
          </div>

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
                  setEditingWeight(null);
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
                    {p.weightOptions?.length
                      ? ` · ${p.weightOptions
                          .map((w) => {
                            const qty = p.weightStock?.[weightKey(w)];
                            return qty != null
                              ? `${w}lb×${qty}`
                              : `${w}lb`;
                          })
                          .join(" · ")}`
                      : ""}
                  </p>
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      className="text-xs text-red underline"
                      onClick={() => {
                        const weightOptions = p.weightOptions || [];
                        const weightStock: Record<string, string> = {};
                        for (const w of weightOptions) {
                          const key = weightKey(w);
                          weightStock[key] = String(
                            p.weightStock?.[key] ?? 0
                          );
                        }
                        setEditingId(p.id);
                        const firstWithStock =
                          weightOptions.find((w) => {
                            const key = weightKey(w);
                            return (
                              Math.max(
                                0,
                                Math.floor(Number(p.weightStock?.[key] ?? 0) || 0)
                              ) > 0
                            );
                          }) ?? weightOptions[0] ?? null;
                        setEditingWeight(firstWithStock);
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
                          weightOptions,
                          weightStock,
                          customWeight: "",
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
