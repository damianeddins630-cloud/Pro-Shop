import type { ShopifySiteConfig } from "@/lib/types";

const REDIS_SHOPIFY_KEY = "bba:shopify:v1";
const BLOB_SHOPIFY_PATH = "bba-shopify-config.json";

function redisConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function githubToken() {
  return (
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim() ||
    process.env.GH_STORAGE_TOKEN?.trim() ||
    ""
  );
}

function normalizeConfig(
  input: ShopifySiteConfig | null | undefined
): ShopifySiteConfig | null {
  if (!input) return null;
  const storeDomain = (input.storeDomain || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .trim();
  const clientId = (input.clientId || "").trim();
  const clientSecret = (input.clientSecret || "").trim();
  const webhookSecret = (input.webhookSecret || "").trim() || clientSecret;
  const adminAccessToken = (input.adminAccessToken || "").trim();
  if (!storeDomain) return null;
  if (!adminAccessToken && !(clientId && clientSecret)) return null;
  return {
    storeDomain,
    clientId,
    clientSecret,
    webhookSecret,
    adminAccessToken,
    apiVersion: (input.apiVersion || "2025-01").trim(),
    updatedAt: input.updatedAt || new Date().toISOString(),
    updatedBy: input.updatedBy,
  };
}

async function loadRedisShopify(): Promise<ShopifySiteConfig | null> {
  if (!redisConfigured()) return null;
  const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  try {
    const res = await fetch(
      `${base}/get/${encodeURIComponent(REDIS_SHOPIFY_KEY)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string | null };
    if (!json.result) return null;
    return normalizeConfig(JSON.parse(json.result) as ShopifySiteConfig);
  } catch {
    return null;
  }
}

async function saveRedisShopify(config: ShopifySiteConfig): Promise<boolean> {
  if (!redisConfigured()) return false;
  const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const payload = JSON.stringify(config);
  try {
    // Upstash REST command form
    const res = await fetch(base, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["SET", REDIS_SHOPIFY_KEY, payload]),
      cache: "no-store",
    });
    if (res.ok) return true;

    // Fallback path style: /set/{key}
    const res2 = await fetch(
      `${base}/set/${encodeURIComponent(REDIS_SHOPIFY_KEY)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );
    return res2.ok;
  } catch {
    return false;
  }
}

async function loadBlobShopify(): Promise<ShopifySiteConfig | null> {
  if (!blobConfigured()) return null;
  const known =
    process.env.BBA_SHOPIFY_BLOB_URL?.trim() ||
    (globalThis as typeof globalThis & { __bba_shopify_blob_url?: string })
      .__bba_shopify_blob_url;
  if (!known) return null;
  try {
    const res = await fetch(
      `${known}${known.includes("?") ? "&" : "?"}cache=0`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return normalizeConfig((await res.json()) as ShopifySiteConfig);
  } catch {
    return null;
  }
}

async function saveBlobShopify(config: ShopifySiteConfig): Promise<boolean> {
  if (!blobConfigured()) return false;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN!;
  try {
    const res = await fetch(
      `https://blob.vercel-storage.com/${BLOB_SHOPIFY_PATH}?access=public&addRandomSuffix=false&allowOverwrite=true`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${blobToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
        cache: "no-store",
      }
    );
    if (!res.ok) return false;
    const json = (await res.json()) as { url?: string };
    if (json.url) {
      (
        globalThis as typeof globalThis & { __bba_shopify_blob_url?: string }
      ).__bba_shopify_blob_url = json.url;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Load Shopify keys from a small dedicated durable slot (not the full catalog).
 * This avoids large-store write failures wiping / missing checkout credentials.
 */
export async function loadDurableShopifyConfig(): Promise<ShopifySiteConfig | null> {
  const [redis, blob] = await Promise.all([
    loadRedisShopify(),
    loadBlobShopify(),
  ]);
  return normalizeConfig({
    ...(blob || {}),
    ...(redis || {}),
    storeDomain: redis?.storeDomain || blob?.storeDomain,
    clientId: redis?.clientId || blob?.clientId,
    clientSecret: redis?.clientSecret || blob?.clientSecret,
    webhookSecret: redis?.webhookSecret || blob?.webhookSecret,
    adminAccessToken: redis?.adminAccessToken || blob?.adminAccessToken,
    apiVersion: redis?.apiVersion || blob?.apiVersion,
    updatedAt:
      (redis?.updatedAt || "") > (blob?.updatedAt || "")
        ? redis?.updatedAt
        : blob?.updatedAt,
    updatedBy: redis?.updatedBy || blob?.updatedBy,
  });
}

export async function saveDurableShopifyConfig(
  input: ShopifySiteConfig
): Promise<{ ok: boolean; config: ShopifySiteConfig | null }> {
  const config = normalizeConfig({
    ...input,
    updatedAt: new Date().toISOString(),
  });
  if (!config) return { ok: false, config: null };

  const results = await Promise.all([
    saveRedisShopify(config),
    saveBlobShopify(config),
  ]);
  // If neither redis nor blob is configured, treat as local-only success when
  // caller also keeps it in the main store — but report false so Ops warns.
  if (!redisConfigured() && !blobConfigured() && !githubToken()) {
    return { ok: false, config };
  }
  return { ok: results.some(Boolean), config };
}
