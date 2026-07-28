import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyCouponToTotal,
  couponLabel,
  couponUsesLabel,
} from "@/lib/coupons";
import {
  findCouponByCode,
  getCouponRedeemBlockReason,
} from "@/lib/store";

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
      const reason =
        (await getCouponRedeemBlockReason(body.code)) ||
        "Coupon not found or inactive";
      return NextResponse.json({ error: reason }, { status: 404 });
    }
    const { discountAmount, total } = applyCouponToTotal(body.subtotal, coupon);
    return NextResponse.json({
      ok: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        label: couponLabel(coupon),
        usesLabel: couponUsesLabel(coupon),
        maxUses: coupon.maxUses,
        usedCount: coupon.usedCount,
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
