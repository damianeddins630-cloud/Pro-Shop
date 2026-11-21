import { SignJWT, importPKCS8 } from "jose";
import type {
  BackupAttempt,
  CoachingBooking,
  CoachingPackage,
  Expense,
  Membership,
  Order,
  Product,
  StoreData,
  User,
} from "@/lib/types";
import { isPurchasedOrder } from "@/lib/order-status";
import {
  businessRevenueSnapshot,
  getGoogleSheetsConfig,
  getStore,
  listAllOrdersForOps,
  listBackupAttempts,
  listProducts,
  listUsers,
  recordBackupAttempt,
  updateGoogleSheetsConfig,
} from "@/lib/store";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const SHEET_TABS = [
  "Dashboard",
  "Sales",
  "Orders",
  "Coaching",
  "Memberships",
  "Customers",
  "Expenses",
  "Inventory",
  "Refunds",
  "Backup Log",
] as const;

export type SheetTab = (typeof SHEET_TABS)[number];

export function googleSheetsEnvReady() {
  return Boolean(
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim() &&
      process.env.GOOGLE_SHEETS_PRIVATE_KEY?.trim()
  );
}

function privateKeyPem() {
  return (process.env.GOOGLE_SHEETS_PRIVATE_KEY || "")
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");
}

function clientEmail() {
  return (process.env.GOOGLE_SHEETS_CLIENT_EMAIL || "").trim();
}

let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 60_000) {
    return cachedToken.token;
  }
  if (!googleSheetsEnvReady()) {
    throw new Error(
      "Missing GOOGLE_SHEETS_CLIENT_EMAIL or GOOGLE_SHEETS_PRIVATE_KEY"
    );
  }
  const key = await importPKCS8(privateKeyPem(), "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({
    scope: SCOPES.join(" "),
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail())
    .setSubject(clientEmail())
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Google OAuth token failed"
    );
  }
  cachedToken = {
    token: data.access_token,
    exp: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return data.access_token;
}

async function sheetsFetch(path: string, init?: RequestInit) {
  const token = await getAccessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = json as { error?: { message?: string } };
    throw new Error(err?.error?.message || `Sheets API ${res.status}`);
  }
  return json;
}

export async function verifyGoogleSheetsConnection(spreadsheetId: string) {
  if (!spreadsheetId.trim()) {
    return { ok: false as const, detail: "Spreadsheet ID is required" };
  }
  if (!googleSheetsEnvReady()) {
    return {
      ok: false as const,
      detail:
        "Set GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY in Vercel",
    };
  }
  try {
    const meta = (await sheetsFetch(
      `/spreadsheets/${encodeURIComponent(spreadsheetId.trim())}?fields=spreadsheetId,properties.title,sheets.properties.title`
    )) as {
      spreadsheetId: string;
      properties?: { title?: string };
      sheets?: { properties?: { title?: string } }[];
    };
    return {
      ok: true as const,
      detail: `Verified access to “${meta.properties?.title || spreadsheetId}”`,
      title: meta.properties?.title || "",
      tabs: (meta.sheets || [])
        .map((s) => s.properties?.title || "")
        .filter(Boolean),
    };
  } catch (e) {
    return {
      ok: false as const,
      detail: e instanceof Error ? e.message : "Verification failed",
    };
  }
}

async function ensureTabs(spreadsheetId: string) {
  const meta = (await sheetsFetch(
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`
  )) as {
    sheets?: { properties?: { title?: string; sheetId?: number } }[];
  };
  const existing = new Set(
    (meta.sheets || []).map((s) => s.properties?.title || "")
  );
  const requests = SHEET_TABS.filter((t) => !existing.has(t)).map((title) => ({
    addSheet: { properties: { title } },
  }));
  if (requests.length) {
    await sheetsFetch(`/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests }),
    });
  }
}

