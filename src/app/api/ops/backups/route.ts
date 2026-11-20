import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import {
  googleSheetsEnvReady,
  retryQueuedGoogleSheetBackups,
  syncBusinessToGoogleSheets,
  verifyGoogleSheetsConnection,
} from "@/lib/google-sheets";
import {
  getGoogleSheetsConfig,
  listBackupAttempts,
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
  // Auto-retry queued Sheets jobs when credentials become available
  let autoRetry: { retried: number; detail?: string } | null = null;
  if (googleSheetsEnvReady()) {
    try {
      const { retried, result } = await retryQueuedGoogleSheetBackups({
        actorName: "auto-retry",
      });
      if (retried > 0) {
        autoRetry = {
          retried,
          detail: result?.detail || (result?.ok ? "ok" : "failed"),
        };
      }
    } catch {
      /* non-fatal */
    }
  }

  const [attempts, sheets, persist] = await Promise.all([
    listBackupAttempts(40),
    getGoogleSheetsConfig(),
    Promise.resolve(storePersistStatus()),
  ]);
  // connected only when verify/sync set the flag — never from ID alone
  return NextResponse.json(
    {
      attempts,
      googleSheets: {
        ...sheets,
        connected: Boolean(sheets.connected),
        envReady: googleSheetsEnvReady(),
      },
      persist,
      autoRetry,
      requiredEnv: [
        "BLOB_READ_WRITE_TOKEN (or UPSTASH Redis / GITHUB_TOKEN) — primary DB",
        "GOOGLE_SHEETS_CLIENT_EMAIL",
        "GOOGLE_SHEETS_PRIVATE_KEY",
        "GOOGLE_SHEETS_SPREADSHEET_ID (optional if saved in Ops)",
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
      const spreadsheetId = (parsed.spreadsheetId || "").trim();
      if (!spreadsheetId) {
        const saved = await updateGoogleSheetsConfig(
          {
            spreadsheetId: "",
            connected: false,
            lastBackupOk: false,
            lastBackupDetail: "Spreadsheet ID cleared",
          },
          { actorId: session.userId, actorName: session.username }
        );
        return NextResponse.json(withPersistMeta({ googleSheets: saved }));
      }

      const verified = await verifyGoogleSheetsConnection(spreadsheetId);
      const saved = await updateGoogleSheetsConfig(
        {
          spreadsheetId,
          spreadsheetName:
            parsed.spreadsheetName?.trim() ||
            verified.title ||
            "Ballard's Bowling Academy — Business Management & Backup",
          connected: verified.ok,
          lastBackupOk: verified.ok ? undefined : false,
          lastBackupDetail: verified.detail,
          serviceAccountEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim(),
        },
        { actorId: session.userId, actorName: session.username }
      );
      if (!requireDurablePersistOrLocal()) {
        return persistFailedResponse("Save Sheets config");
      }
      return NextResponse.json(
        withPersistMeta({
          googleSheets: {
            ...saved,
            connected: Boolean(saved.connected),
          },
          verified,
          message: verified.ok
            ? "Connection verified with Google Sheets."
            : `Not connected: ${verified.detail}`,
        })
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid config";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (action === "verify") {
    const cfg = await getGoogleSheetsConfig();
    const id =
      String(body?.spreadsheetId || cfg.spreadsheetId || "").trim() ||
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ||
      "";
    const verified = await verifyGoogleSheetsConnection(id);
    await updateGoogleSheetsConfig({
      spreadsheetId: id || cfg.spreadsheetId,
      connected: verified.ok,
      lastBackupOk: verified.ok ? cfg.lastBackupOk : false,
      lastBackupDetail: verified.detail,
    });
    return NextResponse.json(withPersistMeta({ verified }));
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

  if (action === "retry_queued") {
    const { retried, result } = await retryQueuedGoogleSheetBackups({
      actorName: session.username,
    });
    return NextResponse.json(
      withPersistMeta({
        retried,
        result,
        message: retried
          ? result?.ok
            ? `Retried ${retried} queued job(s) — sync succeeded.`
            : `Retried ${retried} queued job(s) — sync failed: ${result?.detail}`
          : "No queued Google Sheets jobs.",
      })
    );
  }

  // Manual backup / sync
  const cfg = await getGoogleSheetsConfig();
  const spreadsheetId = (
    cfg.spreadsheetId ||
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
    ""
  ).trim();

  if (!googleSheetsEnvReady() || !spreadsheetId) {
    const attempt = await recordBackupAttempt({
      status: "queued",
      destination: "google_sheets",
      detail:
        "Backup queued. Add GOOGLE_SHEETS_CLIENT_EMAIL + GOOGLE_SHEETS_PRIVATE_KEY in Vercel and a verified spreadsheet ID, then use Retry queued or Run backup.",
      actorName: session.username,
    });
    if (!requireDurablePersistOrLocal()) {
      return persistFailedResponse("Queue backup");
    }
    return NextResponse.json(
      withPersistMeta({
        attempt,
        queued: true,
        message:
          "Sheets not ready — job queued. Website continues on durable store.",
      })
    );
  }

  const result = await syncBusinessToGoogleSheets({
    actorName: session.username,
    spreadsheetId,
  });

  if (!requireDurablePersistOrLocal()) {
    return persistFailedResponse("Record backup");
  }

  return NextResponse.json(
    withPersistMeta({
      result,
      ok: result.ok,
      message: result.ok
        ? result.detail
        : `Backup failed: ${result.detail}`,
    })
  );
}
