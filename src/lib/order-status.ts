import type { OrderStatus } from "@/lib/types";

export type MemberOrderStatus = {
  key: "pending" | "processing" | "completed" | "cancelled";
  label: string;
  detail: string;
  tone: "pending" | "processing" | "completed" | "cancelled";
};

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
        detail: "Order is being prepared — you don’t have it yet.",
        tone: "processing",
      };
    case "completed":
      return {
        key: "completed",
        label: "Completed",
        detail: "Ready / you have your ball (or item).",
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
    case "completed":
      return "border-emerald-400/50 text-emerald-300 bg-emerald-400/10";
    case "cancelled":
      return "border-white/20 text-mist bg-white/5";
  }
}