async function writeTable(
  spreadsheetId: string,
  tab: SheetTab,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
) {
  // Clear then write — upsert by rewriting full tab from source of truth (durable DB).
  await sheetsFetch(
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(
      `${tab}!A:ZZ`
    )}:clear`,
    { method: "POST", body: "{}" }
  );
  const values = [
    headers,
    ...rows.map((r) =>
      r.map((c) => {
        if (c === null || c === undefined) return "";
        if (typeof c === "boolean") return c ? "TRUE" : "FALSE";
        return c;
      })
    ),
  ];
  await sheetsFetch(
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(
      `${tab}!A1`
    )}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({ range: `${tab}!A1`, majorDimension: "ROWS", values }),
    }
  );
  return values.length - 1;
}

function money(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function buildRows(store: StoreData, orders: Order[], products: Product[], users: User[]) {
  const paid = orders.filter(isPurchasedOrder);

  const salesHeaders = [
    "id",
    "createdAt",
    "customer",
    "email",
    "total",
    "subtotal",
    "discount",
    "tax",
    "refundAmount",
    "status",
    "paymentProvider",
    "coupon",
  ];
  const salesRows = paid.map((o) => [
    o.id,
    o.createdAt,
    o.username,
    o.email,
    money(o.total),
    money(o.subtotal || 0),
    money(o.discountAmount || 0),
    money(o.taxAmount || 0),
    money(o.refundAmount || 0),
    o.status,
    o.paymentProvider || "",
    o.couponCode || "",
  ]);

  const orderHeaders = [
    "orderId",
    "line",
    "productId",
    "productName",
    "qty",
    "unitPrice",
    "weight",
    "createdAt",
  ];
  const orderRows: (string | number)[][] = [];
  for (const o of paid) {
    (o.items || []).forEach((item, i) => {
      orderRows.push([
        o.id,
        i + 1,
        item.productId,
        item.name,
        item.quantity,
        money(item.price),
        item.weight ?? "",
        o.createdAt,
      ]);
    });
  }

  const coachingHeaders = [
    "id",
    "type",
    "customer",
    "email",
    "coach",
    "title",
    "date",
    "start",
    "end",
    "price",
    "paymentStatus",
    "bookingStatus",
    "revenueCollected",
  ];
  const coachingRows = [
    ...(store.coachingBookings || []).map((b: CoachingBooking) => [
      b.id,
      "booking",
      b.customerName,
      b.customerEmail || "",
      b.coachName,
      b.title,
      b.date,
      b.startTime,
      b.endTime,
      money(b.price),
      b.paymentStatus,
      b.bookingStatus,
      Boolean(b.revenueCollected || b.paymentStatus === "paid"),
    ]),
    ...(store.coachingPackages || []).map((p: CoachingPackage) => [
      p.id,
      "package",
      p.customerName,
      p.customerEmail || "",
      "",
      p.name,
      "",
      "",
      "",
      money(p.price),
      p.paymentStatus,
      `${p.sessionsUsed}/${p.sessionsPurchased}`,
      Boolean(p.revenueCollected || p.paymentStatus === "paid"),
    ]),
  ];

  const membershipHeaders = [
    "id",
    "customer",
    "email",
    "name",
    "type",
    "price",
    "billing",
    "status",
    "paymentStatus",
    "startDate",
    "renewalDate",
    "revenueCollected",
  ];
  const membershipRows = (store.memberships || []).map((m: Membership) => [
    m.id,
    m.customerName,
    m.customerEmail || "",
    m.name,
    m.membershipType,
    money(m.price),
    m.billingFrequency,
    m.status,
    m.paymentStatus,
    m.startDate,
    m.renewalDate || "",
    Boolean(m.revenueCollected || m.paymentStatus === "paid"),
  ]);

  const customerHeaders = [
    "id",
    "username",
    "email",
    "phone",
    "roleId",
    "createdAt",
  ];
  const customerRows = users
    .filter((u) => u.id !== "user_owner")
    .map((u) => [
      u.id,
      u.username,
      u.email,
      u.phoneNumber || "",
      u.roleId,
      u.createdAt || "",
    ]);

  const expenseHeaders = ["id", "date", "category", "label", "amount", "notes", "createdAt"];
  const expenseRows = (store.expenses || []).map((e: Expense) => [
    e.id,
    e.date,
    e.category,
    e.label,
    money(e.amount),
    e.notes || "",
    e.createdAt,
  ]);

  const inventoryHeaders = [
    "id",
    "name",
    "sku",
    "upc",
    "category",
    "brand",
    "price",
    "cost",
    "discountPercent",
    "stock",
    "lowStockThreshold",
    "supplier",
    "active",
    "valuationAtCost",
    "valuationAtPrice",
  ];
  const inventoryRows = products.map((p) => {
    const cost = Math.max(0, Number(p.cost) || 0);
    const price = Math.max(0, Number(p.price) || 0);
    const stock = Math.max(0, Number(p.stock) || 0);
    return [
      p.id,
      p.name,
      p.sku || "",
      p.upc || "",
      p.category,
      p.brand,
      money(price),
      money(cost),
      Number(p.discountPercent) || 0,
      stock,
      p.lowStockThreshold ?? 3,
      p.supplier || "",
      Boolean(p.active),
      money(cost * stock),
      money(price * stock),
    ];
  });

  const refundHeaders = [
    "id",
    "orderId",
    "amount",
    "status",
    "reason",
    "provider",
    "providerRefundId",
    "inventoryRestored",
    "createdAt",
    "completedAt",
    "createdBy",
  ];
  const refundRows = (store.refunds || []).map((r) => [
    r.id,
    r.orderId,
    money(r.amount),
    r.status,
    r.reason,
    r.provider,
    r.providerRefundId || "",
    Boolean(r.inventoryRestored),
    r.createdAt,
    r.completedAt || "",
    r.createdBy || "",
  ]);

  return {
    salesHeaders,
    salesRows,
    orderHeaders,
    orderRows,
    coachingHeaders,
    coachingRows,
    membershipHeaders,
    membershipRows,
    customerHeaders,
    customerRows,
    expenseHeaders,
    expenseRows,
    inventoryHeaders,
    inventoryRows,
    refundHeaders,
    refundRows,
  };
}

export type SheetsSyncResult = {
  ok: boolean;
  detail: string;
  recordCounts: Record<string, number>;
  verified: boolean;
};

/**
 * Full reconciliation backup: durable store → Sheets tabs.
 * Rewrites each tab from source of truth (unique IDs in column A).
 */
export async function syncBusinessToGoogleSheets(opts?: {
  actorName?: string;
  spreadsheetId?: string;
}): Promise<SheetsSyncResult> {
  const cfg = await getGoogleSheetsConfig();
  const spreadsheetId = (
    opts?.spreadsheetId ||
    cfg.spreadsheetId ||
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
    ""
  ).trim();

  const emptyCounts = {
    sales: 0,
    orders: 0,
    coaching: 0,
    memberships: 0,
    customers: 0,
    expenses: 0,
    inventory: 0,
    refunds: 0,
  };

  if (!spreadsheetId) {
    return {
      ok: false,
      verified: false,
      detail: "No spreadsheet ID configured",
      recordCounts: emptyCounts,
    };
  }
  if (!googleSheetsEnvReady()) {
    return {
      ok: false,
      verified: false,
      detail:
        "Sheets credentials missing. Add GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY in Vercel.",
      recordCounts: emptyCounts,
    };
  }

  const verified = await verifyGoogleSheetsConnection(spreadsheetId);
  if (!verified.ok) {
    await updateGoogleSheetsConfig({
      spreadsheetId,
      connected: false,
      lastBackupOk: false,
      lastBackupDetail: verified.detail,
    });
    return {
      ok: false,
      verified: false,
      detail: verified.detail,
      recordCounts: emptyCounts,
    };
  }

  try {
    await ensureTabs(spreadsheetId);
    const [store, orders, products, users, biz, backups] = await Promise.all([
      getStore(),
      listAllOrdersForOps(),
      listProducts({ includeInactive: true }),
      listUsers(),
      businessRevenueSnapshot(),
      listBackupAttempts(20),
    ]);
    const built = buildRows(store, orders, products, users);

    const dashHeaders = ["metric", "value", "asOf"];
    const asOf = new Date().toISOString();
    const dashRows = [
      ["shop_paid_orders", built.salesRows.length, asOf],
      ["coaching_revenue_collected", biz.coachingRevenue, asOf],
      ["membership_revenue_collected", biz.membershipRevenue, asOf],
      ["expenses_total", biz.expensesTotal, asOf],
      ["active_memberships", biz.activeMemberships, asOf],
      ["inventory_skus", products.length, asOf],
    ];

    const logHeaders = ["id", "at", "status", "destination", "detail"];
    const logRows = (backups as BackupAttempt[]).map((b) => [
      b.id,
      b.at,
      b.status,
      b.destination,
      b.detail,
    ]);

    const counts = {
      sales: await writeTable(spreadsheetId, "Sales", built.salesHeaders, built.salesRows),
      orders: await writeTable(spreadsheetId, "Orders", built.orderHeaders, built.orderRows),
      coaching: await writeTable(
        spreadsheetId,
        "Coaching",
        built.coachingHeaders,
        built.coachingRows
      ),
      memberships: await writeTable(
        spreadsheetId,
        "Memberships",
        built.membershipHeaders,
        built.membershipRows
      ),
      customers: await writeTable(
        spreadsheetId,
        "Customers",
        built.customerHeaders,
        built.customerRows
      ),
      expenses: await writeTable(
        spreadsheetId,
        "Expenses",
        built.expenseHeaders,
        built.expenseRows
      ),
      inventory: await writeTable(
        spreadsheetId,
        "Inventory",
        built.inventoryHeaders,
        built.inventoryRows
      ),
      refunds: await writeTable(
        spreadsheetId,
        "Refunds",
        built.refundHeaders,
        built.refundRows
      ),
    };
    await writeTable(spreadsheetId, "Dashboard", dashHeaders, dashRows);
    await writeTable(spreadsheetId, "Backup Log", logHeaders, logRows);

    const detail = `Synced ${Object.values(counts).reduce((a, b) => a + b, 0)} rows across ${SHEET_TABS.length} tabs`;
    await updateGoogleSheetsConfig({
      spreadsheetId,
      spreadsheetName:
        verified.title ||
        cfg.spreadsheetName ||
        "Ballard's Bowling Academy — Business Management & Backup",
      connected: true,
      lastBackupAt: asOf,
      lastBackupOk: true,
      lastBackupDetail: detail,
      serviceAccountEmail: clientEmail(),
    });

    await recordBackupAttempt({
      status: "success",
      destination: "google_sheets",
      detail,
      recordCounts: counts,
      actorName: opts?.actorName,
    });

    return { ok: true, verified: true, detail, recordCounts: counts };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Sheets sync failed";
    await updateGoogleSheetsConfig({
      spreadsheetId,
      connected: false,
      lastBackupOk: false,
      lastBackupDetail: detail,
    });
    await recordBackupAttempt({
      status: "failed",
      destination: "google_sheets",
      detail,
      recordCounts: emptyCounts,
      actorName: opts?.actorName,
    });
    return { ok: false, verified: true, detail, recordCounts: emptyCounts };
  }
}

/** Re-run the latest queued backup attempts (best-effort). */
export async function retryQueuedGoogleSheetBackups(opts?: {
  actorName?: string;
}) {
  const attempts = await listBackupAttempts(30);
  const queued = attempts.filter(
    (a) => a.destination === "google_sheets" && a.status === "queued"
  );
  if (!queued.length) {
    return { retried: 0, result: null as SheetsSyncResult | null };
  }
  const result = await syncBusinessToGoogleSheets(opts);
  return { retried: queued.length, result };
}

/**
 * After a business write: try Sheets sync when credentials are ready,
 * otherwise queue a backup job for later retry. Never throws.
 */
export async function autoBackupBusinessRecords(opts?: {
  actorName?: string;
  reason?: string;
}) {
  try {
    const cfg = await getGoogleSheetsConfig();
    const spreadsheetId = (
      cfg.spreadsheetId ||
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
      ""
    ).trim();
    if (!spreadsheetId || !googleSheetsEnvReady()) {
      const recent = await listBackupAttempts(5);
      const alreadyQueued = recent.some(
        (a) =>
          a.destination === "google_sheets" &&
          a.status === "queued" &&
          Date.now() - new Date(a.at).getTime() < 5 * 60_000
      );
      if (alreadyQueued) {
        return { queued: true, synced: false, detail: "Already queued" };
      }
      await recordBackupAttempt({
        status: "queued",
        destination: "google_sheets",
        detail:
          opts?.reason ||
          "Business records changed — Sheets backup queued until credentials/spreadsheet are ready",
        actorName: opts?.actorName || "system",
      });
      return { queued: true, synced: false, detail: "Queued" };
    }
    const result = await syncBusinessToGoogleSheets({
      actorName: opts?.actorName || "system",
      spreadsheetId,
    });
    if (!result.ok) {
      await recordBackupAttempt({
        status: "queued",
        destination: "google_sheets",
        detail: `Auto backup failed (${result.detail}) — queued for retry`,
        actorName: opts?.actorName || "system",
      });
      return { queued: true, synced: false, detail: result.detail };
    }
    return { queued: false, synced: true, detail: result.detail };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Auto backup error";
    try {
      await recordBackupAttempt({
        status: "queued",
        destination: "google_sheets",
        detail,
        actorName: opts?.actorName || "system",
      });
    } catch {
      /* ignore */
    }
    return { queued: true, synced: false, detail };
  }
}
