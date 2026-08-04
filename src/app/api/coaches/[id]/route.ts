import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import { deleteCoach, updateCoach } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().min(1).optional(),
  image: z.string().optional(),
  email: z.string().optional(),
});

async function requireCoachEditor() {
  return requireAnyPermission("manage_coaches", "edit_pages", "manage_roles");
}

export async function PUT(req: Request, { params }: Params) {
  const session = await requireCoachEditor();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = schema.parse(await req.json());
    const coach = await updateCoach(id, body);
    if (!coach) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ coach });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireCoachEditor();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteCoach(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
