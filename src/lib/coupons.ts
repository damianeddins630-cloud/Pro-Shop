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

/** 0 or missing maxUses = unlimited */
export function couponMaxUses(coupon: Pick<Coupon, "maxUses"> | { maxUses?: number }) {
  const n = Number(coupon.maxUses);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export function couponUsedCount(coupon: Pick<Coupon, "usedCount"> | { usedCount?: number }) {
  const n = Number(coupon.usedCount);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function couponHasUsesLeft(coupon: Coupon) {
  const max = couponMaxUses(coupon);
  if (max <= 0) return true;
  return couponUsedCount(coupon) < max;
}

export function couponUsesLabel(coupon: Coupon) {
  const max = couponMaxUses(coupon);
  const used = couponUsedCount(coupon);
  if (max <= 0) return `${used} used · unlimited`;
  const left = Math.max(0, max - used);
  return `${used} / ${max} used · ${left} left`;
}
