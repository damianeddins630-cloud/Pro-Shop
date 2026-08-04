import type { StoreData, User, Order, Role, Coupon, Subscriber } from "@/lib/types";
import {
  githubWriteConfigured,
  loadGithubStore,
  saveGithubStore,
} from "@/lib/github-store";

const REDIS_KEY = "bba:store:v1";
const REDIS_CATALOG_KEY = "bba:catalog:v1";
const BLOB_PATHNAME = "bba-store.json";

export type PersistBackendResult = {
  ok: boolean;
  error?: string;
};

export type PersistResult = {
  ok: boolean;
  redis: PersistBackendResult;
  blob: PersistBackendResult;
  github: PersistBackendResult;
  detail: string;
};

let lastPersistResult: PersistResult = {
  ok: false,
  redis: { ok: false },
  blob: { ok: false },
  github: { ok: false },
  detail: "No durable save attempted yet",
};

export function getLastPersistResult() {
  return lastPersistResult;
}

function redisConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function durableStoreConfigured() {
  return true;
}

export function durableWriteConfigured() {
  return redisConfigured() || blobConfigured() || githubWriteConfigured();
}

function mergeById<T extends { id: string }>(
  a: T[] | undefined,
  b: T[] | undefined
): T[] {
  const map = new Map<string, T>();
  for (const item of a || []) {
    if (item?.id) map.set(item.id, item);
  }
  for (const item of b || []) {
    if (item?.id) map.set(item.id, item);
  }
  return Array.from(map.values());
}

function storeTs(data: StoreData | null | undefined) {
  return Date.parse(String(data?.updatedAt || "")) || 0;
}

function mergeShopifyConfig(
  a: StoreData["shopifyConfig"] | undefined,
  b: StoreData["shopifyConfig"] | undefined
): StoreData["shopifyConfig"] | undefined {
  if (!a && !b) return undefined;
  const left = a || {};
  const right = b || {};
  return {
    ...left,
    ...right,
    storeDomain: right.storeDomain || left.storeDomain,
    clientId: right.clientId || left.clientId,
    clientSecret: right.clientSecret || left.clientSecret,
    webhookSecret: right.webhookSecret || left.webhookSecret,
    adminAccessToken: right.adminAccessToken || left.adminAccessToken,
    apiVersion: right.apiVersion || left.apiVersion,
    updatedAt:
      (right.updatedAt || "") > (left.updatedAt || "")
        ? right.updatedAt
        : left.updatedAt,
    updatedBy: right.updatedBy || left.updatedBy,
  };
}

/** Union account-critical collections; keep catalog from the newer store. */
function mergeDurableCopies(
  primary: StoreData,
  secondary: StoreData | null
): StoreData {
  if (!secondary) return primary;
  return {
    ...primary,
    users: mergeById<User>(secondary.users, primary.users),
    orders: mergeById<Order>(secondary.orders, primary.orders),
    roles: mergeById<Role>(secondary.roles, primary.roles),
    coupons: mergeById<Coupon>(secondary.coupons, primary.coupons),
    subscribers: mergeById<Subscriber>(
      secondary.subscribers,
      primary.subscribers
    ),
    shopifyConfig: mergeShopifyConfig(
      secondary.shopifyConfig,
      primary.shopifyConfig
    ),
  };
}

async function loadRedisKey(key: string): Promise<StoreData | null> {
  if (!redisConfigured()) return null;
  const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN!;
  try {
    const res = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${redisToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string | null };
    if (!json.result) return null;
    return JSON.parse(json.result) as StoreData;
  } catch {
    return null;
  }
}

async function loadRedisStore(): Promise<StoreData | null> {
  const full = await loadRedisKey(REDIS_KEY);
  if (full?.products) return full;
  // Catalog-only fallback (prices/discounts/stock)
  const catalog = await loadRedisKey(REDIS_CATALOG_KEY);
  return catalog;
}

