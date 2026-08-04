"use client";

import { useCallback, useEffect, useState } from "react";

type StatusPayload = {
  ok?: boolean;
  shopify?: {
    configured?: boolean;
    webhookConfigured?: boolean;
    checkoutReady?: boolean;
    storeDomain?: string | null;
    missing?: string[];
    hints?: string[];
  };
  adminApi?: { ok?: boolean; shopName?: string; error?: string } | null;
  webhookUrl?: string;
};

function Row({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-3 text-sm last:border-0">
      <div>
        <p className="font-medium text-chalk">{label}</p>
        {detail ? <p className="mt-1 text-mist">{detail}</p> : null}
      </div>
      <span
        className={
          ok
            ? "rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300"
            : "rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-200"
        }
      >
        {ok ? "Ready" : "Missing"}
      </span>
    </div>
  );
}

export default function OpsShopifyPage() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/shopify/status", { cache: "no-store" });
      const json = (await res.json()) as StatusPayload;
      setData(json);
    } catch {
      setError("Could not load Shopify status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("");
    }
  }

  const shopify = data?.shopify;
  const ready = Boolean(data?.ok && shopify?.checkoutReady);
  const webhookUrl =
    data?.webhookUrl || "https://pro-shop-lemon.vercel.app/api/shopify/webhook";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-4xl">Shopify payments</h2>
          <p className="mt-1 max-w-2xl text-sm text-mist">
            This website owns products and inventory. Shopify only collects payment.
            I cannot put your Shopify token into Vercel for you — add the keys below,
            redeploy, then tap Refresh.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost text-sm"
          onClick={() => void load()}
        >
          Refresh status
        </button>
      </div>

      {loading && <p className="mt-6 text-mist">Checking Shopify...</p>}
      {error && <p className="mt-6 text-sm text-red-300">{error}</p>}

      {!loading && (
        <>
          <div
            className={`mt-6 rounded-3xl border px-5 py-4 text-sm ${
              ready
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                : "border-amber-400/40 bg-amber-400/10 text-amber-100"
            }`}
          >
            {ready
              ? `Connected${data?.adminApi?.shopName ? ` to ${data.adminApi.shopName}` : ""}. Cart will open Shopify checkout.`
              : "Not connected yet. Follow the steps below on Vercel project pro-shop-lemon."}
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] px-5">
            <Row
              ok={Boolean(shopify?.configured)}
              label="Store domain + Admin API token"
              detail={
                shopify?.storeDomain
                  ? `Store: ${shopify.storeDomain}`
                  : "Needs SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN"
              }
            />
            <Row
              ok={Boolean(shopify?.webhookConfigured)}
              label="Webhook secret"
              detail="Needs SHOPIFY_WEBHOOK_SECRET so paid orders update inventory"
            />
            <Row
              ok={Boolean(data?.adminApi?.ok)}
              label="Admin API ping"
              detail={
                data?.adminApi?.ok
                  ? `Reached Shopify Admin API`
                  : data?.adminApi?.error || "Cannot reach Shopify until env vars are set"
              }
            />
          </div>

          <div className="mt-8 space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-mist">
            <h3 className="display text-3xl text-chalk">Connect in 4 steps</h3>
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                Open{" "}
                <a
                  className="text-red underline"
                  href="https://vercel.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                >
                  Vercel Dashboard
                </a>{" "}
                → project <strong className="text-chalk">pro-shop-lemon</strong> →{" "}
                <strong className="text-chalk">Settings → Environment Variables</strong>
              </li>
              <li>
                Add these for Production (+ Preview if shown):
                <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-xs text-chalk">
                  <p>SHOPIFY_STORE_DOMAIN = ballards-bowling.myshopify.com</p>
                  <p>SHOPIFY_ADMIN_ACCESS_TOKEN = shpat_… (from Shopify custom app)</p>
                  <p>SHOPIFY_API_VERSION = 2025-01</p>
                  <p>SHOPIFY_WEBHOOK_SECRET = (Shopify app Client secret)</p>
                  <p>NEXT_PUBLIC_SITE_URL = https://pro-shop-lemon.vercel.app</p>
                </div>
              </li>
              <li>
                In Shopify Admin → custom app scopes:{" "}
                <strong className="text-chalk">write_draft_orders</strong>,{" "}
                <strong className="text-chalk">read_draft_orders</strong>,{" "}
                <strong className="text-chalk">read_orders</strong>. Create webhook topic{" "}
                <strong className="text-chalk">orders/paid</strong> to:
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-chalk">
                    {webhookUrl}
                  </code>
                  <button
                    type="button"
                    className="btn btn-ghost text-xs"
                    onClick={() => void copy(webhookUrl, "webhook")}
                  >
                    {copied === "webhook" ? "Copied" : "Copy URL"}
                  </button>
                </div>
              </li>
              <li>
                Vercel → <strong className="text-chalk">Deployments → … → Redeploy</strong>{" "}
                with build cache <strong className="text-chalk">OFF</strong>. Then click
                Refresh status on this page.
              </li>
            </ol>
            {shopify?.missing?.length ? (
              <p className="text-amber-200">
                Still missing on the server: {shopify.missing.join(", ")}
              </p>
            ) : null}
            <p>
              Do <strong className="text-chalk">not</strong> paste your Admin token in chat.
              Keep the custom Shopify app — do not migrate products into Shopify.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
