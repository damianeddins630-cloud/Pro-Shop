/** Browser-only marker so cart survives Shopify redirect until pay/remove. */

export const PENDING_CHECKOUT_KEY = "bba_pending_checkout_v1";

export type PendingCheckout = {
  orderId: string;
  productIds: string[];
  checkoutUrl?: string;
  createdAt: string;
};

export function savePendingCheckout(pending: PendingCheckout) {
  try {
    sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(pending));
  } catch {
    // ignore quota / private mode
  }
}

export function readPendingCheckout(): PendingCheckout | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingCheckout;
    if (!parsed?.orderId || !Array.isArray(parsed.productIds)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingCheckout() {
  try {
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
  } catch {
    // ignore
  }
}
