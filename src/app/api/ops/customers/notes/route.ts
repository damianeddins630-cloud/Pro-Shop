import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import { addCustomerNote, listCustomerNotes } from "@/lib/store";
import {
  persistFailedResponse,
  requireDurablePersistOrLocal,
  withPersistMeta,
} from "@/lib/persist-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireAnyPermission(
    "manage_customers",
    "manage_users",
    "view_orders"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = new URL(req.url).searchParams.get("userId") || undefined;
  const notes = await listCustomerNotes(userId);
  return NextResponse.json(
    { notes },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(req: Request) {
  const session = await requireAnyPermission(
    "manage_customers",
    "manage_users"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const schema = z.object({
      userId: z.string().min(1),
      note: z.string().min(1).max(4000),
    });
    const parsed = schema.parse(await req.json());
    const created = await addCustomerNote(parsed, {
      actorId: session.userId,
      actorName: session.username,
    });
    if (!requireDurablePersistOrLocal()) {
      return persistFailedResponse("Add customer note");
    }
    return NextResponse.json(withPersistMeta({ note: created }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
