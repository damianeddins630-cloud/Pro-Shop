import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import {
  createCoachingBooking,
  createCoachingPackage,
  deleteCoachingBooking,
  listCoaches,
  listCoachingBookings,
  listCoachingPackages,
  updateCoachingBooking,
  updateCoachingPackage,
} from "@/lib/store";
import {
  persistFailedResponse,
  requireDurablePersistOrLocal,
  withPersistMeta,
} from "@/lib/persist-guard";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, max-age=0" };

const bookingSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().min(1).max(120),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().max(40).optional(),
  coachId: z.string().min(1),
  coachName: z.string().min(1),
  serviceType: z.enum(["private", "group", "online", "package_session"]),
  title: z.string().min(1).max(160),
  date: z.string().min(8).max(12),
  startTime: z.string().min(4).max(8),
  endTime: z.string().min(4).max(8),
  price: z.number().min(0),
  paymentStatus: z.enum(["unpaid", "pending", "paid", "refunded", "waived"]),
  bookingStatus: z.enum(["scheduled", "completed", "cancelled", "no_show"]),
  attendance: z.enum(["pending", "present", "absent"]).optional(),
  packageId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

const packageSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().min(1).max(120),
  customerEmail: z.string().email().optional().or(z.literal("")),
  name: z.string().min(1).max(160),
  price: z.number().min(0),
  sessionsPurchased: z.number().int().min(1).max(500),
  sessionsUsed: z.number().int().min(0).max(500).optional(),
  expiresAt: z.string().optional(),
  paymentStatus: z.enum(["unpaid", "pending", "paid", "refunded", "waived"]),
  notes: z.string().max(2000).optional(),
});

export async function GET() {
  const session = await requireAnyPermission(
    "manage_coaches",
    "view_orders",
    "manage_orders",
    "view_dashboard"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [bookings, packages, coaches] = await Promise.all([
    listCoachingBookings(),
    listCoachingPackages(),
    listCoaches(),
  ]);
  return NextResponse.json(
    { bookings, packages, coaches },
    { headers: noStore }
  );
}

export async function POST(req: Request) {
  const session = await requireAnyPermission("manage_coaches");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const kind = body?.kind === "package" ? "package" : "booking";
  try {
    if (kind === "package") {
      const parsed = packageSchema.parse(body);
      const created = await createCoachingPackage(parsed, {
        actorId: session.userId,
        actorName: session.username,
      });
      if (!requireDurablePersistOrLocal()) {
        return persistFailedResponse("Create coaching package");
      }
      return NextResponse.json(withPersistMeta({ package: created }));
    }
    const parsed = bookingSchema.parse(body);
    if (parsed.startTime >= parsed.endTime) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }
    const created = await createCoachingBooking(
      {
        ...parsed,
        customerEmail: parsed.customerEmail || undefined,
      },
      { actorId: session.userId, actorName: session.username }
    );
    if (!requireDurablePersistOrLocal()) {
      return persistFailedResponse("Create coaching booking");
    }
    return NextResponse.json(withPersistMeta({ booking: created }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const session = await requireAnyPermission("manage_coaches");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  try {
    if (body?.kind === "package") {
      const updated = await updateCoachingPackage(id, body, {
        actorId: session.userId,
        actorName: session.username,
      });
      if (!updated) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (!requireDurablePersistOrLocal()) {
        return persistFailedResponse("Update coaching package");
      }
      return NextResponse.json(withPersistMeta({ package: updated }));
    }
    const updated = await updateCoachingBooking(id, body, {
      actorId: session.userId,
      actorName: session.username,
    });
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!requireDurablePersistOrLocal()) {
      return persistFailedResponse("Update coaching booking");
    }
    return NextResponse.json(withPersistMeta({ booking: updated }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await requireAnyPermission("manage_coaches");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const ok = await deleteCoachingBooking(id, {
    actorId: session.userId,
    actorName: session.username,
  });
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!requireDurablePersistOrLocal()) {
    return persistFailedResponse("Delete coaching booking");
  }
  return NextResponse.json(withPersistMeta({ ok: true }));
}
