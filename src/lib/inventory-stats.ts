import type { Order, OrderStatus, Product } from "./types";
import {
  formatWeightLbs,
  productRequiresWeight,
  totalFromWeightStock,
  weightKey,
} from "./weights";

export type WeightBucket = {
  weight: number;
  label: string;
  stock: number;
  skus: number;
};

export type BallInventorySummary = {
  /** Products that use weight options (balls) */
  ballSkus: number;
  /** Sum of all ball units in stock */
  totalBalls: number;
  /** Non-ball / accessory units */
  accessoryUnits: number;
  /** All catalog units */
  totalUnits: number;
  byWeight: WeightBucket[];
};

export function summarizeBallInventory(products: Product[]): BallInventorySummary {
  const byWeight = new Map<number, { stock: number; skus: number }>();
  let totalBalls = 0;
  let accessoryUnits = 0;
  let ballSkus = 0;

  for (const p of products) {
    if (!p.active) continue;
    if (productRequiresWeight(p)) {
      ballSkus += 1;
      const options = p.weightOptions || [];
      const hasMap = p.weightStock && Object.keys(p.weightStock).length > 0;
      if (hasMap) {
        for (const w of options) {
          const qty = Math.max(0, Math.floor(Number(p.weightStock?.[weightKey(w)]) || 0));
          const cur = byWeight.get(w) || { stock: 0, skus: 0 };
          cur.stock += qty;
          if (qty > 0) cur.skus += 1;
          byWeight.set(w, cur);
          totalBalls += qty;
        }
      } else {
        // Legacy: one stock pool across listed weights — count once toward total.
        const qty = Math.max(0, Math.floor(Number(p.stock) || 0));
        totalBalls += qty;
        for (const w of options) {
          const cur = byWeight.get(w) || { stock: 0, skus: 0 };
          // Show availability presence, not double-count units across weights.
          if (qty > 0) cur.skus += 1;
          byWeight.set(w, cur);
        }
      }
    } else {
      accessoryUnits += Math.max(0, Math.floor(Number(p.stock) || 0));
    }
  }

  const weights = [...byWeight.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weight, v]) => ({
      weight,
      label: formatWeightLbs(weight),
      stock: v.stock,
      skus: v.skus,
    }));

  return {
    ballSkus,
    totalBalls,
    accessoryUnits,
    totalUnits: totalBalls + accessoryUnits,
    byWeight: weights,
  };
}

export type PipelineCounts = Record<OrderStatus | "all" | "active", number>;

export function countOrdersByStatus(orders: Order[]): PipelineCounts {
  const counts: PipelineCounts = {
    all: orders.length,
    active: 0,
    awaiting_payment: 0,
    placed: 0,
    processing: 0,
    ready: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const o of orders) {
    counts[o.status] = (counts[o.status] || 0) + 1;
    if (
      o.status === "awaiting_payment" ||
      o.status === "placed" ||
      o.status === "processing" ||
      o.status === "ready"
    ) {
      counts.active += 1;
    }
  }
  return counts;
}

export function orderRevenue(orders: Order[]) {
  return orders
    .filter((o) => o.status !== "cancelled" && o.status !== "awaiting_payment")
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
}

export function syncProductStockTotal(product: Product): number {
  if (product.weightStock && Object.keys(product.weightStock).length) {
    return totalFromWeightStock(product.weightStock);
  }
  return Math.max(0, Math.floor(Number(product.stock) || 0));
}
