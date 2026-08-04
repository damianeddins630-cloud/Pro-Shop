import { NextResponse } from "next/server";
import { listProducts, listUsers, storePersistStatus } from "@/lib/store";
import { shopifyStatus } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [products, users] = await Promise.all([listProducts(), listUsers()]);
    const persist = storePersistStatus();
    return NextResponse.json({
      ok: true,
      vercel: Boolean(process.env.VERCEL),
      productCount: products.length,
      userCount: users.length,
      shopify: shopifyStatus(),
      persist,
      warning: persist.durableWriteConfigured
        ? null
        : "GITHUB_TOKEN (or Upstash/Blob) is not set — new accounts may disappear after deploy/restart. Add GITHUB_TOKEN in Vercel.",
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
