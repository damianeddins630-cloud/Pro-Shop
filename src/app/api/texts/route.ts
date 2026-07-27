import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import { createText, listTexts, upsertText } from "@/lib/store";

export async function GET(req: Request) {
  const page = new URL(req.url).searchParams.get("page") || undefined;
  return NextResponse.json({ texts: await listTexts(page) });
}

const upsertSchema = z.object({
  page: z.string().min(1),
  slot: z.string().min(1),
  text: z.string().min(1).max(20000),
});

export async function PUT(req: Request) {
  const session = await requireAnyPermission("edit_pages", "manage_roles");
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = upsertSchema.parse(await req.json());
    const text = await upsertText(body.page, body.slot, body.text);
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 }
    );
  }
}

export async function POST(req: Request) {
  const session = await requireAnyPermission("edit_pages", "manage_roles");
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = upsertSchema.parse(await req.json());
    const text = await createText(body);
    return NextResponse.json({ text }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Create failed" },
      { status: 400 }
    );
  }
}
