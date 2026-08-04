"use client";

import { useCallback, useEffect, useState } from "react";

type StatusPayload = {
  ok?: boolean;
  important?: string | null;
  shopify?: {
    configured?: boolean;
    webhookConfigured?: boolean;
    checkoutReady?: boolean;
    authMode?: string;
    configSource?: string;
    storeDomain?: string | null;
    missing?: string[];
    hints?: string[];
  };
  adminApi?: {
    ok?: boolean;
    shopName?: string;
    error?: string;
    scopes?: string;
    canDraftOrders?: boolean;
  } | null;
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
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");

  const [storeDomain, setStoreDomain] = useState(
    "ballards-bowling.myshopify.com"
  );
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [apiVersion, setApiVersion] = useState("2025-01");
  const [hasSavedSecret, setHasSavedSecret] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statusRes, configRes] = await Promise.all([
        fetch("/api/shopify/status", { cache: "no-store" }),
        fetch("/api/shopify/config", {
          cache: "no-store",
          credentials: "same-origin",
        }),
      ]);
      const statusJson = (await statusRes.json()) as StatusPayload;
      setData(statusJson);

      if (configRes.ok) {
        const configJson = await configRes.json();
        const c = configJson.config || {};
        if (c.storeDomain) setStoreDomain(c.storeDomain);
        if (c.clientId) setClientId(c.clientId);
        if (c.apiVersion) setApiVersion(c.apiVersion);
        setHasSavedSecret(Boolean(c.hasClientSecret));
        // Keep secret fields blank after load so we never echo secrets into the UI
        setClientSecret("");
        setWebhookSecret("");
      }
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

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/shopify/config", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeDomain,
          clientId,
          clientSecret: clientSecret || undefined,
          webhookSecret: webhookSecret || clientSecret || undefined,
          apiVersion,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not save Shopify settings");
        setSaving(false);
        return;
      }
      setMessage(json.message || "Saved.");
      setHasSavedSecret(true);
      setClientSecret("");
      setWebhookSecret("");
      await load();
    } catch {
      setError("Could not save Shopify settings");
    }
    setSaving(false);
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
            Paste your Shopify Client ID + Secret here and click Save Connect.
            No Vercel env vars needed if you save here.
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
      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}

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
              : "Not connected yet — fill the form below and click Save Connect."}
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="display text-3xl text-chalk">Save Shopify keys</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="label">Store domain</span>
                <input
                  className="field mt-1"
                  value={storeDomain}
                  onChange={(e) => setStoreDomain(e.target.value)}
                  placeholder="ballards-bowling.myshopify.com"
                />
              </label>
              <label className="block text-sm">
                <span className="label">API version</span>
                <input
                  className="field mt-1"
                  value={apiVersion}
                  onChange={(e) => setApiVersion(e.target.value)}
                  placeholder="2025-01"
                />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="label">
                  Client ID (from Shopify app Credentials — not your login username)
                </span>
                <input
                  className="field mt-1"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="9f9509ec93dde1cab442c14b7176ad08"
                />
              </label>
              <label className="block text-sm">
                <span className="label">
                  Client Secret {hasSavedSecret ? "(saved — leave blank to keep)" : ""}
                </span>
                <input
                  className="field mt-1"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={
                    hasSavedSecret ? "••••••••" : "shpss_9274b7e0..."
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="label">
                  Webhook secret {hasSavedSecret ? "(optional — defaults to Client Secret)" : ""}
                </span>
                <input
                  className="field mt-1"
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="same shpss_... secret"
                />
              </label>
            </div>
            <button
              type="button"
              className="btn btn-primary mt-5"
              disabled={saving || !storeDomain.trim() || !clientId.trim()}
              onClick={() => void save()}
            >
              {saving ? "Saving..." : "Save Connect"}
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] px-5">
            <Row
              ok={Boolean(shopify?.configured)}
              label="Store + Client credentials"
              detail={
                shopify?.storeDomain
                  ? `Store: ${shopify.storeDomain} · source: ${shopify.configSource || "none"}`
                  : "Needs store domain + Client ID/Secret"
              }
            />
            <Row
              ok={Boolean(shopify?.webhookConfigured)}
              label="Webhook secret"
              detail="Used to verify paid-order webhooks"
            />
            <Row
              ok={Boolean(data?.adminApi?.ok)}
              label="Admin API ping"
              detail={
                data?.adminApi?.ok
                  ? `Reached Shopify Admin API${
                      data.adminApi.shopName ? ` (${data.adminApi.shopName})` : ""
                    }`
                  : data?.adminApi?.error || "Cannot reach Shopify until keys are saved"
              }
            />
            <Row
              ok={data?.adminApi?.canDraftOrders !== false}
              label="Draft Orders permission"
              detail={
                data?.adminApi?.canDraftOrders === false
                  ? "Missing write_draft_orders — enable it on the Shopify app scopes"
                  : data?.adminApi?.scopes
                    ? `Scopes: ${data.adminApi.scopes}`
                    : "Needed so cart can open Shopify payment"
              }
            />
          </div>

          {data?.important && (
            <p className="mt-4 rounded-2xl border border-red/40 bg-red/10 px-4 py-3 text-sm text-red-200">
              {data.important}
            </p>
          )}

          <div className="mt-8 space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-mist">
            <h3 className="display text-3xl text-chalk">Webhook URL</h3>
            <p>
              In Shopify, create webhook topic{" "}
              <strong className="text-chalk">orders/paid</strong> to:
            </p>
            <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </>
      )}
    </div>
  );
}
