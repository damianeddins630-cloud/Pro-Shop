import { NextResponse } from "next/server";
import { z } from "zod";
import { applyCouponToTotal, couponLabel } from "@/lib/coupons";
import { findCouponByCode } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().min(1),
  subtotal: z.coerce.number().min(0).default(0),
});

/** Public redeem/preview — validates a coupon for the cart */
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const coupon = await findCouponByCode(body.code);
    if (!coupon) {
      return NextResponse.json(
        { error: "Coupon not found or inactive" },
        { status: 404 }
      );
    }
    const { discountAmount, total } = applyCouponToTotal(body.subtotal, coupon);
    return NextResponse.json({
      ok: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        label: couponLabel(coupon),
      },
      subtotal: body.subtotal,
      discountAmount,
      total,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Redeem failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
