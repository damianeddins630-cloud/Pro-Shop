import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import { deleteCoupon, listCoupons, updateCoupon } from "@/lib/store";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  code: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(["percent", "fixed", "free"]).optional(),
  value: z.coerce.number().min(0).optional(),
  active: z.coerce.boolean().optional(),
});

export async function PUT(req: Request, { params }: Params) {
  const session = await requireAnyPermission(
    "manage_deals",
    "manage_inventory",
    "edit_pages"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = patchSchema.parse(await req.json());
    const coupon = await updateCoupon(id, body);
    if (!coupon) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { coupon, coupons: await listCoupons() },
      { headers: noStore }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAnyPermission(
    "manage_deals",
    "manage_inventory",
    "edit_pages"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const ok = await deleteCoupon(id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, coupons: await listCoupons() },
      { headers: noStore }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
