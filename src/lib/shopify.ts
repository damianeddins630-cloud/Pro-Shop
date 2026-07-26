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

export function shopifyStatus() {
  return {
    configured: isShopifyConfigured(),
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
 * Shoppers browse/cart on this site; payment happens on Shopify's secure invoice URL,
 * then they can return to /order/success.
 */
export async function createShopifyCheckout(input: {
  email: string;
  username: string;
  localOrderId: string;
  items: OrderItem[];
  returnUrl: string;
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

  const data = await adminGraphql<{
    draftOrderCreate: {
      draftOrder: {
        id: string;
        name: string;
        invoiceUrl: string | null;
      } | null;
      userErrors: { field: string[] | null; message: string }[];
    };
  }>(mutation, {
    input: {
      email: input.email,
      note: `Ballard's website order ${input.localOrderId} for ${input.username}. Return: ${input.returnUrl}`,
      tags: ["ballards-website", `bba:${input.localOrderId}`],
      customAttributes: [
        { key: "website_order_id", value: input.localOrderId },
        { key: "website_username", value: input.username },
        { key: "return_url", value: input.returnUrl },
      ],
      lineItems,
      allowDiscountCodesInCheckout: true,
    },
  });

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
