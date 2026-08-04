import type { StoreData } from "@/lib/types";
import {
  githubWriteConfigured,
  loadGithubStore,
  saveGithubStore,
} from "@/lib/github-store";

const REDIS_KEY = "bba:store:v1";
const BLOB_PATHNAME = "bba-store.json";

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
  // GitHub public live-store is always readable; writes need token/redis/blob
  return true;
}

export function durableWriteConfigured() {
  return redisConfigured() || blobConfigured() || githubWriteConfigured();
}

/** Load full store JSON from GitHub / Upstash / Blob. */
export async function loadDurableStore(): Promise<StoreData | null> {
  // Prefer Redis when configured (fastest)
  if (redisConfigured()) {
    const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN!;
    try {
      const res = await fetch(`${base}/get/${encodeURIComponent(REDIS_KEY)}`, {
        headers: { Authorization: `Bearer ${redisToken}` },
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as { result?: string | null };
        if (json.result) return JSON.parse(json.result) as StoreData;
      }
    } catch {
      // continue
    }
  }

  // GitHub live-store (public read — keeps shop + accounts in sync)
  const fromGh = await loadGithubStore();
  // Accept GitHub store even when products are empty — users/orders still matter
  if (fromGh) return fromGh;

  if (blobConfigured()) {
    const url =
      process.env.BBA_STORE_BLOB_URL?.trim() ||
      (globalThis as typeof globalThis & { __bba_blob_url?: string }).__bba_blob_url;
    if (url) {
      try {
        const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}cache=0`, {
          cache: "no-store",
        });
        if (res.ok) return (await res.json()) as StoreData;
      } catch {
        // continue
      }
    }
  }

  return null;
}

/** Persist full store JSON to available backends. */
export async function saveDurableStore(data: StoreData): Promise<boolean> {
  let ok = false;
  const payload = JSON.stringify(data);

  if (redisConfigured()) {
    const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN!;
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["SET", REDIS_KEY, payload]),
        cache: "no-store",
      });
      ok = res.ok || ok;
    } catch {
      // continue
    }
  }

  // Always try GitHub when a write token exists (keeps shop updated for everyone)
  if (githubWriteConfigured()) {
    const ghOk = await saveGithubStore(data);
    ok = ghOk || ok;
  }

  if (blobConfigured()) {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN!;
    try {
      const res = await fetch(
        `https://blob.vercel-storage.com/${BLOB_PATHNAME}?access=public&addRandomSuffix=false&allowOverwrite=true`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${blobToken}`,
            "Content-Type": "application/json",
          },
          body: payload,
          cache: "no-store",
        }
      );
      if (res.ok) {
        ok = true;
        const json = (await res.json()) as { url?: string };
        if (json.url) {
          (globalThis as typeof globalThis & { __bba_blob_url?: string }).__bba_blob_url =
            json.url;
        }
      }
    } catch {
      // ignore
    }
  }

  return ok;
}
