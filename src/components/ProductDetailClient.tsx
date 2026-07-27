"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductPrice } from "@/components/ProductPrice";
import {
  findLocalProduct,
  pickNewestProducts,
} from "@/lib/inventory-client";
import type { Product } from "@/lib/types";

export function ProductDetailClient({
  slug,
  initial,
}: {
  slug: string;
  initial: Product;
}) {
  const [product, setProduct] = useState<Product>(initial);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const localHit = findLocalProduct(slug);
      if (localHit && !cancelled) setProduct(localHit);

      try {
        const res = await fetch(`/api/products?t=${Date.now()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        const list = (data.products || []) as Product[];
        const merged = pickNewestProducts(
          list,
          typeof data.updatedAt === "string" ? data.updatedAt : undefined
        );
        const hit =
          merged.find((p) => p.slug === slug || p.id === slug) ||
          findLocalProduct(slug);
        if (hit && !cancelled) setProduct(hit);
      } catch {
        // keep local / initial
      }
    }

    void load();
    const refresh = () => void load();
    window.addEventListener("bba-inventory", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("bba-inventory", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [slug]);

  const out = product.stock <= 0;

  return (
    <section className="site-shell section-pad pt-24">
      <Link href="/shop" className="text-sm text-mist underline decoration-red/40">
        ← Back to shop
      </Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-white/10 bg-black/30">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-8"
            priority
            unoptimized
          />
        </div>
        <div>
          <p className="text-sm tracking-[0.18em] text-red uppercase">{product.brand}</p>
          <h1 className="display mt-2 text-5xl md:text-6xl">{product.name}</h1>
          <div className="mt-4">
            <ProductPrice product={product} size="lg" />
          </div>
          <p className="mt-2 text-sm text-mist">
            {out ? "Out of stock" : `${product.stock} in stock`} · {product.category}
          </p>
          <p className="mt-6 leading-relaxed text-mist">{product.description}</p>
          <div className="mt-8">
            <AddToCartButton productId={product.id} disabled={out} />
          </div>
        </div>
      </div>
    </section>
  );
}
