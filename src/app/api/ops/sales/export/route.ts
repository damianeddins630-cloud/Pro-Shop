import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { isPurchasedOrder } from "@/lib/order-status";
import { listAllOrdersForOps } from "@/lib/store";

export const dynamic = "force-dynamic";

function csvEscape(v: string | number | undefined | null) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const session = await requireAnyPermission("view_orders", "manage_orders");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const fromMs = from ? new Date(from).getTime() : null;
  const toMs = to ? new Date(to).getTime() : null;

  const orders = (await listAllOrdersForOps()).filter(isPurchasedOrder).filter(
    (o) => {
      const t = new Date(o.createdAt).getTime();
      if (fromMs != null && Number.isFinite(fromMs) && t < fromMs) return false;
      if (toMs != null && Number.isFinite(toMs) && t > toMs) return false;
      return true;
    }
  );

  const header = [
    "order_id",
    "created_at",
    "customer",
    "email",
    "phone",
    "status",
    "payment_provider",
    "subtotal",
    "discount",
    "tax",
    "total",
    "refund_amount",
    "coupon",
    "items",
  ];

  const lines = [header.join(",")];
  for (const o of orders) {
    lines.push(
      [
        csvEscape(o.id),
        csvEscape(o.createdAt),
        csvEscape(o.username),
        csvEscape(o.email),
        csvEscape(o.phoneNumber || ""),
        csvEscape(o.status),
        csvEscape(o.paymentProvider || o.paymentMethod || ""),
        csvEscape(o.subtotal ?? ""),
        csvEscape(o.discountAmount ?? ""),
        csvEscape(o.taxAmount ?? ""),
        csvEscape(o.total),
        csvEscape(o.refundAmount ?? 0),
        csvEscape(o.couponCode || ""),
        csvEscape(
          (o.items || [])
            .map(
              (i) =>
                `${i.quantity}x ${i.name}${i.weight ? ` (${i.weight}lb)` : ""}`
            )
            .join("; ")
        ),
      ].join(",")
    );
  }

  const body = lines.join("\n");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ballards-sales-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
