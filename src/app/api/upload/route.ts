import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { isAllowedImageMime, sniffImageMime } from "@/lib/security";

const MAX_BYTES = 2_500_000;

export async function POST(req: Request) {
  const session = await requireAnyPermission(
    "manage_inventory",
    "manage_deals",
    "manage_sponsors",
    "manage_coaches",
    "edit_pages"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max ~2.5MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImageMime(buffer);
  if (!sniffed || !isAllowedImageMime(sniffed)) {
    return NextResponse.json(
      { error: "File must be a JPEG, PNG, WebP, or GIF image (SVG not allowed)" },
      { status: 400 }
    );
  }
  if (file.type && !isAllowedImageMime(file.type) && file.type !== sniffed) {
    return NextResponse.json(
      { error: "File type does not match image contents" },
      { status: 400 }
    );
  }

  const dataUrl = `data:${sniffed};base64,${buffer.toString("base64")}`;
  return NextResponse.json({ url: dataUrl });
}
