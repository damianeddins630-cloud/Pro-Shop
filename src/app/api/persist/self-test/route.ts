import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import {
  markPersistResult,
  selfTestDurablePersist,
} from "@/lib/durable-store";
import {
  markDurablePersistVerified,
  storePersistStatus,
  verifyDurablePersistWithLiveStore,
} from "@/lib/store";

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
  markPersistResult(result.backends);

  let catalogSaved = false;
  if (result.ok) {
    // Write the real catalog into Blob so price/stock saves are live immediately.
    const seeded = await verifyDurablePersistWithLiveStore();
    catalogSaved = seeded.ok;
    if (seeded.ok) {
      markDurablePersistVerified(result.detail);
    }
  }

  const persist = storePersistStatus();
  return NextResponse.json(
    {
      ok: result.ok,
      detail: result.detail,
      backends: result.backends,
      catalogSaved,
      persist,
      help: result.ok
        ? catalogSaved
          ? "SUCCESS — Blob storage is working and the live catalog was saved. Ops price/stock/coupon changes will stick. Shopify will charge the latest website prices."
          : "Blob probe worked. Now open Ops → Inventory and Save any product once to finish verifying the full catalog write."
        : "Durable storage is NOT working. Connect Public Blob store Pro_shop_2026 to pro-shop-lemon, confirm Production env vars BLOB_READ_WRITE_TOKEN and BLOB_STORE_ID, Redeploy, then run this self-test again while logged into Ops.",
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function GET() {
  return POST();
}
