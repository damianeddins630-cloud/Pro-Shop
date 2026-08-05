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
    const coldUnverified =
      !persist.lastPersistOk &&
      String(persist.lastPersistDetail || "").includes(
        "No durable save verified"
      );
    let warning: string | null = null;
    if (!persist.durableWriteConfigured) {
      warning =
        "No durable storage configured — Ops price/stock/account saves will disappear. Add UPSTASH_REDIS_REST_URL + TOKEN (or BLOB / GITHUB_TOKEN) in Vercel.";
    } else if (!persist.lastPersistOk && !coldUnverified && !anyBackendOk) {
      // Real write/load failure — not a fresh-instance "not verified yet" false alarm.
      warning = `Durable storage failed (${persist.lastPersistDetail || "unknown"}). Confirm Production env vars BLOB_READ_WRITE_TOKEN + BLOB_STORE_ID on pro-shop-lemon, redeploy, then run /api/persist/self-test while logged into Ops. Redis and GITHUB_TOKEN are optional when Blob works.`;
    } else if (!persist.lastPersistOk && !anyBackendOk && coldUnverified) {
      warning = `Durable storage configured but not confirmed on this instance yet (${persist.lastPersistDetail || "unknown"}). Open Ops → Inventory (loads Blob) or run /api/persist/self-test while logged in. Redis/GitHub are optional backups when Blob is working.`;
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
