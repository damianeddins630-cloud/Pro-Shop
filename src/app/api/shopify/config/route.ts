import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import {
  getShopifyConfig,
  saveShopifyConfig,
  storePersistStatus,
} from "@/lib/store";
import {
  loadShopifyRuntimeConfig,
  pingShopifyAdmin,
  shopifyStatus,
} from "@/lib/shopify";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

function mask(value?: string) {
  const v = (value || "").trim();
  if (!v) return "";
  if (v.length <= 8) return "••••••••";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export async function GET() {
  const session = await requireAnyPermission(
    "manage_roles",
    "manage_users",
    "manage_inventory"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const saved = await getShopifyConfig();
  await loadShopifyRuntimeConfig();
  const status = shopifyStatus();

  return NextResponse.json(
    {
      config: {
        storeDomain: saved?.storeDomain || "",
        clientId: saved?.clientId || "",
        clientSecretMasked: mask(saved?.clientSecret),
        webhookSecretMasked: mask(saved?.webhookSecret),
        apiVersion: saved?.apiVersion || "2025-01",
        hasClientSecret: Boolean(saved?.clientSecret),
        hasWebhookSecret: Boolean(saved?.webhookSecret),
        updatedAt: saved?.updatedAt || null,
        updatedBy: saved?.updatedBy || null,
      },
      status,
    },
    { headers: noStore }
  );
}

const schema = z.object({
  storeDomain: z.string().min(3),
  clientId: z.string().min(8),
  clientSecret: z.string().optional(),
  webhookSecret: z.string().optional(),
  apiVersion: z.string().optional(),
});

export async function PUT(req: Request) {
  const session = await requireAnyPermission(
    "manage_roles",
    "manage_users",
    "manage_inventory"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    const existing = await getShopifyConfig();

    const clientId = body.clientId.trim();
    if (
      clientId.toLowerCase() === "cv_damian" ||
      clientId.includes("@") ||
      clientId.length < 16
    ) {
      return NextResponse.json(
        {
          error:
            "Client ID looks wrong. Use the Shopify app Client ID (long hex like 9f9509ec...), not your website login username.",
        },
        { status: 400 }
      );
    }

    const clientSecret =
      body.clientSecret?.trim() || existing?.clientSecret || "";
    const webhookSecret =
      body.webhookSecret?.trim() ||
      existing?.webhookSecret ||
      clientSecret;

    if (!clientSecret) {
      return NextResponse.json(
        { error: "Client Secret is required the first time you save." },
        { status: 400 }
      );
    }
    if (!clientSecret.startsWith("shpss_") && !clientSecret.startsWith("shpat_")) {
      return NextResponse.json(
        {
          error:
            "Client Secret should start with shpss_ (from Shopify app Credentials).",
        },
        { status: 400 }
      );
    }

    const saved = await saveShopifyConfig(
      {
        storeDomain: body.storeDomain,
        clientId,
        clientSecret,
        webhookSecret,
        apiVersion: body.apiVersion || "2025-01",
      },
      { updatedBy: session.username }
    );

    await loadShopifyRuntimeConfig();
    const ping = await pingShopifyAdmin();
    const status = shopifyStatus();
    const persist = storePersistStatus();

    const persistDetail = (
      saved as { _persistDetail?: string }
    )._persistDetail;

    return NextResponse.json(
      {
        ok: Boolean(ping.ok),
        saved: {
          storeDomain: saved.storeDomain,
          clientId: saved.clientId,
          apiVersion: saved.apiVersion,
          updatedAt: saved.updatedAt,
        },
        status,
        adminApi: ping,
        persist: { ...persist, detail: persistDetail },
        message: ping.ok
          ? `Connected to ${ping.shopName || "Shopify"}. Tap Refresh status.`
          : ping.error || "Saved, but Shopify ping failed.",
      },
      { headers: noStore }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 400 }
    );
  }
}
