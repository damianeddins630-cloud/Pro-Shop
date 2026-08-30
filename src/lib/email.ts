/**
 * Outbound email for subscriber announcements.
 * Uses Resend (https://resend.com) when RESEND_API_KEY is set in Vercel.
 */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function emailFromAddress() {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    "Ballard's Bowling Academy <onboarding@resend.dev>"
  );
}

export type OutboundAttachment = {
  filename: string;
  contentBase64: string;
  contentType?: string;
};

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: OutboundAttachment[];
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Email is not configured. Add RESEND_API_KEY (and optional EMAIL_FROM) in Vercel env vars, then redeploy.",
    };
  }

  const to = Array.isArray(input.to) ? input.to : [input.to];
  const recipients = [
    ...new Set(
      to
        .map((e) => String(e || "").trim().toLowerCase())
        .filter((e) => e.includes("@"))
    ),
  ];
  if (!recipients.length) {
    return { ok: false, error: "No valid recipient email" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFromAddress(),
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text || stripHtml(input.html),
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.contentBase64,
          ...(a.contentType ? { content_type: a.contentType } : {}),
        })),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        error:
          data.error?.message ||
          data.message ||
          `Email provider error (${res.status})`,
      };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Email send failed",
    };
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function announcementHtml(input: {
  subject: string;
  body: string;
  documentName?: string;
  documentUrl?: string;
  firstName?: string;
}) {
  const greeting = input.firstName?.trim()
    ? `Hi ${escapeHtml(input.firstName.trim())},`
    : "Hi,";
  const paragraphs = escapeHtml(input.body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 1rem;line-height:1.55;color:#222;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const doc =
    input.documentUrl && input.documentName
      ? `<p style="margin:1.25rem 0 0;"><a href="${escapeAttr(input.documentUrl)}" style="color:#e10600;font-weight:700;">Download ${escapeHtml(input.documentName)}</a></p>`
      : "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#111;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:16px;padding:28px 24px;">
      <p style="margin:0 0 0.35rem;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#e10600;font-weight:700;">Ballard's Bowling Academy</p>
      <h1 style="margin:0 0 1.25rem;font-size:24px;line-height:1.2;color:#111;">${escapeHtml(input.subject)}</h1>
      <p style="margin:0 0 1rem;color:#222;">${greeting}</p>
      ${paragraphs}
      ${doc}
      <p style="margin:1.75rem 0 0;font-size:12px;color:#777;">You received this because you subscribed or signed up at Ballard's Bowling Academy.</p>
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
