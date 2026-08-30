import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { deleteSubscriber, listSubscribers } from "@/lib/store";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const session = await requireAnyPermission(
    "manage_subscribers",
    "edit_pages",
    "manage_users"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const subscribers = await listSubscribers();
  return NextResponse.json(
    { subscribers, count: subscribers.length },
    { headers: noStore }
  );
}

export async function DELETE(req: Request) {
  const session = await requireAnyPermission(
    "manage_subscribers",
    "edit_pages",
    "manage_users"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const ok = await deleteSubscriber(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
