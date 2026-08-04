import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import {
  findOrderById,
  findOrderByShopifyDraftId,
  markOrderPaid,
} from "@/lib/store";
import {
  draftOrderGidFromNumericId,
  loadShopifyRuntimeConfig,
  shopifyWebhookSecret,
} from "@/lib/shopify";

function webhookSecret() {
  return shopifyWebhookSecret();
}

function verifyShopifyHmac(rawBody: string, hmacHeader: string | null) {
  const secret = webhookSecret();
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

function looksPaid(topic: string, financialStatus: string) {
  if (topic === "orders/paid") return true;
  if (financialStatus === "paid" || financialStatus === "partially_paid") {
    return (
      !topic ||
      topic === "orders/updated" ||
      topic === "orders/create" ||
      topic === "orders/fulfilled"
    );
  }
  return false;
}

/**
 * Shopify webhook: after payment succeeds, apply website inventory + mark order paid.
 * Configure topic `orders/paid` → https://YOUR-DOMAIN/api/shopify/webhook
 */
export async function POST(req: Request) {
  await loadShopifyRuntimeConfig();
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const topic = (req.headers.get("x-shopify-topic") || "").toLowerCase();
  const secret = webhookSecret();

  // Production must verify signatures — never accept unsigned webhooks on Vercel.
  if (!secret) {
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "SHOPIFY_WEBHOOK_SECRET is not configured" },
        { status: 503 }
      );
    }
  } else if (!verifyShopifyHmac(rawBody, hmac)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as {
      id?: number | string;
      admin_graphql_api_id?: string;
      draft_order_id?: number | string | null;
      note?: string;
      note_attributes?: { name: string; value: string }[];
      tags?: string;
      financial_status?: string;
    };

    const financial = (payload.financial_status || "").toLowerCase();
    if (!looksPaid(topic, financial)) {
      return NextResponse.json({
        ok: true,
        matched: false,
        reason: "not_paid",
      });
    }

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

    if (!order && payload.draft_order_id) {
      const gid = draftOrderGidFromNumericId(payload.draft_order_id);
      if (gid) order = await findOrderByShopifyDraftId(gid);
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
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook failed" },
      { status: 400 }
    );
  }
}
