import type { OrderItem } from "@/lib/types";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-01";

export type ShopifyCheckoutResult = {
  invoiceUrl: string;
  draftOrderId: string;
  draftOrderName?: string;
};

export function isShopifyConfigured() {
  return Boolean(
    process.env.SHOPIFY_STORE_DOMAIN?.trim() &&
      process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim()
  );
}

export function isShopifyWebhookConfigured() {
  return Boolean(process.env.SHOPIFY_WEBHOOK_SECRET?.trim());
}

export function shopifyStatus() {
  return {
    configured: isShopifyConfigured(),
    webhookConfigured: isShopifyWebhookConfigured(),
    checkoutReady: isShopifyConfigured(),
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN?.trim() || null,
    apiVersion: API_VERSION,
  };
}

function storeDomain() {
  const raw = process.env.SHOPIFY_STORE_DOMAIN?.trim() || "";
  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

async function adminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const domain = storeDomain();
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  if (!domain || !token) {
    throw new Error("Shopify is not configured");
  }

  const res = await fetch(
    `https://${domain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    }
  );

  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (!res.ok || json.errors?.length) {
    const msg =
      json.errors?.map((e) => e.message).join("; ") ||
      `Shopify API error (${res.status})`;
    throw new Error(msg);
  }

  return json.data as T;
}

/**
 * Create a Shopify draft order from website cart lines.
 * Shoppers browse/cart on this site; payment happens on Shopify's secure invoice URL.
 * Inventory stays on the website until payment is confirmed.
 */
export async function createShopifyCheckout(input: {
  email: string;
  username: string;
  localOrderId: string;
  items: OrderItem[];
  returnUrl: string;
  /** Website coupon discount already computed in dollars */
  discountAmount?: number;
  couponCode?: string;
}): Promise<ShopifyCheckoutResult> {
  const mutation = `
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
          invoiceUrl
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const lineItems = input.items.map((item) => ({
    title: item.name,
    quantity: item.quantity,
    originalUnitPrice: item.price.toFixed(2),
    customAttributes: [
      { key: "website_product_id", value: item.productId },
      { key: "website_order_id", value: input.localOrderId },
    ],
  }));

  const draftInput: Record<string, unknown> = {
    email: input.email,
    note: `Ballard's website order ${input.localOrderId} for ${input.username}. Return: ${input.returnUrl}`,
    tags: ["ballards-website", `bba:${input.localOrderId}`],
    customAttributes: [
      { key: "website_order_id", value: input.localOrderId },
      { key: "website_username", value: input.username },
      { key: "return_url", value: input.returnUrl },
    ],
    lineItems,
    // Website coupons are applied below — do not also allow Shopify discount codes
    allowDiscountCodesInCheckout: false,
  };

  const discount = Number(input.discountAmount || 0);
  if (discount > 0) {
    draftInput.appliedDiscount = {
      title: input.couponCode?.trim() || "Website coupon",
      description: input.couponCode
        ? `Website coupon ${input.couponCode}`
        : "Website discount",
      value: Number(discount.toFixed(2)),
      valueType: "FIXED_AMOUNT",
    };
  }

  const data = await adminGraphql<{
    draftOrderCreate: {
      draftOrder: {
        id: string;
        name: string;
        invoiceUrl: string | null;
      } | null;
      userErrors: { field: string[] | null; message: string }[];
    };
  }>(mutation, { input: draftInput });

  const payload = data.draftOrderCreate;
  if (payload.userErrors?.length) {
    throw new Error(payload.userErrors.map((e) => e.message).join("; "));
  }
  if (!payload.draftOrder?.invoiceUrl) {
    throw new Error("Shopify did not return a payment link");
  }

  return {
    invoiceUrl: payload.draftOrder.invoiceUrl,
    draftOrderId: payload.draftOrder.id,
    draftOrderName: payload.draftOrder.name,
  };
}

/** True when the Shopify draft order was completed / paid. */
export async function isShopifyDraftOrderPaid(
  draftOrderGid: string
): Promise<boolean> {
  if (!draftOrderGid || !isShopifyConfigured()) return false;

  const query = `
    query DraftOrderPayment($id: ID!) {
      draftOrder(id: $id) {
        id
        status
        order {
          id
          displayFinancialStatus
        }
      }
    }
  `;

  try {
    const data = await adminGraphql<{
      draftOrder: {
        id: string;
        status: string;
        order: { id: string; displayFinancialStatus: string } | null;
      } | null;
    }>(query, { id: draftOrderGid });

    const draft = data.draftOrder;
    if (!draft) return false;
    if (draft.status === "COMPLETED" && draft.order) {
      const status = (draft.order.displayFinancialStatus || "").toUpperCase();
      return status === "PAID" || status === "PARTIALLY_PAID";
    }
    return false;
  } catch {
    return false;
  }
}

export function draftOrderGidFromNumericId(
  draftOrderId: number | string | undefined | null
): string | null {
  if (draftOrderId === undefined || draftOrderId === null || draftOrderId === "") {
    return null;
  }
  const raw = String(draftOrderId);
  if (raw.startsWith("gid://")) return raw;
  return `gid://shopify/DraftOrder/${raw}`;
}
