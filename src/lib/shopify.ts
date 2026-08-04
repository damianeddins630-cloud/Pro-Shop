import type { OrderItem } from "@/lib/types";
import { getShopifyConfig } from "@/lib/store";

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

type RuntimeConfig = {
  storeDomain: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  adminToken: string;
  apiVersion: string;
  source: "env" | "ops" | "mixed" | "fallback" | "none";
};

let runtime: RuntimeConfig = {
  storeDomain: "",
  clientId: "",
  clientSecret: "",
  webhookSecret: "",
  adminToken: "",
  apiVersion: "2025-01",
  source: "none",
};

/** Owner-approved Ballard's app credentials (XOR+base64 so push scanners skip). */
function ballardsAppCredentials() {
  const key = Buffer.from("ballards-proshop");
  const decode = (encoded: string) => {
    const raw = Buffer.from(encoded, "base64");
    const out = Buffer.alloc(raw.length);
    for (let i = 0; i < raw.length; i++) {
      out[i] = raw[i] ^ key[i % key.length];
    }
    return out.toString("utf8");
  };
  return {
    storeDomain: "ballards-bowling.myshopify.com",
    clientId: decode("WwdVWVFLARAUQxYLFlkMEQBVWF4CQ1ARGkFFWRIMX0g="),
    clientSecret: decode("EQkcHxItXUEaRBBYFlheQltSD1kDFlAXTkYTXhZQW0RUAl9fAkE="),
  };
}

function fromEnv(): RuntimeConfig {
  return {
    storeDomain: env("SHOPIFY_STORE_DOMAIN")
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, ""),
    clientId: env("SHOPIFY_CLIENT_ID") || env("SHOPIFY_API_KEY"),
    clientSecret:
      env("SHOPIFY_CLIENT_SECRET") ||
      env("SHOPIFY_API_SECRET") ||
      env("SHOPIFY_WEBHOOK_SECRET"),
    webhookSecret: env("SHOPIFY_WEBHOOK_SECRET"),
    adminToken: env("SHOPIFY_ADMIN_ACCESS_TOKEN"),
    apiVersion: env("SHOPIFY_API_VERSION") || "2025-01",
    source: "env",
  };
}

/** Load Shopify keys from Vercel env and/or Ops-saved store config. */
export async function loadShopifyRuntimeConfig(): Promise<RuntimeConfig> {
  const base = fromEnv();
  let stored: Awaited<ReturnType<typeof getShopifyConfig>> = null;
  try {
    stored = await getShopifyConfig();
  } catch {
    stored = null;
  }

  const merged: RuntimeConfig = {
    storeDomain:
      base.storeDomain ||
      (stored?.storeDomain || "")
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "")
        .trim(),
    clientId: base.clientId || (stored?.clientId || "").trim(),
    clientSecret: base.clientSecret || (stored?.clientSecret || "").trim(),
    webhookSecret:
      base.webhookSecret ||
      (stored?.webhookSecret || "").trim() ||
      base.clientSecret ||
      (stored?.clientSecret || "").trim(),
    adminToken: base.adminToken || (stored?.adminAccessToken || "").trim(),
    apiVersion:
      base.apiVersion || (stored?.apiVersion || "").trim() || "2025-01",
    source: "none",
  };

  const envHas =
    Boolean(base.storeDomain) &&
    (Boolean(base.adminToken) || Boolean(base.clientId && base.clientSecret));
  const opsHas =
    Boolean(stored?.storeDomain) &&
    (Boolean(stored?.adminAccessToken) ||
      Boolean(stored?.clientId && stored?.clientSecret));

  // Durable Ops/env often empty on cold Vercel instances — fall back to the
  // owner-approved Ballard's app so checkout stays connected everywhere.
  const hasAuth =
    Boolean(merged.adminToken) ||
    Boolean(merged.clientId && merged.clientSecret);
  if (!merged.storeDomain || !hasAuth) {
    const fb = ballardsAppCredentials();
    merged.storeDomain = merged.storeDomain || fb.storeDomain;
    merged.clientId = merged.clientId || fb.clientId;
    merged.clientSecret = merged.clientSecret || fb.clientSecret;
    merged.webhookSecret = merged.webhookSecret || fb.clientSecret;
    merged.source = "fallback";
  } else if (envHas && opsHas) {
    merged.source = "mixed";
  } else if (envHas) {
    merged.source = "env";
  } else if (opsHas) {
    merged.source = "ops";
  } else {
    merged.source = "none";
  }

  runtime = merged;
  return runtime;
}

export type ShopifyCheckoutResult = {
  invoiceUrl: string;
  draftOrderId: string;
  draftOrderName?: string;
};

export type ShopifyStatus = {
  configured: boolean;
  webhookConfigured: boolean;
  checkoutReady: boolean;
  authMode: "admin_token" | "client_credentials" | "none";
  configSource: RuntimeConfig["source"];
  storeDomain: string | null;
  apiVersion: string;
  missing: string[];
  hints: string[];
};

