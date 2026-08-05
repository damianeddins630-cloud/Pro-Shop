import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { applyCouponToTotal } from "@/lib/coupons";
import {
  cancelOpenShopifyCheckoutsForUser,
  findOrderById,
  getFreshCouponForCheckout,
  getFreshProductForCheckout,
  updateOrder,
} from "@/lib/store";
import {
  createShopifyCheckout,
  deleteShopifyDraftOrder,
  isShopifyConfigured,
  loadShopifyRuntimeConfig,
} from "@/lib/shopify";
import { effectivePrice } from "@/lib/pricing";
import type { OrderItem } from "@/lib/types";
import {
  isAllowedWeight,
  lineDisplayName,
  productRequiresWeight,
  stockForWeight,
} from "@/lib/weights";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Rebuild a Shopify payment link using the LIVE website prices/discounts.
 * Used when the shopper resumes an unpaid order after Ops changed prices.
 */
export async function POST(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const order = await findOrderById(id);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.userId !== session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (order.status !== "awaiting_payment" && order.status !== "cancelled") {
    return NextResponse.json(
      { error: "Order is not awaiting payment", order },
      { status: 409 }
    );
  }
  if (order.inventoryApplied) {
    return NextResponse.json(
      { error: "Order already settled", order },
      { status: 409 }
    );
  }

  await loadShopifyRuntimeConfig();
  if (!isShopifyConfigured()) {
    return NextResponse.json(
      { error: "Shopify is not connected" },
      { status: 503 }
    );
  }

  const lineItems: OrderItem[] = [];
  let subtotal = 0;
  for (const item of order.items) {
    const product = await getFreshProductForCheckout(item.productId);
    if (!product || !product.active) {
      return NextResponse.json(
        {
          error: `Product unavailable: ${item.name || item.productId}`,
          code: "PRODUCT_UNAVAILABLE",
        },
        { status: 400 }
      );
    }
    if (productRequiresWeight(product) && !isAllowedWeight(product, item.weight)) {
      return NextResponse.json(
        {
          error: `Choose a weight for ${product.name} before checkout.`,
          code: "WEIGHT_REQUIRED",
        },
        { status: 400 }
      );
    }
    if (stockForWeight(product, item.weight) < item.quantity) {
      return NextResponse.json(
        {
          error: `Not enough stock for ${product.name}${
            item.weight != null ? ` (${item.weight} lb)` : ""
          }`,
          code: "OUT_OF_STOCK",
        },
        { status: 400 }
      );
    }
    const unitPrice = effectivePrice(product);
    lineItems.push({
      productId: product.id,
      name: lineDisplayName(
        product.name,
        item.weight,
        product.discountPercent
      ),
      price: unitPrice,
      quantity: item.quantity,
      image: product.image,
      ...(item.weight != null ? { weight: item.weight } : {}),
    });
    subtotal += unitPrice * item.quantity;
  }
  subtotal = Math.round(subtotal * 100) / 100;

  let discountAmount = 0;
  let total = subtotal;
  let couponCode = order.couponCode;
  if (couponCode?.trim()) {
    const coupon = await getFreshCouponForCheckout(couponCode);
    if (!coupon) {
      return NextResponse.json(
        { error: "Coupon on this order is no longer valid", code: "COUPON_INVALID" },
        { status: 400 }
      );
    }
    const applied = applyCouponToTotal(subtotal, coupon);
    discountAmount = applied.discountAmount;
    total = applied.total;
    couponCode = coupon.code;
  }

  if (total <= 0) {
    return NextResponse.json(
      {
        error:
          "This order is now free after website discounts — use cart checkout to complete it on the website.",
        code: "NOW_FREE",
      },
      { status: 409 }
    );
  }

  const oldDraftId = order.shopifyDraftOrderId;
  const superseded = await cancelOpenShopifyCheckoutsForUser(
    session.userId,
    order.id
  );
  await Promise.all([
    deleteShopifyDraftOrder(oldDraftId),
    ...superseded.map((o) => deleteShopifyDraftOrder(o.shopifyDraftOrderId)),
  ]);

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://pro-shop-lemon.vercel.app";
  const returnUrl = `${origin}/order/success?orderId=${order.id}`;

  try {
    const shopify = await createShopifyCheckout({
      email: session.email,
      username: session.username,
      localOrderId: order.id,
      items: lineItems,
      returnUrl,
      discountAmount,
      couponCode,
    });

    const updated = await updateOrder(order.id, {
      status: "awaiting_payment",
      items: lineItems,
      subtotal,
      discountAmount,
      couponCode,
      total,
      shopifyDraftOrderId: shopify.draftOrderId,
      shopifyInvoiceUrl: shopify.invoiceUrl,
    });

    return NextResponse.json({
      ok: true,
      pricedFromWebsite: true,
      order: updated,
      checkoutUrl: shopify.invoiceUrl,
      subtotal,
      discountAmount,
      total,
      message:
        "Shopify payment rebuilt with this website’s current prices and discounts.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not rebuild payment" },
      { status: 502 }
    );
  }
}
