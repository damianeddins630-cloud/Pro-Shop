import type { OrderStatus } from "@/lib/types";

export type MemberOrderStatus = {
  key: "pending" | "processing" | "ready" | "completed" | "cancelled";
  label: string;
  detail: string;
  tone: "pending" | "processing" | "ready" | "completed" | "cancelled";
};

export type OpsPipelineStep = {
  value: OrderStatus;
  label: string;
  short: string;
  help: string;
  tone: MemberOrderStatus["tone"];
};

/** Full house / pro-shop fulfillment pipeline shown in Ops */
export const OPS_PIPELINE: OpsPipelineStep[] = [
  {
    value: "awaiting_payment",
    label: "Pending payment",
    short: "Pay",
    help: "Shopify invoice open — not paid yet",
    tone: "pending",
  },
  {
    value: "placed",
    label: "Received",
    short: "In",
    help: "Paid / received — queue for prep",
    tone: "processing",
  },
  {
    value: "processing",
    label: "In prep",
    short: "Prep",
    help: "Drilling, layout, or packing in progress",
    tone: "processing",
  },
  {
    value: "ready",
    label: "Ready",
    short: "Ready",
    help: "Ready for pickup or handoff",
    tone: "ready",
  },
  {
    value: "completed",
    label: "Completed",
    short: "Done",
    help: "Customer has the ball / item",
    tone: "completed",
  },
  {
    value: "cancelled",
    label: "Cancelled",
    short: "X",
    help: "Order cancelled",
    tone: "cancelled",
  },
];

/** Active fulfillment steps (excludes cancelled) */
export const ACTIVE_PIPELINE: OrderStatus[] = [
  "awaiting_payment",
  "placed",
  "processing",
  "ready",
  "completed",
];

export function opsStatusMeta(status: OrderStatus): OpsPipelineStep {
  return (
    OPS_PIPELINE.find((s) => s.value === status) ||
    OPS_PIPELINE[OPS_PIPELINE.length - 1]
  );
}

/** Suggested next status for one-tap advance in Ops */
export function nextOpsStatus(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case "awaiting_payment":
      return "placed";
    case "placed":
      return "processing";
    case "processing":
      return "ready";
    case "ready":
      return "completed";
    default:
      return null;
  }
}

/** Customer-facing order status wording */
export function memberOrderStatus(status: OrderStatus): MemberOrderStatus {
  switch (status) {
    case "awaiting_payment":
      return {
        key: "pending",
        label: "Pending",
        detail: "Payment has not been completed yet.",
        tone: "pending",
      };
    case "placed":
    case "processing":
      return {
        key: "processing",
        label: "Processing",
        detail: "Your order is being prepared — you don’t have it yet.",
        tone: "processing",
      };
    case "ready":
      return {
        key: "ready",
        label: "Ready",
        detail: "Ready for pickup / handoff at the pro shop.",
        tone: "ready",
      };
    case "completed":
      return {
        key: "completed",
        label: "Completed",
        detail: "You have your ball (or item).",
        tone: "completed",
      };
    case "cancelled":
    default:
      return {
        key: "cancelled",
        label: "Cancelled",
        detail: "This order was cancelled.",
        tone: "cancelled",
      };
  }
}

export function statusToneClass(tone: MemberOrderStatus["tone"]) {
  switch (tone) {
    case "pending":
      return "border-amber-400/50 text-amber-300 bg-amber-400/10";
    case "processing":
      return "border-sky-400/50 text-sky-300 bg-sky-400/10";
    case "ready":
      return "border-violet-400/50 text-violet-300 bg-violet-400/10";
    case "completed":
      return "border-emerald-400/50 text-emerald-300 bg-emerald-400/10";
    case "cancelled":
      return "border-white/20 text-mist bg-white/5";
  }
}

export function pipelineStepIndex(status: OrderStatus) {
  const idx = ACTIVE_PIPELINE.indexOf(status);
  return idx === -1 ? -1 : idx;
}
