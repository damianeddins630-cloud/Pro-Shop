import { NextResponse } from "next/server";
import {
  getSession,
  requireAnyPermission,
  requirePermission,
} from "@/lib/auth";
import {
  clearAllOrders,
  listAllOrdersForOps,
  listOrdersForUser,
} from "@/lib/store";
import {
  persistFailedResponse,
  requireDurablePersistOrLocal,
  withPersistMeta,
} from "@/lib/persist-guard";

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
        policy: "In-store only. No shipping. Come in for drilling.",
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

async function clearOrdersHandler(req: Request) {
  const session = await requirePermission("manage_orders");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  let bodyAll = false;
  try {
    const body = await req.json();
    bodyAll = body?.all === true || body?.all === 1 || body?.all === "1";
  } catch {
    // no JSON body
  }
  const all = url.searchParams.get("all") === "1" || bodyAll;
  if (!all) {
    return NextResponse.json(
      { error: "Pass ?all=1 (or {\"all\":true}) to clear every order" },
      { status: 400 }
    );
  }
  const removed = await clearAllOrders();
  if (!requireDurablePersistOrLocal()) {
    return persistFailedResponse("Clear orders");
  }
  return NextResponse.json(
    withPersistMeta({
      ok: true,
      removed,
      orders: [],
      message: `Cleared ${removed} order${removed === 1 ? "" : "s"}.`,
    }),
    { headers: noStore }
  );
}

/** Clear every order (Ops reset). Does not change inventory. */
export async function DELETE(req: Request) {
  return clearOrdersHandler(req);
}

/** Same as DELETE — used when hosts block DELETE. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("clear") === "1") {
    return clearOrdersHandler(req);
  }
  return NextResponse.json(
    { error: "Use POST /api/orders?clear=1&all=1 to clear orders" },
    { status: 400 }
  );
}
