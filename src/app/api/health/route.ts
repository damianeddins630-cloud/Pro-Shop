import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { isUsingFallbackAuthSecret } from "@/lib/auth";
import { listProducts, listUsers, storePersistStatus } from "@/lib/store";
import { loadShopifyRuntimeConfig, assessShopifyReadiness } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function GET() {
  // Public: minimal liveness only
  const session = await requireAnyPermission(
    "manage_inventory",
    "manage_users",
    "manage_roles",
    "view_orders",
    "manage_orders"
  );
  if (!session) {
    return NextResponse.json({ ok: true, time: new Date().toISOString() });
  }

  try {
    const [products, users] = await Promise.all([listProducts(), listUsers()]);
    const persist = storePersistStatus();
    await loadShopifyRuntimeConfig();
    const assessed = await assessShopifyReadiness();
    const shopify = assessed.status;

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
      warning = `Durable storage failed (${persist.lastPersistDetail || "unknown"}). Confirm Production env vars BLOB_READ_WRITE_TOKEN + BLOB_STORE_ID on pro-shop-lemon, redeploy, then run /api/persist/self-test while logged into Ops. Redis and GITHUB_TOKEN are optional when Blob works.`;
    } else if (!persist.lastPersistOk && !anyBackendOk && coldUnverified) {
      warning = `Durable storage configured but not confirmed on this instance yet (${persist.lastPersistDetail || "unknown"}). Open Ops → Inventory (loads Blob) or run /api/persist/self-test while logged in. Redis/GitHub are optional backups when Blob is working.`;
    } else if (!shopify.configured) {
      warning =
        "Shopify is not connected — open Ops → Shopify and click Save Connect / Refresh status.";
    } else if (!assessed.public.checkoutReady) {
      warning =
        assessed.public.reason === "missing_draft_orders_scope"
          ? "Shopify is connected but missing write_draft_orders — enable Draft Orders on the app scopes."
          : "Shopify is connected but Admin API checkout is not ready — open Ops → Shopify and Refresh status.";
    } else if (!shopify.webhookConfigured) {
      warning =
        "Shopify checkout can open, but the webhook secret is missing — paid orders will not update website inventory until webhook setup is finished.";
    } else if (isUsingFallbackAuthSecret()) {
      warning =
        "AUTH_SECRET is not set in Vercel — login works with the built-in fallback. Set a long random AUTH_SECRET in Production and redeploy.";
    }

    return NextResponse.json({
      ok: true,
      vercel: Boolean(process.env.VERCEL),
      productCount: products.length,
      userCount: users.length,
      shopify: {
        ...shopify,
        apiReachable: assessed.public.apiReachable,
        readinessReason: assessed.public.reason,
      },
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
