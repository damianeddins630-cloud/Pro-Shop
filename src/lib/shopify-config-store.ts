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
    const res = await fetch(base, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["SET", REDIS_SHOPIFY_KEY, payload]),
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json().catch(() => ({}))) as { result?: string };
      if (json.result === "OK" || res.status === 200) return true;
    }
  } catch {
    // continue
  }
  try {
    const res2 = await fetch(
      `${base}/set/${encodeURIComponent(REDIS_SHOPIFY_KEY)}/${encodeURIComponent(payload)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    return res2.ok;
  } catch {
    return false;
  }
}

async function loadBlobShopify(): Promise<ShopifySiteConfig | null> {
  const known =
    process.env.BBA_SHOPIFY_BLOB_URL?.trim() ||
    (globalThis as typeof globalThis & { __bba_shopify_blob_url?: string })
      .__bba_shopify_blob_url;
  if (known) {
    try {
      const res = await fetch(
        `${known}${known.includes("?") ? "&" : "?"}cache=0`,
        { cache: "no-store" }
      );
      if (res.ok) {
        return normalizeConfig((await res.json()) as ShopifySiteConfig);
      }
    } catch {
      // continue
    }
  }

  // Try listing via blob API pathname guess if token exists
  if (!blobConfigured()) return null;
  return null;
}

async function saveBlobShopify(config: ShopifySiteConfig): Promise<boolean> {
  if (!blobConfigured()) return false;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN!;
  const body = JSON.stringify(config);

  // Style A: vercel-storage host with overwrite headers
  try {
    const res = await fetch(
      `https://blob.vercel-storage.com/${BLOB_SHOPIFY_PATH}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${blobToken}`,
          "Content-Type": "application/json",
          "x-vercel-blob-access": "public",
          "x-vercel-blob-allow-overwrite": "true",
        },
        body,
        cache: "no-store",
      }
    );
    if (res.ok) {
      const json = (await res.json()) as { url?: string };
      if (json.url) {
        (
          globalThis as typeof globalThis & { __bba_shopify_blob_url?: string }
        ).__bba_shopify_blob_url = json.url;
      }
      return true;
    }
  } catch {
    // continue
  }

  // Style B: query-param legacy
  try {
    const res = await fetch(
      `https://blob.vercel-storage.com/${BLOB_SHOPIFY_PATH}?access=public&addRandomSuffix=false&allowOverwrite=true`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${blobToken}`,
          "Content-Type": "application/json",
        },
        body,
        cache: "no-store",
      }
    );
    if (res.ok) {
      const json = (await res.json()) as { url?: string };
      if (json.url) {
        (
          globalThis as typeof globalThis & { __bba_shopify_blob_url?: string }
        ).__bba_shopify_blob_url = json.url;
      }
      return true;
    }
  } catch {
    // continue
  }

  // Style C: vercel.com API
  try {
    const res = await fetch(
      `https://vercel.com/api/blob?filename=${encodeURIComponent(BLOB_SHOPIFY_PATH)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${blobToken}`,
          "Content-Type": "application/json",
          "x-vercel-blob-access": "public",
          "x-vercel-blob-allow-overwrite": "true",
        },
        body,
        cache: "no-store",
      }
    );
    if (res.ok) {
      const json = (await res.json()) as { url?: string };
      if (json.url) {
        (
          globalThis as typeof globalThis & { __bba_shopify_blob_url?: string }
        ).__bba_shopify_blob_url = json.url;
      }
      return true;
    }
  } catch {
    // continue
  }

  return false;
}

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
): Promise<{ ok: boolean; config: ShopifySiteConfig | null; detail: string }> {
  const config = normalizeConfig({
    ...input,
    updatedAt: new Date().toISOString(),
  });
  if (!config) return { ok: false, config: null, detail: "invalid_config" };

  const redisOk = await saveRedisShopify(config);
  const blobOk = await saveBlobShopify(config);
  const configured = redisConfigured() || blobConfigured();
  if (!configured) {
    return {
      ok: false,
      config,
      detail: "no_redis_or_blob",
    };
  }
  return {
    ok: redisOk || blobOk,
    config,
    detail: `redis=${redisOk},blob=${blobOk}`,
  };
}
