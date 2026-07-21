import { NextResponse } from "next/server";
import { getSession, requireAnyPermission } from "@/lib/auth";
import { listAllOrders, listOrdersForUser } from "@/lib/store";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all = new URL(req.url).searchParams.get("all") === "1";
  if (all) {
    const admin = await requireAnyPermission("view_orders", "manage_orders");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ orders: await listAllOrders() });
  }

  return NextResponse.json({ orders: await listOrdersForUser(session.userId) });
}
