import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { listActivityLog } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireAnyPermission(
    "manage_roles",
    "manage_users",
    "manage_settings",
    "view_dashboard"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Math.min(
    200,
    Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 80)
  );
  const entries = await listActivityLog(limit);
  return NextResponse.json(
    { entries },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
