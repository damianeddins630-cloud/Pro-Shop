import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import {
  businessRevenueSnapshot,
  getGoogleSheetsConfig,
  listAllOrdersForOps,
  listBackupAttempts,
  listCoachingBookings,
  listExpenses,
  listMemberships,
  listProducts,
  listUsers,
  recordBackupAttempt,
  storePersistStatus,
  updateGoogleSheetsConfig,
  verifyDurablePersistWithLiveStore,
} from "@/lib/store";
import {
  persistFailedResponse,
  requireDurablePersistOrLocal,
  withPersistMeta,
} from "@/lib/persist-guard";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, max-age=0" };

const configSchema = z.object({
  spreadsheetId: z.string().max(200).optional(),
  spreadsheetName: z.string().max(200).optional(),
  connected: z.boolean().optional(),
  serviceAccountEmail: z.string().email().optional().or(z.literal("")),
});

export async function GET() {
  const session = await requireAnyPermission(
    "manage_backups",
    "manage_roles",
    "manage_settings",
    "manage_inventory"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [attempts, sheets, persist] = await Promise.all([
    listBackupAttempts(40),
    getGoogleSheetsConfig(),
    Promise.resolve(storePersistStatus()),
  ]);
  return NextResponse.json(
    {
      attempts,
      googleSheets: {
        ...sheets,
        // Never expose secrets — only whether env hints exist
        envReady: Boolean(
          process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim() &&
            process.env.GOOGLE_SHEETS_PRIVATE_KEY?.trim()
        ),
      },
      persist,
      requiredEnv: [
        "BLOB_READ_WRITE_TOKEN (or UPSTASH Redis / GITHUB_TOKEN)",
        "GOOGLE_SHEETS_CLIENT_EMAIL (for Sheets backup)",
        "GOOGLE_SHEETS_PRIVATE_KEY (for Sheets backup)",
        "GOOGLE_SHEETS_SPREADSHEET_ID (optional override)",
      ],
    },
    { headers: noStore }
  );
}

export async function POST(req: Request) {
  const session = await requireAnyPermission(
    "manage_backups",
    "manage_roles",
    "manage_settings"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "manual_backup");

  if (action === "save_sheets_config") {
    try {
      const parsed = configSchema.parse(body);
      const saved = await updateGoogleSheetsConfig(
        {
          spreadsheetId: parsed.spreadsheetId?.trim() || undefined,
          spreadsheetName:
            parsed.spreadsheetName?.trim() ||
            "Ballard's Bowling Academy — Business Management & Backup",
          connected: Boolean(parsed.connected && parsed.spreadsheetId?.trim()),
          serviceAccountEmail: parsed.serviceAccountEmail || undefined,
        },
        { actorId: session.userId, actorName: session.username }
      );
      if (!requireDurablePersistOrLocal()) {
        return persistFailedResponse("Save Sheets config");
      }
      return NextResponse.json(withPersistMeta({ googleSheets: saved }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid config";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (action === "self_test") {
    const result = await verifyDurablePersistWithLiveStore();
    const detail =
      result.persist?.lastPersistDetail ||
      (result.ok ? "Durable self-test OK" : "Durable self-test failed");
    const attempt = await recordBackupAttempt({
      status: result.ok ? "success" : "failed",
      destination: "self_test",
      detail,
      actorName: session.username,
    });
    return NextResponse.json(
      withPersistMeta({ attempt, persist: storePersistStatus() })
    );
  }

  // Manual backup snapshot — queues Sheets job when credentials missing
  const [
    orders,
    products,
    users,
    bookings,
    memberships,
    expenses,
    biz,
    sheets,
  ] = await Promise.all([
    listAllOrdersForOps(),
    listProducts({ includeInactive: true }),
    listUsers(),
    listCoachingBookings(),
    listMemberships(),
    listExpenses(),
    businessRevenueSnapshot(),
    getGoogleSheetsConfig(),
  ]);

  const recordCounts = {
    orders: orders.length,
    products: products.length,
    customers: users.length,
    coaching: bookings.length,
    memberships: memberships.length,
    expenses: expenses.length,
  };

  const envReady = Boolean(
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim() &&
      process.env.GOOGLE_SHEETS_PRIVATE_KEY?.trim()
  );
  const spreadsheetId =
    sheets.spreadsheetId ||
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ||
    "";

  if (!envReady || !spreadsheetId) {
    const attempt = await recordBackupAttempt({
      status: "queued",
      destination: "google_sheets",
      detail:
        "Backup queued. Add GOOGLE_SHEETS_CLIENT_EMAIL + GOOGLE_SHEETS_PRIVATE_KEY in Vercel, and set a spreadsheet ID. The website continues using the durable store as source of truth.",
      recordCounts,
      actorName: session.username,
    });
    if (!requireDurablePersistOrLocal()) {
      return persistFailedResponse("Queue backup");
    }
    return NextResponse.json(
      withPersistMeta({
        attempt,
        queued: true,
        financesHint: biz,
        message:
          "Sheets credentials are not configured. Snapshot counts were logged; retry after env is set.",
      })
    );
  }

  // Credentials present but live Sheets write not implemented in this phase —
  // record an honest queued/success-pending status rather than pretending.
  const attempt = await recordBackupAttempt({
    status: "queued",
    destination: "google_sheets",
    detail: `Sheets env detected for spreadsheet ${spreadsheetId}. Live tab sync ships next; counts captured for reconciliation.`,
    recordCounts,
    actorName: session.username,
  });
  await updateGoogleSheetsConfig(
    {
      spreadsheetId,
      connected: true,
      lastBackupAt: attempt.at,
      lastBackupOk: false,
      lastBackupDetail: attempt.detail,
    },
    { actorId: session.userId, actorName: session.username }
  );

  if (!requireDurablePersistOrLocal()) {
    return persistFailedResponse("Record backup");
  }
  return NextResponse.json(
    withPersistMeta({
      attempt,
      queued: true,
      message:
        "Backup job recorded. Full Google Sheets row sync is staged next; durable database remains source of truth.",
    })
  );
}
