"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AddItemButton, EditableText, ItemControls } from "@/components/Editable";
import { ProductPrice } from "@/components/ProductPrice";
import { useCart } from "@/lib/cart";
import { useEditMode } from "@/lib/edit-mode";
import {
  activeProducts,
  loadLocalInventory,
  pickNewestProducts,
  saveLocalInventory,
} from "@/lib/inventory-client";
import type { Product } from "@/lib/types";
import { brandsMatch, categoriesMatch } from "@/lib/shop-nav";
import { productRequiresWeight } from "@/lib/weights";

type Filters = {
  brand?: string;
  q?: string;
  category?: string;
  featuredOnly?: boolean;
  limit?: number;
};

function applyFilters(list: Product[], filters?: Filters) {
  let next = activeProducts(list);
  if (filters?.featuredOnly) next = next.filter((p) => p.featured);
  if (filters?.brand) {
    next = next.filter((p) => brandsMatch(p.brand, filters.brand!));
  }
  if (filters?.category) {
    next = next.filter((p) => categoriesMatch(p.category, filters.category!));
  }
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    next = next.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }
  if (filters?.limit) next = next.slice(0, filters.limit);
  return next;
}

export function EditableProductGrid({
  initial = [],
  filters,
}: {
  initial?: Product[];
  filters?: Filters;
}) {
  const filterKey = JSON.stringify(filters || {});
  const [products, setProducts] = useState<Product[]>(() =>
    applyFilters(initial, filters)
  );
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"local" | "api" | "">("");
  const { editMode: editing } = useEditMode();
  const { add } = useCart();
  const router = useRouter();

  const load = useCallback(async () => {
    const activeFilters = JSON.parse(filterKey) as Filters;

    // Show whatever this browser already has from Ops (instant)
    const localNow = loadLocalInventory();
    if (localNow?.products?.length) {
      setProducts(applyFilters(localNow.products, activeFilters));
      setSource("local");
      setLoading(false);
    }

    try {
      const res = await fetch(`/api/products?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      const apiProducts = (data.products || []) as Product[];
      const apiUpdatedAt = typeof data.updatedAt === "string" ? data.updatedAt : undefined;

      // Re-read local AFTER the network call — Ops may have saved mid-request
      const merged = pickNewestProducts(apiProducts, apiUpdatedAt);
      setProducts(applyFilters(merged, activeFilters));
      setSource(loadLocalInventory()?.products?.length ? "local" : "api");
    } catch {
      const fallback = loadLocalInventory()?.products?.length
        ? loadLocalInventory()!.products
        : initial;
      setProducts(applyFilters(fallback, activeFilters));
    } finally {
      setLoading(false);
    }
  }, [filterKey, initial]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    window.addEventListener("bba-inventory", refresh);
    window.addEventListener("storage", refresh);
    const id = window.setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("bba-inventory", refresh);
      window.removeEventListener("storage", refresh);
      window.clearInterval(id);
    };
  }, [load]);

  async function rename(id: string, name: string) {
    const res = await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Rename failed");
    if (Array.isArray(data.products)) {
      saveLocalInventory(data.products, data.updatedAt);
    }
    await load();
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this product?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Delete failed");
      return;
    }
    if (Array.isArray(data.products)) {
      saveLocalInventory(data.products, data.updatedAt);
    }
    await load();
    router.refresh();
  }

  async function addProduct() {
    const name = prompt("New product name?");
    if (!name?.trim()) return;
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: "New inventory item",
        price: 0,
        discountPercent: 0,
        stock: 1,
        category: "Accessories",
        brand: "Ballard's Bowling",
        image: "/images/logo.png",
        featured: false,
        active: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Add failed");
      return;
    }
    if (Array.isArray(data.products)) {
      saveLocalInventory(data.products, data.updatedAt);
    } else if (data.product) {
      const local = loadLocalInventory()?.products || products;
      saveLocalInventory([data.product, ...local], data.updatedAt);
    }
    await load();
    router.refresh();
  }

  if (loading && products.length === 0) {
    return <p className="text-mist">Loading inventory...</p>;
  }

  return (
    <div>
      {source === "local" && (
        <p className="mb-4 text-xs text-emerald-300">
          Showing your latest inventory updates.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {products.map((product) => {
          const out = product.stock <= 0;
          const needsWeight = productRequiresWeight(product);
          return (
            <article
              key={product.id}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-red/40 hover:bg-white/[0.05]"
            >
              <Link href={`/shop/${product.slug}`} className="block">
                <div className="relative aspect-square overflow-hidden bg-black/30">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-contain p-4 transition duration-500 group-hover:scale-105"
                    sizes="(max-width:768px) 50vw, 25vw"
                    unoptimized
                  />
                </div>
              </Link>
              <div className="space-y-1 p-4">
                <Link
                  href={`/shop?brand=${encodeURIComponent(product.brand)}#inventory`}
                  className="text-xs tracking-[0.14em] text-red uppercase hover:underline"
                >
                  {product.brand}
                </Link>
                <EditableText
                  as="h3"
                  className="text-lg font-semibold text-chalk"
                  value={product.name}
                  onSave={(name) => rename(product.id, name)}
                />
                <ProductPrice product={product} />
                <p className="text-xs text-mist/80">
                  {out
                    ? "Out of stock"
                    : needsWeight
                      ? "Select a size"
                      : `${product.stock} in stock`}
                  {needsWeight && !out
                    ? ` · ${(product.weightOptions || []).join("/")} lb`
                    : ""}
                </p>
                <ItemControls onRemove={() => remove(product.id)} />
              </div>
              {!editing && (
                <div className="px-4 pb-4">
                  {out ? (
                    <button
                      type="button"
                      disabled
                      className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Sold out
                    </button>
                  ) : needsWeight ? (
                    <Link
                      href={`/shop/${product.slug}`}
                      className="btn btn-primary w-full"
                    >
                      Choose weight
                    </Link>
                  ) : (
                    <a
                      href="/cart"
                      className="btn btn-primary w-full"
                      onClick={() => {
                        add(product.id);
                      }}
                    >
                      Add to cart
                    </a>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {!products.length && (
        <p className="mt-8 text-mist">No products match that filter.</p>
      )}
      <AddItemButton onAdd={addProduct} label="Add product" />
    </div>
  );
}
