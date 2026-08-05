import type { OrderStatus } from "@/lib/types";

export type MemberOrderStatus = {
  key: "pending" | "balls_in" | "come_drill" | "completed" | "cancelled";
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

/**
 * Simple house flow:
 * Pending pay → Balls in → Come do drilling → Order complete
 */
export const OPS_PIPELINE: OpsPipelineStep[] = [
  {
    value: "awaiting_payment",
    label: "Pending payment",
    short: "Pay",
    help: "Not paid yet",
    tone: "pending",
  },
  {
    value: "placed",
    label: "Balls in",
    short: "In",
    help: "Balls / items are in — waiting for customer to come drill",
    tone: "processing",
  },
  {
    value: "processing",
    label: "Balls in",
    short: "In",
    help: "Balls / items are in — waiting for customer to come drill",
    tone: "processing",
  },
  {
    value: "ready",
    label: "Come do drilling",
    short: "Drill",
    help: "Customer needs to come in and do drilling",
    tone: "ready",
  },
  {
    value: "completed",
    label: "Order complete",
    short: "Done",
    help: "Drilling done / handed off — order complete",
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

/** Customer + Ops visual stepper (3 main steps after payment) */
export const CUSTOMER_PIPELINE: {
  key: "balls_in" | "come_drill" | "completed";
  label: string;
  short: string;
}[] = [
  { key: "balls_in", label: "Balls in", short: "In" },
  { key: "come_drill", label: "Come do drilling", short: "Drill" },
  { key: "completed", label: "Order complete", short: "Done" },
];

/** Active fulfillment steps for Ops filter strip */
export const ACTIVE_PIPELINE: OrderStatus[] = [
  "awaiting_payment",
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

/** One-tap advance: Pay → Balls in → Come do drilling → Order complete */
export function nextOpsStatus(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case "awaiting_payment":
      return "processing";
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
        label: "Pending payment",
        detail: "Payment has not been completed yet.",
        tone: "pending",
      };
    case "placed":
    case "processing":
      return {
        key: "balls_in",
        label: "Balls in",
        detail: "Your balls are in at Ballard's. Next: come in and do drilling.",
        tone: "processing",
      };
    case "ready":
      return {
        key: "come_drill",
        label: "Come do drilling",
        detail: "Come in to Ballard's and do your drilling. In-store only — no shipping.",
        tone: "ready",
      };
    case "completed":
      return {
        key: "completed",
        label: "Order complete",
        detail: "Order complete — drilled and picked up at the pro shop.",
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
      return "border-teal-400/50 text-teal-300 bg-teal-400/10";
    case "completed":
      return "border-emerald-400/50 text-emerald-300 bg-emerald-400/10";
    case "cancelled":
      return "border-white/20 text-mist bg-white/5";
  }
}

/** Index into CUSTOMER_PIPELINE for the stepper UI */
export function customerPipelineIndex(status: OrderStatus): number {
  switch (status) {
    case "awaiting_payment":
      return -1;
    case "placed":
    case "processing":
      return 0;
    case "ready":
      return 1;
    case "completed":
      return 2;
    default:
      return -1;
  }
}

export function pipelineStepIndex(status: OrderStatus) {
  return customerPipelineIndex(status);
}
