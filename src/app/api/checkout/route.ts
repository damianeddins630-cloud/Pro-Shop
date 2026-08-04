import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { applyCouponToTotal, couponLabel } from "@/lib/coupons";
import {
  createOrder,
  findCouponByCode,
  getCouponRedeemBlockReason,
  getInventoryUpdatedAt,
  getProduct,
  listProducts,
  recordCouponUse,
  reduceStock,
  updateOrder,
} from "@/lib/store";
import {
  createShopifyCheckout,
  isShopifyConfigured,
  shopifyStatus,
} from "@/lib/shopify";
import { effectivePrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(999),
      })
    )
    .min(1),
  couponCode: z.string().optional(),
});

export async function GET() {
  return NextResponse.json(
    { shopify: shopifyStatus() },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Please log in to checkout", code: "LOGIN_REQUIRED" },
      { status: 401 }
    );
  }

  try {
    const body = schema.parse(await req.json());
    const lineItems = [];
    let subtotal = 0;

    for (const item of body.items) {
      const product = await getProduct(item.productId);
      if (!product || !product.active) {
        return NextResponse.json(
          {
            error: `Product unavailable: ${item.productId}`,
            code: "PRODUCT_UNAVAILABLE",
          },
          { status: 400 }
        );
      }
      if (product.stock < item.quantity) {
        return NextResponse.json(
          {
            error: `Not enough stock for ${product.name} (have ${product.stock}, need ${item.quantity})`,
            code: "OUT_OF_STOCK",
          },
          { status: 400 }
        );
      }
      const unitPrice = effectivePrice(product);
      lineItems.push({
        productId: product.id,
        name:
          (product.discountPercent || 0) > 0
            ? `${product.name} (${product.discountPercent}% off)`
            : product.name,
        price: unitPrice,
        quantity: item.quantity,
        image: product.image,
      });
      subtotal += unitPrice * item.quantity;
    }

    subtotal = Math.round(subtotal * 100) / 100;

    let discountAmount = 0;
    let total = subtotal;
    let appliedCode: string | undefined;
    let couponNote = "";

    if (body.couponCode?.trim()) {
      const coupon = await findCouponByCode(body.couponCode);
      if (!coupon) {
        const reason =
          (await getCouponRedeemBlockReason(body.couponCode)) ||
          "Coupon not found or inactive";
        return NextResponse.json(
          { error: reason, code: "COUPON_INVALID" },
          { status: 400 }
        );
      }
      const applied = applyCouponToTotal(subtotal, coupon);
      discountAmount = applied.discountAmount;
      total = applied.total;
      appliedCode = coupon.code;
      couponNote = couponLabel(coupon);
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      req.headers.get("origin") ||
      "http://localhost:3000";

    // Free / fully discounted orders complete on this website (no Shopify popup)
    if (total <= 0) {
      await reduceStock(body.items);
      if (appliedCode) await recordCouponUse(appliedCode);
      const order = await createOrder({
        userId: session.userId,
        username: session.username,
        email: session.email,
        items: lineItems,
        subtotal,
        discountAmount,
        couponCode: appliedCode,
        total: 0,
        status: "completed",
        paymentProvider: "local",
        inventoryApplied: true,
      });

      const products = await listProducts({ includeInactive: true });
      return NextResponse.json({
        ok: true,
        provider: "local",
        free: true,
        orderId: order.id,
        order,
        products,
        updatedAt: await getInventoryUpdatedAt(),
        message: appliedCode
          ? `Free order recorded with coupon ${appliedCode}${couponNote ? ` (${couponNote})` : ""}. No Shopify payment needed.`
          : "Free order recorded on this website.",
      });
    }

    // Paid checkout REQUIRES Shopify — never silently place a paid local order on Vercel.
    if (!isShopifyConfigured()) {
      const status = shopifyStatus();
      return NextResponse.json(
        {
          error:
            "Shopify payment is not connected on this server. Add SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET in Vercel project pro-shop-lemon, then Redeploy.",
          code: "SHOPIFY_NOT_CONFIGURED",
          shopify: status,
        },
        { status: 503 }
      );
    }

    // 1) Record website order first so Ops always has a row even if Shopify fails
    const order = await createOrder({
      userId: session.userId,
      username: session.username,
      email: session.email,
      items: lineItems,
      subtotal,
      discountAmount,
      couponCode: appliedCode,
      total,
      status: "awaiting_payment",
      paymentProvider: "shopify",
      inventoryApplied: false,
    });

    const returnUrl = `${origin}/order/success?orderId=${order.id}`;

    try {
      // 2) Create Shopify Draft Order → invoice / payment URL
      const shopify = await createShopifyCheckout({
        email: session.email,
        username: session.username,
        localOrderId: order.id,
        items: lineItems,
        returnUrl,
        discountAmount,
        couponCode: appliedCode,
      });

      const updated = await updateOrder(order.id, {
        shopifyDraftOrderId: shopify.draftOrderId,
        shopifyInvoiceUrl: shopify.invoiceUrl,
      });

      // 3) Client must redirect to checkoutUrl (Shopify hosted payment)
      return NextResponse.json({
        ok: true,
        provider: "shopify",
        orderId: order.id,
        order: updated || order,
        checkoutUrl: shopify.invoiceUrl,
        returnUrl,
        message:
          "Redirecting to Shopify to collect payment. Inventory updates after payment succeeds.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Shopify checkout failed";
      await updateOrder(order.id, { status: "cancelled" });
      return NextResponse.json(
        {
          error: message,
          code: "SHOPIFY_DRAFT_FAILED",
          orderId: order.id,
          shopify: shopifyStatus(),
        },
        { status: 502 }
      );
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid cart payload", code: "INVALID_CART", details: e.issues },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json(
      { error: message, code: "CHECKOUT_FAILED" },
      { status: 400 }
    );
  }
}
