import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { applyCouponToTotal, couponLabel } from "@/lib/coupons";
import {
  createOrder,
  findCouponByCode,
  getInventoryUpdatedAt,
  getProduct,
  listProducts,
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
        return NextResponse.json(
          { error: "Coupon not found or inactive" },
          { status: 400 }
        );
      }
      const applied = applyCouponToTotal(subtotal, coupon);
      discountAmount = applied.discountAmount;
      total = applied.total;
      appliedCode = coupon.code;
      couponNote = couponLabel(coupon);
    }

    // Always take stock when an order is placed, and always create an order record
    await reduceStock(body.items);

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      req.headers.get("origin") ||
      "http://localhost:3000";

    // Free / fully discounted orders skip Shopify and complete on-site
    if (total <= 0) {
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
      });

      const returnUrl = `${origin}/order/success?orderId=${order.id}`;

      try {
        const shopify = await createShopifyCheckout({
          email: session.email,
          username: session.username,
          localOrderId: order.id,
          items: lineItems,
          returnUrl,
        });

        await updateOrder(order.id, {
          shopifyDraftOrderId: shopify.draftOrderId,
          shopifyInvoiceUrl: shopify.invoiceUrl,
        });

        const products = await listProducts({ includeInactive: true });
        return NextResponse.json({
          ok: true,
          provider: "shopify",
          orderId: order.id,
          order,
          products,
          updatedAt: await getInventoryUpdatedAt(),
          checkoutUrl: shopify.invoiceUrl,
          returnUrl,
          message:
            "Order saved. Continue to Shopify to pay. Stock was reduced from inventory.",
        });
      } catch (e) {
        await updateOrder(order.id, { status: "cancelled" });
        throw e;
      }
    }

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
        : "Order placed. Inventory stock updated and order added to Operations.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
