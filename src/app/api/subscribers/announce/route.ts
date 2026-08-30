import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import {
  announcementHtml,
  emailConfigured,
  sendEmail,
  type OutboundAttachment,
} from "@/lib/email";
import {
  listAnnouncementRecipients,
  listAnnouncements,
  recordAnnouncement,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

const schema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  includeAccounts: z.boolean().optional(),
  documentName: z.string().max(240).optional(),
  documentUrl: z.string().max(2000).optional(),
  /** Optional base64 attachment (PDF/doc) — keep under ~3MB */
  documentBase64: z.string().optional(),
  documentContentType: z.string().optional(),
});

export async function GET() {
  const session = await requireAnyPermission(
    "manage_subscribers",
    "edit_pages",
    "manage_users"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    {
      announcements: await listAnnouncements(),
      emailConfigured: emailConfigured(),
      help: emailConfigured()
        ? "Resend is configured — announcements will email subscribers."
        : "Add RESEND_API_KEY (and optional EMAIL_FROM) in Vercel Production env, then redeploy.",
    },
    { headers: noStore }
  );
}

/** Send an announcement / document to every subscriber email (and optional accounts). */
export async function POST(req: Request) {
  const session = await requireAnyPermission(
    "manage_subscribers",
    "edit_pages",
    "manage_users"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    if (!emailConfigured()) {
      return NextResponse.json(
        {
          error:
            "Email is not configured. Add RESEND_API_KEY in Vercel env vars for pro-shop-lemon, then Redeploy.",
          code: "EMAIL_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    const recipients = await listAnnouncementRecipients({
      includeAccounts: Boolean(body.includeAccounts),
    });
    if (!recipients.length) {
      return NextResponse.json(
        { error: "No subscribers (or accounts) to email yet." },
        { status: 400 }
      );
    }

    const documentUrl = body.documentUrl?.trim() || undefined;
    const documentName = body.documentName?.trim() || undefined;

    let attachments: OutboundAttachment[] | undefined;
    if (body.documentBase64 && documentName) {
      // Resend attachment content is raw base64 (no data: prefix)
      const raw = body.documentBase64.replace(/^data:[^;]+;base64,/, "");
      if (raw.length > 4_000_000) {
        return NextResponse.json(
          {
            error:
              "Attachment too large. Upload a smaller file or use a document link only.",
          },
          { status: 400 }
        );
      }
      attachments = [
        {
          filename: documentName,
          contentBase64: raw,
          contentType: body.documentContentType,
        },
      ];
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send one-by-one so each person gets their own greeting / inbox delivery.
    for (const r of recipients) {
      const html = announcementHtml({
        subject: body.subject,
        body: body.body,
        documentName,
        documentUrl,
        firstName: r.firstName,
      });
      const result = await sendEmail({
        to: r.email,
        subject: body.subject,
        html,
        attachments,
      });
      if (result.ok) sent += 1;
      else {
        failed += 1;
        if (errors.length < 5) {
          errors.push(`${r.email}: ${result.error || "failed"}`);
        }
      }
    }

    const announcement = await recordAnnouncement({
      subject: body.subject,
      body: body.body,
      documentName,
      documentUrl,
      recipientCount: sent,
      failedCount: failed,
      sentBy: session.username || session.email,
      includeAccounts: Boolean(body.includeAccounts),
    });

    if (sent === 0) {
      return NextResponse.json(
        {
          error: `Could not send any emails. ${errors.join(" | ") || "Check RESEND_API_KEY / EMAIL_FROM."}`,
          announcement,
          sent,
          failed,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        sent,
        failed,
        announcement,
        message: `Sent to ${sent} email${sent === 1 ? "" : "s"}${
          failed ? ` (${failed} failed)` : ""
        }.`,
        errors: errors.length ? errors : undefined,
      },
      { headers: noStore }
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid announcement", details: e.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Send failed" },
      { status: 400 }
    );
  }
}
