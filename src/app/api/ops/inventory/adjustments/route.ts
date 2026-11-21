import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { listStockAdjustments } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAnyPermission(
    "manage_inventory",
    "edit_pages",
    "view_finances"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adjustments = await listStockAdjustments(100);
  return NextResponse.json(
    { adjustments },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
