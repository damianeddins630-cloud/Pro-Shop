import { NextResponse } from "next/server";
import { getSession, requireAnyPermission } from "@/lib/auth";
import {
  findOrderById,
  getInventoryUpdatedAt,
  listProducts,
  markOrderPaid,
} from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

/**
 * Confirm a Shopify-paid order when the shopper returns to /order/success.
 * Idempotent backup if the Shopify webhook is delayed.
 */
export async function POST(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const order = await findOrderById(id);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = order.userId === session.userId;
  const isStaff = await requireAnyPermission("view_orders", "manage_orders");
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Only advance Shopify checkouts that were waiting on payment
    if (order.paymentProvider === "shopify" && order.status === "awaiting_payment") {
      const paid = await markOrderPaid(order.id, "processing");
      return NextResponse.json({
        ok: true,
        order: paid,
        products: await listProducts({ includeInactive: true }),
        updatedAt: await getInventoryUpdatedAt(),
      });
    }

    return NextResponse.json({
      ok: true,
      order,
      alreadySettled: true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Confirm failed" },
      { status: 400 }
    );
  }
}