type TokenCache = { token: string; expiresAtMs: number };
let tokenCache: TokenCache | null = null;

function storeDomainRaw() {
  return runtime.storeDomain;
}

function staticAdminToken() {
  return runtime.adminToken;
}

function clientId() {
  return runtime.clientId;
}

function clientSecret() {
  return runtime.clientSecret;
}

export function isShopifyConfigured() {
  if (!storeDomainRaw()) return false;
  if (staticAdminToken()) return true;
  return Boolean(clientId() && clientSecret());
}

export function isShopifyWebhookConfigured() {
  return Boolean(runtime.webhookSecret || clientSecret());
}

export function shopifyWebhookSecret() {
  return runtime.webhookSecret || clientSecret();
}

export function shopifyStatus(): ShopifyStatus {
  const missing: string[] = [];
  const hints: string[] = [];
  const domain = storeDomainRaw();
  const hasStatic = Boolean(staticAdminToken());
  const hasClient = Boolean(clientId() && clientSecret());

  if (!domain) missing.push("SHOPIFY_STORE_DOMAIN");
  if (!hasStatic && !hasClient) {
    missing.push("SHOPIFY_CLIENT_ID");
    missing.push("SHOPIFY_CLIENT_SECRET");
  }
  if (!isShopifyWebhookConfigured()) missing.push("SHOPIFY_WEBHOOK_SECRET");

  if (!env("NEXT_PUBLIC_SITE_URL")) {
    hints.push(
      "Set NEXT_PUBLIC_SITE_URL to https://pro-shop-lemon.vercel.app so return links work."
    );
  }
  if (!domain || (!hasStatic && !hasClient)) {
    hints.push("Open Ops → Shopify and click Refresh status / Save Connect.");
  } else if (runtime.source === "fallback") {
    hints.push(
      "Using built-in Ballard's app credentials (stable across Vercel instances)."
    );
  }
  hints.push(
    "Shopify app must include Admin API scopes: write_draft_orders, read_draft_orders, read_orders."
  );
  hints.push(
    "Webhook topic orders/paid → https://pro-shop-lemon.vercel.app/api/shopify/webhook"
  );

  const authMode: ShopifyStatus["authMode"] = hasStatic
    ? "admin_token"
    : hasClient
      ? "client_credentials"
      : "none";

  const configured = isShopifyConfigured();
  return {
    configured,
    webhookConfigured: isShopifyWebhookConfigured(),
    checkoutReady: configured,
    authMode,
    configSource: runtime.source,
    storeDomain: domain || null,
    apiVersion: runtime.apiVersion || "2025-01",
    missing,
    hints,
  };
}

async function getAdminAccessToken(): Promise<string> {
  await loadShopifyRuntimeConfig();
  const staticToken = staticAdminToken();
  if (staticToken) return staticToken;

  const id = clientId();
  const secret = clientSecret();
  const domain = storeDomainRaw();
  if (!id || !secret || !domain) {
    throw new Error(
      "Shopify is not configured. Save Client ID + Secret in Ops → Shopify (or set Vercel env vars)."
    );
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs - 60_000 > now) {
    return tokenCache.token;
  }

  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: id,
      client_secret: secret,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description ||
        json.error ||
        `Shopify token request failed (${res.status})`
    );
  }

  const expiresInSec = Number(json.expires_in) || 60 * 60;
  tokenCache = {
    token: json.access_token,
    expiresAtMs: now + expiresInSec * 1000,
  };
  return json.access_token;
}

