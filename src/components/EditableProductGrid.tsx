"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AddItemButton, EditableText, ItemControls } from "@/components/Editable";
import { ProductPrice } from "@/components/ProductPrice";
import { useCart } from "@/lib/cart";
import { useEditMode } from "@/lib/edit-mode";
import type { Product } from "@/lib/types";

type Filters = {
  brand?: string;
  q?: string;
  category?: string;
  featuredOnly?: boolean;
  limit?: number;
};

function applyFilters(list: Product[], filters?: Filters) {
  let next = list;
  if (filters?.featuredOnly) next = next.filter((p) => p.featured);
  if (filters?.brand) next = next.filter((p) => p.brand === filters.brand);
  if (filters?.category) next = next.filter((p) => p.category === filters.category);
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
  const [products, setProducts] = useState<Product[]>(() =>
    applyFilters(initial, filters)
  );
  const [loading, setLoading] = useState(!initial.length);
  const { editMode: editing, user, loading: authLoading } = useEditMode();
  const { add } = useCart();
  const router = useRouter();

  const filterKey = JSON.stringify(filters || {});

  const load = useCallback(async () => {
    const activeFilters = JSON.parse(filterKey) as Filters;
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      const data = await res.json();
      setProducts(applyFilters(data.products || [], activeFilters));
    } catch {
      // keep current
    } finally {
      setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    window.addEventListener("bba-inventory", refresh);
    const id = window.setInterval(refresh, 12000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("bba-inventory", refresh);
      window.clearInterval(id);
    };
  }, [load]);

  function onBuy(productId: string, slug: string) {
    if (authLoading) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/shop/${slug}`)}`);
      return;
    }
    add(productId);
  }

  async function rename(id: string, name: string) {
    const res = await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Rename failed");
    window.dispatchEvent(new Event("bba-inventory"));
    await load();
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this product?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Delete failed");
      return;
    }
    window.dispatchEvent(new Event("bba-inventory"));
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
    window.dispatchEvent(new Event("bba-inventory"));
    await load();
    router.refresh();
  }

  if (loading && products.length === 0) {
    return <p className="text-mist">Loading inventory...</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {products.map((product) => {
          const out = product.stock <= 0;
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
                <p className="text-xs tracking-[0.14em] text-red uppercase">
                  {product.brand}
                </p>
                <EditableText
                  as="h3"
                  className="text-lg font-semibold text-chalk"
                  value={product.name}
                  onSave={(name) => rename(product.id, name)}
                />
                <ProductPrice product={product} />
                <p className="text-xs text-mist/80">
                  {out ? "Out of stock" : `${product.stock} in stock`}
                </p>
                <ItemControls onRemove={() => remove(product.id)} />
              </div>
              {!editing && (
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    disabled={out || authLoading}
                    onClick={() => onBuy(product.id, product.slug)}
                    className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {out ? "Sold out" : user ? "Add to cart" : "Login to buy"}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <AddItemButton onAdd={addProduct} label="Add product" />
    </div>
  );
}
