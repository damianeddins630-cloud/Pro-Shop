import type { OrderItem } from "@/lib/types";

/** Read env and strip accidental quotes/whitespace from Vercel paste. */
function env(name: string): string {
  let v = (process.env[name] || "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

const API_VERSION = env("SHOPIFY_API_VERSION") || "2025-01";

export type ShopifyCheckoutResult = {
  invoiceUrl: string;
  draftOrderId: string;
  draftOrderName?: string;
};

export type ShopifyStatus = {
  configured: boolean;
  webhookConfigured: boolean;
  checkoutReady: boolean;
  storeDomain: string | null;
  apiVersion: string;
  missing: string[];
  hints: string[];
};

function storeDomainRaw() {
  return env("SHOPIFY_STORE_DOMAIN")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function adminToken() {
  return env("SHOPIFY_ADMIN_ACCESS_TOKEN");
}

export function isShopifyConfigured() {
  return Boolean(storeDomainRaw() && adminToken());
}

export function isShopifyWebhookConfigured() {
  return Boolean(env("SHOPIFY_WEBHOOK_SECRET"));
}

export function shopifyStatus(): ShopifyStatus {
  const missing: string[] = [];
  const hints: string[] = [];

  if (!storeDomainRaw()) missing.push("SHOPIFY_STORE_DOMAIN");
  if (!adminToken()) missing.push("SHOPIFY_ADMIN_ACCESS_TOKEN");
  if (!env("SHOPIFY_WEBHOOK_SECRET")) missing.push("SHOPIFY_WEBHOOK_SECRET");
  if (!env("NEXT_PUBLIC_SITE_URL")) {
    hints.push(
      "Set NEXT_PUBLIC_SITE_URL to https://pro-shop-lemon.vercel.app so return links work."
    );
  }
  if (missing.includes("SHOPIFY_STORE_DOMAIN") || missing.includes("SHOPIFY_ADMIN_ACCESS_TOKEN")) {
    hints.push(
      "Add Shopify vars on the Vercel project pro-shop-lemon (Production), then Redeploy with cache off."
    );
  }
  if (missing.includes("SHOPIFY_WEBHOOK_SECRET")) {
    hints.push(
      "Webhook topic orders/paid → https://pro-shop-lemon.vercel.app/api/shopify/webhook"
    );
  }

  const configured = isShopifyConfigured();
  return {
    configured,
    webhookConfigured: isShopifyWebhookConfigured(),
    checkoutReady: configured,
    storeDomain: storeDomainRaw() || null,
    apiVersion: API_VERSION,
    missing,
    hints,
  };
}

async function adminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const domain = storeDomainRaw();
  const token = adminToken();
  if (!domain || !token) {
    throw new Error(
      "Shopify is not configured. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN in Vercel."
    );
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

async function fetchDraftInvoiceUrl(draftOrderId: string): Promise<string | null> {
  const data = await adminGraphql<{
    draftOrder: { id: string; invoiceUrl: string | null; status: string } | null;
  }>(
    `query DraftInvoice($id: ID!) {
      draftOrder(id: $id) {
        id
        invoiceUrl
        status
      }
    }`,
    { id: draftOrderId }
  );
  return data.draftOrder?.invoiceUrl || null;
}

/** Some stores only mint invoiceUrl after invoice send. */
async function sendDraftInvoice(draftOrderId: string): Promise<string | null> {
  const data = await adminGraphql<{
    draftOrderInvoiceSend: {
      draftOrder: { id: string; invoiceUrl: string | null } | null;
      userErrors: { message: string }[];
    };
  }>(
    `mutation SendInvoice($id: ID!) {
      draftOrderInvoiceSend(id: $id) {
        draftOrder {
          id
          invoiceUrl
        }
        userErrors {
          message
        }
      }
    }`,
    { id: draftOrderId }
  );

  if (data.draftOrderInvoiceSend.userErrors?.length) {
    throw new Error(
      data.draftOrderInvoiceSend.userErrors.map((e) => e.message).join("; ")
    );
  }
  return data.draftOrderInvoiceSend.draftOrder?.invoiceUrl || null;
}

/**
 * Create a Shopify draft order from website cart lines and return the
 * hosted invoice / payment URL (Shop Pay, Apple Pay, card, etc.).
 */
export async function createShopifyCheckout(input: {
  email: string;
  username: string;
  localOrderId: string;
  items: OrderItem[];
  returnUrl: string;
  discountAmount?: number;
  couponCode?: string;
}): Promise<ShopifyCheckoutResult> {
  if (!input.items.length) {
    throw new Error("Cart is empty");
  }
  if (!input.email?.includes("@")) {
    throw new Error("A valid customer email is required for Shopify checkout");
  }

  const mutation = `
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
          invoiceUrl
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const lineItems = input.items.map((item) => ({
    title: item.name.slice(0, 255),
    quantity: item.quantity,
    originalUnitPrice: Number(item.price).toFixed(2),
    customAttributes: [
      { key: "website_product_id", value: String(item.productId) },
      { key: "website_order_id", value: input.localOrderId },
    ],
  }));

  const draftInput: Record<string, unknown> = {
    email: input.email.trim().toLowerCase(),
    note: `Ballard's website order ${input.localOrderId} for ${input.username}. Return: ${input.returnUrl}`,
    tags: ["ballards-website", `bba:${input.localOrderId}`],
    customAttributes: [
      { key: "website_order_id", value: input.localOrderId },
      { key: "website_username", value: input.username },
      { key: "return_url", value: input.returnUrl },
    ],
    lineItems,
    // Website coupons applied below — do not also allow Shopify discount codes
    allowDiscountCodesInCheckout: false,
  };

  const discount = Number(input.discountAmount || 0);
  if (discount > 0.009) {
    draftInput.appliedDiscount = {
      title: (input.couponCode?.trim() || "Website coupon").slice(0, 255),
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
        status: string;
      } | null;
      userErrors: { field: string[] | null; message: string }[];
    };
  }>(mutation, { input: draftInput });

  const payload = data.draftOrderCreate;
  if (payload.userErrors?.length) {
    throw new Error(
      `Shopify draft order error: ${payload.userErrors.map((e) => e.message).join("; ")}`
    );
  }
  if (!payload.draftOrder?.id) {
    throw new Error("Shopify did not create a draft order");
  }

  let invoiceUrl = payload.draftOrder.invoiceUrl;
  if (!invoiceUrl) {
    invoiceUrl = await fetchDraftInvoiceUrl(payload.draftOrder.id);
  }
  if (!invoiceUrl) {
    // Force Shopify to mint the customer payment / invoice link
    invoiceUrl = await sendDraftInvoice(payload.draftOrder.id);
  }
  if (!invoiceUrl) {
    throw new Error(
      "Shopify created the draft order but did not return a payment link. Check the custom app has write_draft_orders and the store can invoice customers."
    );
  }

  return {
    invoiceUrl,
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

/** Lightweight Admin API probe used by /api/shopify/status */
export async function pingShopifyAdmin(): Promise<{
  ok: boolean;
  shopName?: string;
  error?: string;
}> {
  if (!isShopifyConfigured()) {
    return { ok: false, error: "Shopify env vars are missing" };
  }
  try {
    const data = await adminGraphql<{ shop: { name: string; myshopifyDomain: string } }>(
      `query { shop { name myshopifyDomain } }`
    );
    return {
      ok: true,
      shopName: data.shop?.name || data.shop?.myshopifyDomain,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Shopify Admin API ping failed",
    };
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
