import type { Coupon } from "@/lib/types";

/** Owner / City View Lanes free order code */
export const OWNER_FREE_COUPON_CODE = "cityviewlanes.com";

export function normalizeCouponCode(code: string) {
  return code
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export function codesMatch(a: string, b: string) {
  return normalizeCouponCode(a) === normalizeCouponCode(b);
}

export function applyCouponToTotal(subtotal: number, coupon: Coupon) {
  const safeSub = Math.max(0, Number(subtotal) || 0);
  if (!coupon.active) {
    return { discountAmount: 0, total: safeSub };
  }

  if (coupon.type === "free" || codesMatch(coupon.code, OWNER_FREE_COUPON_CODE)) {
    return { discountAmount: safeSub, total: 0 };
  }

  if (coupon.type === "percent") {
    const pct = Math.min(100, Math.max(0, Number(coupon.value) || 0));
    const discountAmount = Math.round(safeSub * (pct / 100) * 100) / 100;
    return {
      discountAmount,
      total: Math.max(0, Math.round((safeSub - discountAmount) * 100) / 100),
    };
  }

  // fixed
  const discountAmount = Math.min(
    safeSub,
    Math.max(0, Number(coupon.value) || 0)
  );
  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    total: Math.max(0, Math.round((safeSub - discountAmount) * 100) / 100),
  };
}

export function couponLabel(coupon: Coupon) {
  if (coupon.type === "free" || codesMatch(coupon.code, OWNER_FREE_COUPON_CODE)) {
    return "Free order (100% off)";
  }
  if (coupon.type === "percent") return `${coupon.value}% off`;
  return `$${Number(coupon.value).toFixed(2)} off`;
}
