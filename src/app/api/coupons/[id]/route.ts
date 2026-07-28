import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import { deleteCoupon, updateCoupon } from "@/lib/store";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  code: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(["percent", "fixed", "free"]).optional(),
  value: z.coerce.number().min(0).optional(),
  active: z.boolean().optional(),
  maxUses: z.coerce.number().int().min(0).optional(),
  usedCount: z.coerce.number().int().min(0).optional(),
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
    const result = await updateCoupon(id, body);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { coupon: result.coupon, coupons: result.coupons },
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
    const result = await deleteCoupon(id);
    if (!result.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, removedCode: result.removedCode, coupons: result.coupons },
      { headers: noStore }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
