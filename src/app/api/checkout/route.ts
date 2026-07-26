import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  createOrder,
  getProduct,
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
    let total = 0;

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
      total += unitPrice * item.quantity;
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      req.headers.get("origin") ||
      "http://localhost:3000";

    // Shopify takes the money; browsing/cart stay on this website.
    if (isShopifyConfigured()) {
      const order = await createOrder({
        userId: session.userId,
        username: session.username,
        email: session.email,
        items: lineItems,
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

        return NextResponse.json({
          ok: true,
          provider: "shopify",
          orderId: order.id,
          checkoutUrl: shopify.invoiceUrl,
          returnUrl,
          message:
            "Continue to Shopify to pay securely. You'll come back to this site after payment.",
        });
      } catch (e) {
        await updateOrder(order.id, { status: "cancelled" });
        throw e;
      }
    }

    // Local fallback when Shopify env vars are not set yet
    await reduceStock(body.items);
    const order = await createOrder({
      userId: session.userId,
      username: session.username,
      email: session.email,
      items: lineItems,
      total,
      status: "placed",
      paymentProvider: "local",
    });

    return NextResponse.json({
      ok: true,
      provider: "local",
      order,
      message:
        "Order saved on the website. Connect Shopify in Vercel env vars to collect real payments.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
