import type { StoreData } from "@/lib/types";

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
  return redisConfigured() || blobConfigured();
}

export async function loadDurableStore(): Promise<StoreData | null> {
  if (redisConfigured()) {
    const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
    try {
      const res = await fetch(`${base}/get/${encodeURIComponent(REDIS_KEY)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { result?: string | null };
      if (!json.result) return null;
      return JSON.parse(json.result) as StoreData;
    } catch {
      // try blob next
    }
  }

  if (blobConfigured()) {
    const url = process.env.BBA_STORE_BLOB_URL?.trim();
    if (!url) return null;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as StoreData;
    } catch {
      return null;
    }
  }

  return null;
}

export async function saveDurableStore(data: StoreData): Promise<boolean> {
  let ok = false;
  const payload = JSON.stringify(data);

  if (redisConfigured()) {
    const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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

  if (blobConfigured()) {
    const token = process.env.BLOB_READ_WRITE_TOKEN!;
    try {
      const res = await fetch(
        `https://blob.vercel-storage.com/${BLOB_PATHNAME}?access=public&addRandomSuffix=false&allowOverwrite=true`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
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
          // url is returned each time; env BBA_STORE_BLOB_URL can be set once from first save
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
