import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import {
  assessShopifyReadiness,
  loadShopifyRuntimeConfig,
} from "@/lib/shopify";
import { storePersistStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  await loadShopifyRuntimeConfig();
  const assessed = await assessShopifyReadiness();
  const { status, public: pub, ping } = assessed;

  // Public: booleans only — never scopes, env names, Ops hints, or API errors.
  const staff = await requireAnyPermission(
    "manage_inventory",
    "manage_orders",
    "view_orders",
    "manage_users"
  );
  if (!staff) {
    return NextResponse.json(
      {
        ok: Boolean(pub.checkoutReady),
        shopify: {
          configured: pub.configured,
          checkoutReady: pub.checkoutReady,
          webhookConfigured: pub.webhookConfigured,
          apiReachable: pub.apiReachable,
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const persist = storePersistStatus();

  return NextResponse.json(
    {
      ok: Boolean(pub.checkoutReady),
      shopify: status,
      public: pub,
      adminApi: ping,
      persist: {
        durableWriteConfigured: persist.durableWriteConfigured,
        githubWriteConfigured: persist.githubWriteConfigured,
        lastPersistOk: persist.lastPersistOk,
      },
      checkoutFlow: [
        "Website owns catalog, prices, cart, and stock",
        "Cart items stay in the browser until the shopper pays or removes them",
        "POST /api/checkout creates a website order (awaiting_payment) without reducing stock; unpaid drafts stay out of Ops Orders",
        "Each Pay click rebuilds a Shopify Draft Order from LIVE website prices/discounts",
        "Shopify webhook / return confirm requires FULL payment, then the order appears in Ops and stock drops once",
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
        "AUTH_SECRET",
      ],
      important:
        ping?.canDraftOrders === false
          ? "Shopify app is missing write_draft_orders scope. Enable it in the app Admin API scopes, save, then refresh."
          : pub.reason === "not_configured"
            ? "Shopify is not connected — save Client ID + Secret below (or set Vercel env vars), then Refresh status."
            : pub.reason === "api_unreachable"
              ? `Shopify Admin API is not reachable${ping?.error ? `: ${ping.error}` : "."}`
              : pub.reason === "webhook_missing"
                ? "Checkout can open, but orders/paid webhook secret is missing — inventory will not auto-update after payment."
                : null,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
