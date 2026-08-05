import { NextResponse } from "next/server";
import { isUsingFallbackAuthSecret } from "@/lib/auth";
import { listProducts, listUsers, storePersistStatus } from "@/lib/store";
import { loadShopifyRuntimeConfig, shopifyStatus } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [products, users] = await Promise.all([listProducts(), listUsers()]);
    const persist = storePersistStatus();
    await loadShopifyRuntimeConfig();
    const shopify = shopifyStatus();

    const backends = persist.backends || {};
    const anyBackendOk = Boolean(
      backends.redis?.ok || backends.blob?.ok || backends.github?.ok
    );
    let warning: string | null = null;
    if (!persist.durableWriteConfigured) {
      warning =
        "No durable storage configured — Ops price/stock/account saves will disappear. Add UPSTASH_REDIS_REST_URL + TOKEN (or BLOB / GITHUB_TOKEN) in Vercel.";
    } else if (!persist.lastPersistOk || !anyBackendOk) {
      warning = `Durable storage not verified yet (${persist.lastPersistDetail || "unknown"}). Make sure Pro_Shop Blob is connected to pro-shop-lemon with BLOB_READ_WRITE_TOKEN, redeploy, then Ops → Inventory → Save one item (or open /api/persist/self-test while logged in).`;
    } else if (!shopify.configured) {
      warning =
        "Shopify is not connected — open Ops → Shopify and click Save Connect / Refresh status.";
    } else if (!shopify.webhookConfigured) {
      warning =
        "Shopify webhook secret is missing — paid orders will not update website inventory until webhook setup is finished.";
    }

    return NextResponse.json({
      ok: true,
      vercel: Boolean(process.env.VERCEL),
      productCount: products.length,
      userCount: users.length,
      shopify,
      persist,
      auth: {
        customSecret: !isUsingFallbackAuthSecret(),
      },
      warning,
      time: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "health check failed",
      },
      { status: 500 }
    );
  }
}
