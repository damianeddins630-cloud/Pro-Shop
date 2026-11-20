"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OpsPageHeader } from "@/components/ops/OpsUi";

export default function OpsIntegrationsPage() {
  const [shopify, setShopify] = useState<{
    checkoutReady?: boolean;
    configured?: boolean;
    webhookConfigured?: boolean;
  } | null>(null);
  const [sheets, setSheets] = useState<{
    connected?: boolean;
    envReady?: boolean;
    spreadsheetId?: string;
    lastBackupDetail?: string;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const [s, b] = await Promise.all([
        fetch("/api/shopify/status", { cache: "no-store" }),
        fetch("/api/ops/backups", { cache: "no-store" }),
      ]);
      const sj = await s.json().catch(() => ({}));
      const bj = await b.json().catch(() => ({}));
      setShopify(sj.public || sj.shopify || sj);
      setSheets(bj.googleSheets || null);
    })();
  }, []);

  return (
    <div className="ops-dash-grid">
      <OpsPageHeader
        title="Integrations"
        description="Connected services for checkout and backups. Never paste private keys into frontend forms — use Vercel env vars."
      />

      <div className="ops-hub-grid">
        <Link href="/ops/shopify" className="ops-hub-card">
          <h3>Shopify</h3>
          <p>
            Payment checkout via Draft Orders. Website owns catalog prices.
            Status:{" "}
            {shopify?.checkoutReady
              ? "Checkout ready"
              : shopify?.configured
                ? "Configured — finish setup"
                : "Not connected"}
            {shopify?.webhookConfigured ? " · Webhook OK" : " · Webhook needed"}
          </p>
        </Link>
        <Link href="/ops/backups" className="ops-hub-card">
          <h3>Google Sheets</h3>
          <p>
            Backup spreadsheet tabs (Dashboard, Sales, Orders, Coaching,
            Memberships, Customers, Expenses, Inventory, Refunds, Backup Log).
            {sheets?.envReady
              ? " Env credentials detected."
              : " Needs GOOGLE_SHEETS_CLIENT_EMAIL + PRIVATE_KEY in Vercel."}{" "}
            {sheets?.connected ? "Spreadsheet ID saved." : "Not connected yet."}
          </p>
        </Link>
        <div className="ops-hub-card">
          <h3>Payment providers</h3>
          <p>
            Shopify Checkout is the live payment path. Additional processors can
            be added later without changing the durable order database.
          </p>
        </div>
        <div className="ops-hub-card">
          <h3>Durable storage</h3>
          <p>
            Primary database backends: Vercel Blob, Upstash Redis, and/or GitHub
            live-store. Configure in Vercel project env — required before trusting
            production records.
          </p>
        </div>
      </div>
    </div>
  );
}
