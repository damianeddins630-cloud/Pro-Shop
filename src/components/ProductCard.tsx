"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { useCart } from "@/lib/cart";
import { ProductPrice } from "@/components/ProductPrice";
import { productRequiresWeight } from "@/lib/weights";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const out = product.stock <= 0;
  const needsWeight = productRequiresWeight(product);

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-red/40 hover:bg-white/[0.05]">
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
        <Link href={`/shop/${product.slug}`} className="block">
          <h3 className="text-lg font-semibold text-chalk">{product.name}</h3>
        </Link>
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
      </div>
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
          <Link href={`/shop/${product.slug}`} className="btn btn-primary w-full">
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
    </article>
  );
}