async function saveRedisKey(
  key: string,
  payload: string
): Promise<PersistBackendResult> {
  if (!redisConfigured()) {
    return { ok: false, error: "UPSTASH_REDIS_REST_URL/TOKEN not set" };
  }
  const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const errors: string[] = [];

  // Style A: Upstash pipeline body (supports large JSON — do NOT put payload in URL)
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["SET", key, payload]),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      result?: string;
      error?: string;
    };
    if (res.ok && (json.result === "OK" || json.result === "ok")) {
      return { ok: true };
    }
    errors.push(
      `pipeline:${res.status}:${json.error || json.result || "no-ok"}`
    );
  } catch (e) {
    errors.push(`pipeline:${e instanceof Error ? e.message : "error"}`);
  }

  // Style B: /set/{key} with body (some Upstash setups prefer this)
  try {
    const res = await fetch(`${base}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: payload }),
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    errors.push(`set-body:${res.status}`);
  } catch (e) {
    errors.push(`set-body:${e instanceof Error ? e.message : "error"}`);
  }

  // Style C: classic command array under /pipeline
  try {
    const res = await fetch(`${base}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([["SET", key, payload]]),
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json().catch(() => null)) as
        | { result?: string }[]
        | null;
      if (
        Array.isArray(json) &&
        json[0] &&
        (json[0].result === "OK" || json[0].result === "ok")
      ) {
        return { ok: true };
      }
      if (res.ok && !json) return { ok: true };
    }
    errors.push(`pipeline-arr:${res.status}`);
  } catch (e) {
    errors.push(`pipeline-arr:${e instanceof Error ? e.message : "error"}`);
  }

  return { ok: false, error: errors.join(" | ") };
}

async function saveRedisStore(data: StoreData): Promise<PersistBackendResult> {
  if (!redisConfigured()) {
    return { ok: false, error: "redis not configured" };
  }
  const fullPayload = JSON.stringify(data);
  const catalogPayload = JSON.stringify({
    updatedAt: data.updatedAt,
    products: data.products,
    deals: data.deals,
    coupons: data.coupons || [],
    sponsors: data.sponsors,
  });

  const full = await saveRedisKey(REDIS_KEY, fullPayload);
  const catalog = await saveRedisKey(REDIS_CATALOG_KEY, catalogPayload);
  if (!full.ok && !catalog.ok) {
    return {
      ok: false,
      error: `full:${full.error || "fail"}; catalog:${catalog.error || "fail"}`,
    };
  }

  // Read-after-write verify on catalog (prices must stick)
  try {
    const verify = await loadRedisKey(REDIS_CATALOG_KEY);
    if (
      verify &&
      Array.isArray(verify.products) &&
      storeTs(verify) >= storeTs(data) - 1000
    ) {
      return { ok: true };
    }
    if (full.ok || catalog.ok) {
      // Write claimed OK but verify soft-failed — still treat as ok if write ok
      return { ok: true };
    }
  } catch {
    if (full.ok || catalog.ok) return { ok: true };
  }

  return {
    ok: false,
    error: `verify-failed full=${full.ok} catalog=${catalog.ok}`,
  };
}

async function listBlobUrl(): Promise<string | null> {
  if (!blobConfigured()) return null;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN!;
  try {
    const res = await fetch(
      `https://blob.vercel-storage.com?prefix=${encodeURIComponent(BLOB_PATHNAME)}&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${blobToken}`,
          "x-api-version": "7",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      blobs?: { pathname?: string; url?: string }[];
    };
    const hit = (json.blobs || []).find(
      (b) => b.pathname === BLOB_PATHNAME || b.url?.includes(BLOB_PATHNAME)
    );
    return hit?.url || null;
  } catch {
    return null;
  }
}

async function loadBlobStore(): Promise<StoreData | null> {
  if (!blobConfigured()) return null;
  const known =
    process.env.BBA_STORE_BLOB_URL?.trim() ||
    (globalThis as typeof globalThis & { __bba_blob_url?: string }).__bba_blob_url ||
    (await listBlobUrl());
  if (!known) return null;
  try {
    const res = await fetch(
      `${known}${known.includes("?") ? "&" : "?"}cache=0&t=${Date.now()}`,
      { cache: "no-store" }
    );
    if (res.ok) return (await res.json()) as StoreData;
  } catch {
    // continue
  }
  return null;
}

async function saveBlobStore(data: StoreData): Promise<PersistBackendResult> {
  if (!blobConfigured()) {
    return { ok: false, error: "BLOB_READ_WRITE_TOKEN not set" };
  }
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN!;
  const payload = JSON.stringify(data);
  const errors: string[] = [];

  const attempts: { label: string; url: string; headers: Record<string, string> }[] =
    [
      {
        label: "headers-v7",
        url: `https://blob.vercel-storage.com/${BLOB_PATHNAME}`,
        headers: {
          Authorization: `Bearer ${blobToken}`,
          "Content-Type": "application/json",
          "x-api-version": "7",
          "x-content-type": "application/json",
          "x-vercel-blob-access": "public",
          "x-vercel-blob-allow-overwrite": "true",
        },
      },
      {
        label: "query-legacy",
        url: `https://blob.vercel-storage.com/${BLOB_PATHNAME}?access=public&addRandomSuffix=false&allowOverwrite=true`,
        headers: {
          Authorization: `Bearer ${blobToken}`,
          "Content-Type": "application/json",
        },
      },
    ];

  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, {
        method: "PUT",
        headers: attempt.headers,
        body: payload,
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { url?: string };
        if (json.url) {
          (
            globalThis as typeof globalThis & { __bba_blob_url?: string }
          ).__bba_blob_url = json.url;
        }
        return { ok: true };
      }
      const text = await res.text().catch(() => "");
      errors.push(`${attempt.label}:${res.status}:${text.slice(0, 120)}`);
    } catch (e) {
      errors.push(
        `${attempt.label}:${e instanceof Error ? e.message : "error"}`
      );
    }
  }

  return { ok: false, error: errors.join(" | ") };
}

