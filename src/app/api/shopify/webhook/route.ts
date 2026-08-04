import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import {
  findOrderById,
  findOrderByShopifyDraftId,
  getInventoryUpdatedAt,
  listProducts,
  markOrderPaid,
} from "@/lib/store";

function verifyShopifyHmac(rawBody: string, hmacHeader: string | null) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();
  if (!secret || !hmacHeader) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    const a = Buffer.from(digest);
    const b = Buffer.from(hmacHeader);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Shopify webhook: after payment succeeds, apply website inventory + mark order paid.
 * Configure topic `orders/paid` → https://YOUR-DOMAIN/api/shopify/webhook
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();

  // If a webhook secret is configured, require a valid signature.
  // If not configured yet, still accept (so first connect is easier) but prefer setting one.
  if (secret && !verifyShopifyHmac(rawBody, hmac)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as {
      id?: number | string;
      admin_graphql_api_id?: string;
      note?: string;
      note_attributes?: { name: string; value: string }[];
      tags?: string;
      financial_status?: string;
    };

    const fromNote =
      payload.note_attributes?.find((a) => a.name === "website_order_id")?.value ||
      payload.note?.match(/Ballard's website order ([a-f0-9-]+)/i)?.[1];

    const fromTags = payload.tags
      ?.split(",")
      .map((t) => t.trim())
      .find((t) => t.startsWith("bba:"))
      ?.replace(/^bba:/, "");

    const localId = fromNote || fromTags;
    let order = localId ? await findOrderById(localId) : null;

    if (!order && payload.admin_graphql_api_id) {
      order = await findOrderByShopifyDraftId(payload.admin_graphql_api_id);
    }

    if (!order) {
      return NextResponse.json({ ok: true, matched: false });
    }

    const paid = await markOrderPaid(order.id, "processing");
    return NextResponse.json({
      ok: true,
      matched: true,
      orderId: order.id,
      status: paid?.status,
      inventoryApplied: paid?.inventoryApplied,
      products: await listProducts({ includeInactive: true }),
      updatedAt: await getInventoryUpdatedAt(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook failed" },
      { status: 400 }
    );
  }
}
