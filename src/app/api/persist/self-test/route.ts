import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { selfTestDurablePersist } from "@/lib/durable-store";
import { storePersistStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Ops-only: prove Redis/Blob can write + read business data. */
export async function POST() {
  const session = await requireAnyPermission(
    "manage_inventory",
    "manage_roles",
    "manage_users"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await selfTestDurablePersist();
  return NextResponse.json(
    {
      ok: result.ok,
      detail: result.detail,
      backends: result.backends,
      persist: storePersistStatus(),
      help: result.ok
        ? "Durable storage is working — Ops price/stock/coupon saves should stick for every visitor."
        : "Durable storage is NOT working. In Vercel → pro-shop-lemon → Settings → Environment Variables, set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (recommended), or BLOB_READ_WRITE_TOKEN + BBA_STORE_BLOB_URL, or GITHUB_TOKEN with repo write access. Redeploy after saving.",
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function GET() {
  return POST();
}