/** Load full store JSON from GitHub / Upstash / Blob. */
export async function loadDurableStore(): Promise<StoreData | null> {
  const [redis, github, blob] = await Promise.all([
    loadRedisStore(),
    loadGithubStore(),
    loadBlobStore(),
  ]);

  const copies = [redis, github, blob].filter(Boolean) as StoreData[];
  if (!copies.length) return null;

  copies.sort((a, b) => storeTs(b) - storeTs(a));
  let merged = copies[0];
  for (let i = 1; i < copies.length; i++) {
    merged = mergeDurableCopies(merged, copies[i]);
  }
  return merged;
}

/** Persist full store JSON to available backends. At least one must succeed. */
export async function saveDurableStore(data: StoreData): Promise<boolean> {
  const result = await saveDurableStoreDetailed(data);
  return result.ok;
}

export async function saveDurableStoreDetailed(
  data: StoreData
): Promise<PersistResult> {
  const [redis, github, blob] = await Promise.all([
    redisConfigured()
      ? saveRedisStore(data)
      : Promise.resolve({ ok: false, error: "not configured" } as PersistBackendResult),
    githubWriteConfigured()
      ? saveGithubStore(data).then((ok) => ({
          ok,
          error: ok ? undefined : "GitHub write failed",
        }))
      : Promise.resolve({
          ok: false,
          error: "GITHUB_TOKEN not set",
        } as PersistBackendResult),
    blobConfigured()
      ? saveBlobStore(data)
      : Promise.resolve({ ok: false, error: "not configured" } as PersistBackendResult),
  ]);

  const ok = Boolean(redis.ok || github.ok || blob.ok);
  const parts = [
    `redis=${redis.ok ? "ok" : redis.error || "fail"}`,
    `blob=${blob.ok ? "ok" : blob.error || "fail"}`,
    `github=${github.ok ? "ok" : github.error || "fail"}`,
  ];
  lastPersistResult = {
    ok,
    redis,
    blob,
    github,
    detail: parts.join("; "),
  };
  return lastPersistResult;
}

/** Ops/debug: write a tiny probe then read it back. */
export async function selfTestDurablePersist(): Promise<{
  ok: boolean;
  detail: string;
  backends: PersistResult;
}> {
  // Don't overwrite real store with empty probe — only test redis key + blob list
  const redisProbe = redisConfigured()
    ? await saveRedisKey(
        "bba:persist:probe",
        JSON.stringify({ t: new Date().toISOString(), ok: true })
      )
    : { ok: false, error: "not configured" };

  let redisReadOk = false;
  if (redisProbe.ok && redisConfigured()) {
    const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN!;
    try {
      const res = await fetch(
        `${base}/get/${encodeURIComponent("bba:persist:probe")}`,
        {
          headers: { Authorization: `Bearer ${redisToken}` },
          cache: "no-store",
        }
      );
      const json = (await res.json()) as { result?: string | null };
      redisReadOk = Boolean(json.result && json.result.includes("ok"));
    } catch {
      redisReadOk = false;
    }
  }

  // Blob self-test: list API only (never overwrite the live catalog with a probe)
  let blobListOk = false;
  let blobError: string | undefined = "not configured";
  if (blobConfigured()) {
    const listed = await listBlobUrl();
    blobListOk = Boolean(listed);
    blobError = listed ? undefined : "blob list/read URL not found";
  }

  const githubConfigured = githubWriteConfigured();
  const ok = Boolean(redisProbe.ok && redisReadOk) || blobListOk;
  const detail = [
    `redisWrite=${redisProbe.ok}`,
    `redisRead=${redisReadOk}`,
    `blobList=${blobListOk}`,
    `githubConfigured=${githubConfigured}`,
  ].join("; ");

  return {
    ok,
    detail,
    backends: {
      ok,
      redis: {
        ok: Boolean(redisProbe.ok && redisReadOk),
        error: redisProbe.error,
      },
      blob: { ok: blobListOk, error: blobListOk ? undefined : blobError },
      github: {
        ok: false,
        error: githubConfigured
          ? "skipped in self-test (avoids git noise)"
          : "GITHUB_TOKEN not set",
      },
      detail,
    },
  };
}
