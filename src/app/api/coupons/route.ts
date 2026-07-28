import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import { createCoupon, listCoupons } from "@/lib/store";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const session = await requireAnyPermission(
    "manage_deals",
    "manage_inventory",
    "edit_pages",
    "manage_roles"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    { coupons: await listCoupons() },
    { headers: noStore }
  );
}

const createSchema = z.object({
  code: z.string().min(1),
  description: z.string().default(""),
  type: z.enum(["percent", "fixed", "free"]),
  value: z.coerce.number().min(0).default(0),
  active: z.boolean().optional(),
  /** 0 = unlimited */
  maxUses: z.coerce.number().int().min(0).default(0),
});

export async function POST(req: Request) {
  const session = await requireAnyPermission(
    "manage_deals",
    "manage_inventory",
    "edit_pages"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = createSchema.parse(await req.json());
    const result = await createCoupon({
      code: body.code,
      description: body.description,
      type: body.type,
      value: body.type === "free" ? 100 : body.value,
      active: body.active ?? true,
      maxUses: body.maxUses,
    });
    return NextResponse.json(
      { coupon: result.coupon, coupons: result.coupons },
      { status: 201, headers: noStore }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
