"use client";

import { useCart } from "@/lib/cart";

export function AddToCartButton({
  productId,
  disabled,
  weight,
  requireWeight,
}: {
  productId: string;
  disabled?: boolean;
  weight?: number;
  /** When true, a weight must be selected before add-to-cart */
  requireWeight?: boolean;
}) {
  const { add } = useCart();
  const needsWeight = Boolean(requireWeight && weight == null);

  if (disabled || needsWeight) {
    return (
      <button
        type="button"
        disabled
        className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        {disabled ? "Sold out" : "Select a weight"}
      </button>
    );
  }

  return (
    <a
      href="/cart"
      className="btn btn-primary"
      onClick={() => {
        add(productId, 1, weight);
      }}
    >
      Add to cart
    </a>
  );
}
