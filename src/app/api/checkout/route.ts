import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { applyCouponToTotal, couponLabel } from "@/lib/coupons";
import {
  cancelOpenShopifyCheckoutsForUser,
  createOrder,
  getCouponRedeemBlockReason,
  getFreshCouponForCheckout,
  getFreshProductForCheckout,
  getInventoryUpdatedAt,
  listProducts,
  recordCouponUse,
  reduceStock,
  updateOrder,
} from "@/lib/store";
import {
  createShopifyCheckout,
  deleteShopifyDraftOrder,
  isShopifyConfigured,
  loadShopifyRuntimeConfig,
  shopifyStatus,
} from "@/lib/shopify";
import { effectivePrice } from "@/lib/pricing";
import type { OrderItem } from "@/lib/types";
import { orderNeedsInStoreVisit } from "@/lib/in-store";
import {
  isAllowedWeight,
  lineDisplayName,
  productRequiresWeight,
  stockForWeight,
} from "@/lib/weights";

export const dynamic = "force-dynamic";

const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(999),
        weight: z.number().positive().max(30).optional(),
      })
    )
    .min(1),
  couponCode: z.string().optional(),
});

export async function GET() {
  await loadShopifyRuntimeConfig();
  return NextResponse.json(
    { shopify: shopifyStatus() },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

/** Build line items from the live website catalog (prices + % discounts). */
async function priceCartFromWebsite(
  items: { productId: string; quantity: number; weight?: number }[]
): Promise<
  | { ok: true; lineItems: OrderItem[]; subtotal: number }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const lineItems: OrderItem[] = [];
  let subtotal = 0;

  for (const item of items) {
    const product = await getFreshProductForCheckout(item.productId);
    if (!product || !product.active) {
      return {
        ok: false,
        status: 400,
        body: {
          error: `Product unavailable: ${item.productId}`,
          code: "PRODUCT_UNAVAILABLE",
        },
      };
    }
    if (productRequiresWeight(product) && !isAllowedWeight(product, item.weight)) {
      return {
        ok: false,
        status: 400,
        body: {
          error: `Choose a weight for ${product.name} before checkout.`,
          code: "WEIGHT_REQUIRED",
        },
      };
    }
    const available = stockForWeight(product, item.weight);
    if (available < item.quantity) {
      return {
        ok: false,
        status: 400,
        body: {
          error: `Not enough stock for ${product.name}${
            item.weight != null ? ` (${item.weight} lb)` : ""
          } (have ${available}, need ${item.quantity})`,
          code: "OUT_OF_STOCK",
        },
      };
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

  return {
    ok: true,
    lineItems,
    subtotal: Math.round(subtotal * 100) / 100,
  };
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
    await loadShopifyRuntimeConfig();
    const body = schema.parse(await req.json());

    // Always re-read website prices/discounts at charge time (never trust cart cache).
    const priced = await priceCartFromWebsite(body.items);
    if (!priced.ok) {
      return NextResponse.json(priced.body, { status: priced.status });
    }
    const { lineItems, subtotal } = priced;

    let discountAmount = 0;
    let total = subtotal;
    let appliedCode: string | undefined;
    let couponNote = "";

    if (body.couponCode?.trim()) {
      const coupon = await getFreshCouponForCheckout(body.couponCode);
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

    // Free / fully discounted — no Shopify popup. Balls still enter the in-store pipeline.
    if (total <= 0) {
      await reduceStock(body.items);
      if (appliedCode) await recordCouponUse(appliedCode);
      const needsVisit = orderNeedsInStoreVisit(lineItems);
      const order = await createOrder({
        userId: session.userId,
        username: session.username,
        email: session.email,
        items: lineItems,
        subtotal,
        discountAmount,
        couponCode: appliedCode,
        total: 0,
        // Balls must be drilled in-store — never skip the prep/ready pipeline.
        status: needsVisit ? "processing" : "completed",
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
        needsInStoreVisit: needsVisit,
        message: needsVisit
          ? `Order recorded${appliedCode ? ` with coupon ${appliedCode}` : ""}. Come in to Ballard's for drilling and pickup — we do not ship.`
          : appliedCode
            ? `Free order recorded with coupon ${appliedCode}${couponNote ? ` (${couponNote})` : ""}.`
            : "Free order recorded on this website.",
      });
    }

    // Paid checkout REQUIRES Shopify — never silently place a paid local order on Vercel.
    await loadShopifyRuntimeConfig();
    if (!isShopifyConfigured()) {
      const status = shopifyStatus();
      return NextResponse.json(
        {
          error:
            "Shopify payment is not connected yet. Open Ops → Shopify, tap Refresh status or Save Connect, then try checkout again.",
          code: "SHOPIFY_NOT_CONFIGURED",
          shopify: status,
        },
        { status: 503 }
      );
    }

    // Cancel any older unpaid invoices for this shopper so they can't pay a
    // stale website price / discount from a previous Shopify draft.
    const superseded = await cancelOpenShopifyCheckoutsForUser(session.userId);
    await Promise.all(
      superseded.map((o) => deleteShopifyDraftOrder(o.shopifyDraftOrderId))
    );

    // 1) Record website order with LIVE prices. Stock stays until paid.
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
      // 2) Brand-new Shopify Draft Order every charge attempt = instant website prices.
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
        pricedFromWebsite: true,
        websitePrices: lineItems.map((i) => ({
          productId: i.productId,
          name: i.name,
          unitPrice: i.price,
          quantity: i.quantity,
          lineTotal: Math.round(i.price * i.quantity * 100) / 100,
        })),
        subtotal,
        discountAmount,
        total,
        message:
          "Redirecting to Shopify with this website’s current prices and discounts. Cart stays until you pay. Stock updates only after payment.",
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
