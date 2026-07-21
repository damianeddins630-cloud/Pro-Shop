"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { useCart } from "@/lib/cart";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const out = product.stock <= 0;

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
          />
        </div>
        <div className="space-y-1 p-4">
          <p className="text-xs tracking-[0.14em] text-red uppercase">{product.brand}</p>
          <h3 className="text-lg font-semibold text-chalk">{product.name}</h3>
          <p className="text-mist">${product.price.toFixed(2)}</p>
          <p className="text-xs text-mist/80">
            {out ? "Out of stock" : `${product.stock} in stock`}
          </p>
        </div>
      </Link>
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
    </article>
  );
}
