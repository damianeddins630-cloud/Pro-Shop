import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8_000_000;

/** Ops: upload a document (PDF/doc/image) for subscriber announcements → Vercel Blob. */
export async function POST(req: Request) {
  const session = await requireAnyPermission(
    "manage_subscribers",
    "edit_pages",
    "manage_users"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json(
      {
        error:
          "Blob storage is not configured — set BLOB_READ_WRITE_TOKEN to upload documents.",
      },
      { status: 503 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max ~8MB)" },
      { status: 400 }
    );
  }

  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
  ];
  if (file.type && !allowed.includes(file.type) && !file.type.startsWith("image/")) {
    return NextResponse.json(
      {
        error:
          "Unsupported file type. Use PDF, Word, Excel, text, or an image.",
      },
      { status: 400 }
    );
  }

  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "document";
  const pathname = `announcements/${Date.now()}-${safeName}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await put(pathname, buffer, {
      access: "public",
      contentType: file.type || "application/octet-stream",
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      ok: true,
      url: result.url,
      name: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      /** base64 for optional Resend attachment (small files only) */
      base64:
        file.size <= 3_500_000 ? buffer.toString("base64") : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Upload failed",
      },
      { status: 502 }
    );
  }
}
