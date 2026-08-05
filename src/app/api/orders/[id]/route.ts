import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { updateOrderStatus } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  status: z.enum([
    "awaiting_payment",
    "placed",
    "processing",
    "ready",
    "completed",
    "cancelled",
  ]),
});

export async function PUT(req: Request, { params }: Params) {
  const session = await requirePermission("manage_orders");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = schema.parse(await req.json());
    const order = await updateOrderStatus(id, body.status);
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ order });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 }
    );
  }
}
