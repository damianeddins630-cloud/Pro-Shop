import { NextResponse } from "next/server";
import { getSession, requireAnyPermission } from "@/lib/auth";
import {
  listAllOrdersForOps,
  listOrdersForUser,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

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
    const orders = await listAllOrdersForOps();
    return NextResponse.json(
      {
        orders,
        orderCount: orders.length,
        fulfillment: "in_store",
        policy: "In-store only. No shipping. Come in for drilling and pickup.",
      },
      { headers: noStore }
    );
  }

  const orders = await listOrdersForUser(session.userId);
  return NextResponse.json(
    { orders, orderCount: orders.length, fulfillment: "in_store" },
    { headers: noStore }
  );
}
