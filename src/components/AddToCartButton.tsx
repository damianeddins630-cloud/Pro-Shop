"use client";

import { useCart } from "@/lib/cart";

export function AddToCartButton({
  productId,
  disabled,
}: {
  productId: string;
  disabled?: boolean;
}) {
  const { add } = useCart();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => add(productId)}
      className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {disabled ? "Sold out" : "Add to cart"}
    </button>
  );
}
