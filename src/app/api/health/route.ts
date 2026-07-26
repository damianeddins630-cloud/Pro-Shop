import { NextResponse } from "next/server";
import { listProducts } from "@/lib/store";
import { shopifyStatus } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await listProducts();
    return NextResponse.json({
      ok: true,
      vercel: Boolean(process.env.VERCEL),
      productCount: products.length,
      shopify: shopifyStatus(),
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
