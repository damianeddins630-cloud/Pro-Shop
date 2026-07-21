"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddItemButton, EditableText, ItemControls } from "@/components/Editable";
import { useCart } from "@/lib/cart";
import { useEditMode } from "@/lib/edit-mode";
import type { Product } from "@/lib/types";

export function EditableProductGrid({ initial }: { initial: Product[] }) {
  const [products, setProducts] = useState(initial);
  const { editing } = useEditMode();
  const { add } = useCart();
  const router = useRouter();

  async function rename(id: string, name: string) {
    const res = await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Rename failed");
    setProducts((prev) => prev.map((p) => (p.id === id ? data.product : p)));
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
    setProducts((prev) => prev.filter((p) => p.id !== id));
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
    setProducts((prev) => [data.product, ...prev]);
    router.refresh();
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
                  />
                </div>
              </Link>
              <div className="space-y-1 p-4">
                <p className="text-xs tracking-[0.14em] text-red uppercase">{product.brand}</p>
                <EditableText
                  as="h3"
                  className="text-lg font-semibold text-chalk"
                  value={product.name}
                  onSave={(name) => rename(product.id, name)}
                />
                <p className="text-mist">${product.price.toFixed(2)}</p>
                <p className="text-xs text-mist/80">
                  {out ? "Out of stock" : `${product.stock} in stock`}
                </p>
                <ItemControls onRemove={() => remove(product.id)} />
              </div>
              {!editing && (
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    disabled={out}
                    onClick={() => add(product.id)}
                    className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {out ? "Sold out" : "Add to cart"}
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
