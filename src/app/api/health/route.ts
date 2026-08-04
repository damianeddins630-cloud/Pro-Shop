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

    let warning: string | null = null;
    if (!persist.durableWriteConfigured) {
      warning =
        "GITHUB_TOKEN (or Upstash/Blob) is not set — new accounts may disappear after deploy/restart. Add GITHUB_TOKEN in Vercel.";
    } else if (!persist.lastPersistOk) {
      warning =
        "Last save to durable storage failed. Check GITHUB_TOKEN / Redis / Blob credentials.";
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
