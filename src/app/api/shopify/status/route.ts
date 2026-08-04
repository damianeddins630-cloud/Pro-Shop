import { NextResponse } from "next/server";
import { pingShopifyAdmin, shopifyStatus } from "@/lib/shopify";
import { storePersistStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Public readiness check for Shopify checkout (no secrets returned).
 * Open: https://pro-shop-lemon.vercel.app/api/shopify/status
 */
export async function GET() {
  const status = shopifyStatus();
  const persist = storePersistStatus();
  const ping = status.configured ? await pingShopifyAdmin() : null;

  return NextResponse.json(
    {
      ok: status.configured && Boolean(ping?.ok),
      shopify: status,
      adminApi: ping,
      persist: {
        durableWriteConfigured: persist.durableWriteConfigured,
        githubWriteConfigured: persist.githubWriteConfigured,
        lastPersistOk: persist.lastPersistOk,
      },
      checkoutFlow: [
        "Customer carts products on this website",
        "POST /api/checkout creates a website order (awaiting_payment)",
        "Server creates a Shopify Draft Order (custom line items — not Shopify products)",
        "Customer is redirected to Shopify invoiceUrl to pay",
        "Shopify webhook orders/paid marks website order paid and reduces inventory",
      ],
      webhookUrl:
        (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
          "https://pro-shop-lemon.vercel.app") + "/api/shopify/webhook",
      requiredEnv: [
        "SHOPIFY_STORE_DOMAIN",
        "SHOPIFY_ADMIN_ACCESS_TOKEN",
        "SHOPIFY_API_VERSION",
        "SHOPIFY_WEBHOOK_SECRET",
        "NEXT_PUBLIC_SITE_URL",
        "AUTH_SECRET",
      ],
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
