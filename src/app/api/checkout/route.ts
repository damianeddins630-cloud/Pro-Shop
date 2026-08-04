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

const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  couponCode: z.string().optional(),
});

export async function GET() {
  return NextResponse.json({ shopify: shopifyStatus() });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Please log in to checkout" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    const lineItems = [];
    let subtotal = 0;

    for (const item of body.items) {
      const product = await getProduct(item.productId);
      if (!product || !product.active) {
        return NextResponse.json({ error: "Product unavailable" }, { status: 400 });
      }
      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Not enough stock for ${product.name}` },
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
        return NextResponse.json({ error: reason }, { status: 400 });
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

    // Free / fully discounted orders complete on this website (no Shopify)
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
        order,
        products,
        updatedAt: await getInventoryUpdatedAt(),
        message: appliedCode
          ? `Order is free with coupon ${appliedCode}${couponNote ? ` (${couponNote})` : ""}.`
          : "Order placed for free.",
      });
    }

    // Shopify checkout: website keeps catalog; Shopify only collects payment.
    // Inventory is reduced after successful payment (verified webhook / confirm).
    if (isShopifyConfigured()) {
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

        return NextResponse.json({
          ok: true,
          provider: "shopify",
          orderId: order.id,
          order: updated || order,
          checkoutUrl: shopify.invoiceUrl,
          returnUrl,
          message:
            "Continue to Shopify to pay. Website inventory updates after payment succeeds.",
        });
      } catch (e) {
        await updateOrder(order.id, { status: "cancelled" });
        throw e;
      }
    }

    // On Vercel / production, do not pretend paid checkout works without Shopify.
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          error:
            "Shopify checkout is not connected yet. Add SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN in Vercel, then redeploy.",
          shopify: shopifyStatus(),
        },
        { status: 503 }
      );
    }

    // Local/dev fallback only
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
      total,
      status: "placed",
      paymentProvider: "local",
      inventoryApplied: true,
    });

    const products = await listProducts({ includeInactive: true });
    return NextResponse.json({
      ok: true,
      provider: "local",
      order,
      products,
      updatedAt: await getInventoryUpdatedAt(),
      message: appliedCode
        ? `Order placed with coupon ${appliedCode}. Inventory updated.`
        : "Order placed locally (Shopify not connected). Inventory updated.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
