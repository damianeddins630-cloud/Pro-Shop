import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import {
  createMembership,
  listMemberships,
  updateMembership,
} from "@/lib/store";
import {
  persistFailedResponse,
  requireDurablePersistOrLocal,
  withPersistMeta,
} from "@/lib/persist-guard";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, max-age=0" };

const schema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().min(1).max(120),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().max(40).optional(),
  name: z.string().min(1).max(160),
  membershipType: z.string().min(1).max(120),
  price: z.number().min(0),
  billingFrequency: z.enum(["monthly", "annual", "one_time"]),
  startDate: z.string().min(8).max(12),
  renewalDate: z.string().optional(),
  expirationDate: z.string().optional(),
  paymentStatus: z.enum(["unpaid", "pending", "paid", "refunded", "waived"]),
  status: z.enum([
    "active",
    "pending",
    "past_due",
    "paused",
    "cancelled",
    "expired",
  ]),
  notes: z.string().max(2000).optional(),
});

export async function GET() {
  const session = await requireAnyPermission(
    "manage_memberships",
    "manage_users",
    "view_finances",
    "view_dashboard"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const memberships = await listMemberships();
  return NextResponse.json({ memberships }, { headers: noStore });
}

export async function POST(req: Request) {
  const session = await requireAnyPermission(
    "manage_memberships",
    "manage_users"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const parsed = schema.parse(await req.json());
    const created = await createMembership(
      {
        ...parsed,
        customerEmail: parsed.customerEmail || undefined,
      },
      { actorId: session.userId, actorName: session.username }
    );
    if (!requireDurablePersistOrLocal()) {
      return persistFailedResponse("Create membership");
    }
    return NextResponse.json(withPersistMeta({ membership: created }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const session = await requireAnyPermission(
    "manage_memberships",
    "manage_users"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const updated = await updateMembership(id, body, {
    actorId: session.userId,
    actorName: session.username,
  });
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!requireDurablePersistOrLocal()) {
    return persistFailedResponse("Update membership");
  }
  return NextResponse.json(withPersistMeta({ membership: updated }));
}
