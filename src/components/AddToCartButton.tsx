"use client";

import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useEditMode } from "@/lib/edit-mode";
import { goToCart } from "@/lib/shop-nav";

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
  const { user, loading } = useEditMode();
  const router = useRouter();
  const needsWeight = Boolean(requireWeight && weight == null);

  function onBuy() {
    if (loading || needsWeight) return;
    if (!user) {
      const next = encodeURIComponent(
        typeof window !== "undefined" ? window.location.pathname : "/shop"
      );
      router.push(`/login?next=${next}`);
      return;
    }
    add(productId, 1, weight);
    goToCart();
  }

  return (
    <button
      type="button"
      disabled={disabled || loading || needsWeight}
      onClick={onBuy}
      className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {disabled
        ? "Sold out"
        : needsWeight
          ? "Select a weight"
          : user
            ? "Add to cart"
            : "Login to buy"}
    </button>
  );
}
