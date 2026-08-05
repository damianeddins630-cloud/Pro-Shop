import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, requireAnyPermission, requirePermission } from "@/lib/auth";
import {
  findOrderById,
  findUserById,
  updateOrderFulfillment,
} from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

const noStore = { "Cache-Control": "no-store, max-age=0" };

const schema = z.object({
  status: z
    .enum([
      "awaiting_payment",
      "placed",
      "processing",
      "ready",
      "completed",
      "cancelled",
    ])
    .optional(),
  drillingNotes: z.string().max(4000).optional(),
  customerNotified: z.boolean().optional(),
  markHandedOff: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: Params) {
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
  const staff = await requireAnyPermission("view_orders", "manage_orders");
  if (!isOwner && !staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let phoneNumber = order.phoneNumber;
  if (!phoneNumber) {
    const user = await findUserById(order.userId);
    phoneNumber = user?.phoneNumber || undefined;
  }

  return NextResponse.json(
    {
      order: {
        ...order,
        phoneNumber,
        fulfillment: "in_store" as const,
      },
      policy: "In-store only. No shipping. Come in for drilling.",
    },
    { headers: noStore }
  );
}

export async function PUT(req: Request, { params }: Params) {
  const session = await requirePermission("manage_orders");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = schema.parse(await req.json());
    const order = await updateOrderFulfillment(id, body);
    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ order }, { headers: noStore });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 }
    );
  }
}
