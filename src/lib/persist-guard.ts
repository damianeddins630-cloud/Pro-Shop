import { NextResponse } from "next/server";
import {
  discardMemoryStore,
  lastPersistSucceeded,
  storePersistStatus,
} from "@/lib/store";

/**
 * Business-critical mutations must not report success unless durable
 * storage accepted the write (Redis / Blob / GitHub).
 */
export function persistFailedResponse(action = "Save") {
  discardMemoryStore();
  const persist = storePersistStatus();
  return NextResponse.json(
    {
      error: `${action} did not stick in durable storage. Fix Upstash Redis, Vercel Blob, or GITHUB_TOKEN in Vercel project pro-shop-lemon, then try again. Detail: ${persist.lastPersistDetail || "unknown"}`,
      code: "PERSIST_FAILED",
      persist,
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}

export function requireDurablePersistOrLocal() {
  return lastPersistSucceeded();
}

export function withPersistMeta<T extends Record<string, unknown>>(body: T) {
  return {
    ...body,
    persist: storePersistStatus(),
    savedDurably: lastPersistSucceeded(),
  };
}
