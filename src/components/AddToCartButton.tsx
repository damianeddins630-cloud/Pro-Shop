"use client";

import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useEditMode } from "@/lib/edit-mode";

export function AddToCartButton({
  productId,
  disabled,
}: {
  productId: string;
  disabled?: boolean;
}) {
  const { add } = useCart();
  const { user, loading } = useEditMode();
  const router = useRouter();

  function onBuy() {
    if (loading) return;
    if (!user) {
      const next = encodeURIComponent(
        typeof window !== "undefined" ? window.location.pathname : "/shop"
      );
      router.push(`/login?next=${next}`);
      return;
    }
    add(productId);
  }

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onBuy}
      className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {disabled ? "Sold out" : user ? "Add to cart" : "Login to buy"}
    </button>
  );
}
