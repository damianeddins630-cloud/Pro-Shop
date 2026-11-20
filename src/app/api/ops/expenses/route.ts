import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import { createExpense, deleteExpense, listExpenses } from "@/lib/store";
import {
  persistFailedResponse,
  requireDurablePersistOrLocal,
  withPersistMeta,
} from "@/lib/persist-guard";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, max-age=0" };

const schema = z.object({
  category: z.enum([
    "inventory",
    "coaching",
    "website",
    "marketing",
    "payment_fees",
    "operating",
    "other",
  ]),
  label: z.string().min(1).max(200),
  amount: z.number().min(0),
  date: z.string().min(8).max(12),
  notes: z.string().max(2000).optional(),
});

export async function GET() {
  const session = await requireAnyPermission(
    "view_finances",
    "manage_finances",
    "manage_orders",
    "view_dashboard"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expenses = await listExpenses();
  return NextResponse.json({ expenses }, { headers: noStore });
}

export async function POST(req: Request) {
  const session = await requireAnyPermission("manage_finances", "manage_orders");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const parsed = schema.parse(await req.json());
    const created = await createExpense(parsed, {
      actorId: session.userId,
      actorName: session.username,
    });
    if (!requireDurablePersistOrLocal()) {
      return persistFailedResponse("Create expense");
    }
    return NextResponse.json(withPersistMeta({ expense: created }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await requireAnyPermission("manage_finances");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const ok = await deleteExpense(id, {
    actorId: session.userId,
    actorName: session.username,
  });
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!requireDurablePersistOrLocal()) {
    return persistFailedResponse("Delete expense");
  }
  return NextResponse.json(withPersistMeta({ ok: true }));
}
