import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import {
  cancelRefundRequest,
  confirmRefundCompleted,
  createRefundRequest,
  findOrderById,
  listRefunds,
} from "@/lib/store";
import { autoBackupBusinessRecords } from "@/lib/google-sheets";
import {
  persistFailedResponse,
  requireDurablePersistOrLocal,
  withPersistMeta,
} from "@/lib/persist-guard";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const session = await requireAnyPermission("manage_orders", "view_orders");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const refunds = await listRefunds(100);
  return NextResponse.json({ refunds }, { headers: noStore });
}

export async function POST(req: Request) {
  const session = await requireAnyPermission("manage_orders");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "request");

  try {
    if (action === "request") {
      const schema = z.object({
        orderId: z.string().min(1),
        amount: z.number().positive(),
        reason: z.string().min(1).max(500),
        restoreInventory: z.boolean().optional(),
        notes: z.string().max(2000).optional(),
      });
      const parsed = schema.parse(body);
      const order = await findOrderById(parsed.orderId);
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      const created = await createRefundRequest(
        {
          ...parsed,
          provider: order.paymentProvider === "shopify" ? "shopify" : "local",
        },
        { actorId: session.userId, actorName: session.username }
      );
      if (!requireDurablePersistOrLocal()) {
        return persistFailedResponse("Create refund");
      }
      void autoBackupBusinessRecords({
        actorName: session.username,
        reason: "Refund requested",
      });
      return NextResponse.json(
        withPersistMeta({
          refund: created,
          message:
            "Refund requested as pending. It will not count as completed until you confirm the payment provider refunded the customer.",
        })
      );
    }

    if (action === "confirm") {
      const schema = z.object({
        refundId: z.string().min(1),
        attestedProviderConfirmed: z.literal(true),
        restoreInventory: z.boolean().optional(),
        providerRefundId: z.string().max(200).optional(),
      });
      const parsed = schema.parse(body);
      const updated = await confirmRefundCompleted(parsed.refundId, {
        actorId: session.userId,
        actorName: session.username,
        attestedProviderConfirmed: true,
        restoreInventory: parsed.restoreInventory,
        providerRefundId: parsed.providerRefundId,
      });
      if (!requireDurablePersistOrLocal()) {
        return persistFailedResponse("Confirm refund");
      }
      void autoBackupBusinessRecords({
        actorName: session.username,
        reason: "Refund completed",
      });
      return NextResponse.json(
        withPersistMeta({
          refund: updated,
          message:
            "Refund marked completed after provider-confirmation attestation.",
        })
      );
    }

    if (action === "cancel") {
      const refundId = String(body?.refundId || "");
      if (!refundId) {
        return NextResponse.json({ error: "Missing refundId" }, { status: 400 });
      }
      const updated = await cancelRefundRequest(refundId, {
        actorId: session.userId,
        actorName: session.username,
      });
      if (!updated) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (!requireDurablePersistOrLocal()) {
        return persistFailedResponse("Cancel refund");
      }
      return NextResponse.json(withPersistMeta({ refund: updated }));
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Refund failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
