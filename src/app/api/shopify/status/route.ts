import { NextResponse } from "next/server";
import {
  loadShopifyRuntimeConfig,
  pingShopifyAdmin,
  shopifyStatus,
} from "@/lib/shopify";
import { storePersistStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  await loadShopifyRuntimeConfig();
  const status = shopifyStatus();
  const persist = storePersistStatus();
  const ping = status.configured ? await pingShopifyAdmin() : null;

  const draftReady =
    Boolean(ping?.ok) &&
    (ping?.canDraftOrders === true || ping?.canDraftOrders === undefined);

  return NextResponse.json(
    {
      ok: status.configured && Boolean(ping?.ok) && draftReady,
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
        "SHOPIFY_CLIENT_ID",
        "SHOPIFY_CLIENT_SECRET",
        "SHOPIFY_WEBHOOK_SECRET",
        "SHOPIFY_API_VERSION",
        "NEXT_PUBLIC_SITE_URL",
      ],
      important:
        ping?.canDraftOrders === false
          ? "Shopify app is missing write_draft_orders scope. Enable it in the app Admin API scopes, save, then refresh."
          : null,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
