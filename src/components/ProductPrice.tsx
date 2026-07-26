"use client";

import { effectivePrice, formatMoney, hasDiscount } from "@/lib/pricing";
import type { Product } from "@/lib/types";

export function ProductPrice({
  product,
  className = "",
  size = "md",
}: {
  product: Pick<Product, "price" | "discountPercent">;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sale = effectivePrice(product);
  const onSale = hasDiscount(product);
  const saleClass =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";
  const wasClass =
    size === "lg" ? "text-base" : size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className={`flex flex-wrap items-baseline gap-2 ${className}`}>
      <span className={`${saleClass} font-semibold text-chalk`}>
        {formatMoney(sale)}
      </span>
      {onSale && (
        <>
          <span className={`${wasClass} text-mist line-through`}>
            {formatMoney(product.price)}
          </span>
          <span className="rounded-full bg-red/20 px-2 py-0.5 text-xs font-bold text-red">
            {Math.round(product.discountPercent || 0)}% off
          </span>
        </>
      )}
      {!onSale && sale === 0 && (
        <span className="text-xs font-bold text-red">FREE</span>
      )}
    </div>
  );
}