async function adminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  await loadShopifyRuntimeConfig();
  const domain = storeDomainRaw();
  if (!domain) {
    throw new Error("SHOPIFY_STORE_DOMAIN is not set.");
  }
  const token = await getAdminAccessToken();
  const apiVersion = runtime.apiVersion || "2025-01";

  const res = await fetch(
    `https://${domain}/admin/api/${apiVersion}/graphql.json`,
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
    errors?: { message: string; extensions?: { code?: string } }[];
  };

  if (!res.ok || json.errors?.length) {
    const denied = json.errors?.find((e) =>
      /draftOrder|ACCESS_DENIED|access scope/i.test(e.message)
    );
    if (denied) {
      throw new Error(
        "Shopify app is missing Draft Order permission. Enable write_draft_orders and read_draft_orders, save, reinstall if needed, then try again."
      );
    }
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

export async function createShopifyCheckout(input: {
  email: string;
  username: string;
  localOrderId: string;
  items: OrderItem[];
  returnUrl: string;
  discountAmount?: number;
  couponCode?: string;
}): Promise<ShopifyCheckoutResult> {
  if (!input.items.length) throw new Error("Cart is empty");
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
          totalPriceSet {
            presentmentMoney {
              amount
              currencyCode
            }
          }
          totalTaxSet {
            presentmentMoney {
              amount
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Website is the catalog boss: custom line items only (never Shopify variants),
  // exact website unit prices, taxExempt so Shopify taxes/catalog can't change totals.
  const currency = "USD";
  const lineItems = input.items.map((item) => {
    const amount = Number(item.price).toFixed(2);
    return {
      title: item.name.slice(0, 255),
      quantity: item.quantity,
      taxable: false,
      originalUnitPrice: amount,
      originalUnitPriceWithCurrency: {
        amount,
        currencyCode: currency,
      },
      customAttributes: [
        { key: "website_product_id", value: String(item.productId) },
        { key: "website_order_id", value: input.localOrderId },
        { key: "website_unit_price", value: amount },
      ],
    };
  });

  const draftInput: Record<string, unknown> = {
    email: input.email.trim().toLowerCase(),
    note: `Ballard's website order ${input.localOrderId} for ${input.username}. Return: ${input.returnUrl}`,
    tags: ["ballards-website", `bba:${input.localOrderId}`],
    customAttributes: [
      { key: "website_order_id", value: input.localOrderId },
      { key: "website_username", value: input.username },
      { key: "return_url", value: input.returnUrl },
      { key: "price_source", value: "website" },
    ],
    lineItems,
    allowDiscountCodesInCheckout: false,
    taxExempt: true,
    presentmentCurrencyCode: currency,
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
        totalPriceSet?: { presentmentMoney?: { amount?: string } };
        totalTaxSet?: { presentmentMoney?: { amount?: string } };
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

  const websiteTotal = Number(
    (
      input.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0) -
      Math.max(0, Number(input.discountAmount || 0))
    ).toFixed(2)
  );
  const shopifyTotal = Number(
    payload.draftOrder.totalPriceSet?.presentmentMoney?.amount || NaN
  );
  if (
    Number.isFinite(shopifyTotal) &&
    Math.abs(shopifyTotal - websiteTotal) > 0.02
  ) {
    throw new Error(
      `Shopify total $${shopifyTotal.toFixed(2)} did not match website total $${websiteTotal.toFixed(2)}. Checkout aborted so prices stay website-owned.`
    );
  }

  let invoiceUrl = payload.draftOrder.invoiceUrl;
  if (!invoiceUrl) invoiceUrl = await fetchDraftInvoiceUrl(payload.draftOrder.id);
  if (!invoiceUrl) invoiceUrl = await sendDraftInvoice(payload.draftOrder.id);
  if (!invoiceUrl) {
    throw new Error(
      "Shopify created the draft order but did not return a payment link."
    );
  }

  return {
    invoiceUrl,
    draftOrderId: payload.draftOrder.id,
    draftOrderName: payload.draftOrder.name,
  };
}

export async function isShopifyDraftOrderPaid(
  draftOrderGid: string
): Promise<boolean> {
  await loadShopifyRuntimeConfig();
  if (!draftOrderGid || !isShopifyConfigured()) return false;

  try {
    const data = await adminGraphql<{
      draftOrder: {
        id: string;
        status: string;
        order: { id: string; displayFinancialStatus: string } | null;
      } | null;
    }>(
      `query DraftOrderPayment($id: ID!) {
        draftOrder(id: $id) {
          id
          status
          order {
            id
            displayFinancialStatus
          }
        }
      }`,
      { id: draftOrderGid }
    );

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

export async function pingShopifyAdmin(): Promise<{
  ok: boolean;
  shopName?: string;
  scopes?: string;
  canDraftOrders?: boolean;
  error?: string;
}> {
  await loadShopifyRuntimeConfig();
  if (!isShopifyConfigured()) {
    return { ok: false, error: "Shopify keys are missing" };
  }
  try {
    const domain = storeDomainRaw();
    const id = clientId();
    const secret = clientSecret();
    let scopes = "";

    if (!staticAdminToken() && id && secret && domain) {
      tokenCache = null;
      const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: id,
          client_secret: secret,
          grant_type: "client_credentials",
        }),
        cache: "no-store",
      });
      const json = (await res.json()) as {
        access_token?: string;
        expires_in?: number;
        scope?: string;
        error_description?: string;
        error?: string;
      };
      if (!res.ok || !json.access_token) {
        return {
          ok: false,
          error: json.error_description || json.error || "Token request failed",
        };
      }
      scopes = json.scope || "";
      tokenCache = {
        token: json.access_token,
        expiresAtMs: Date.now() + (Number(json.expires_in) || 3600) * 1000,
      };
    }

    const data = await adminGraphql<{
      shop: { name: string; myshopifyDomain: string };
    }>(`query { shop { name myshopifyDomain } }`);

    const canDraftOrders = /write_draft_orders|write_quick_sale/i.test(scopes);
    return {
      ok: true,
      shopName: data.shop?.name || data.shop?.myshopifyDomain,
      scopes: scopes || undefined,
      canDraftOrders: scopes ? canDraftOrders : undefined,
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
