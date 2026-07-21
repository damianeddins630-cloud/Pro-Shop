import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { ALL_PERMISSIONS } from "@/lib/types";
import { deleteRole, updateRole } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export async function PUT(req: Request, { params }: Params) {
  const session = await requirePermission("manage_roles");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = schema.parse(await req.json());
    const patch: {
      name?: string;
      description?: string;
      permissions?: typeof ALL_PERMISSIONS[number][];
    } = {};
    if (body.name) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (body.permissions) {
      patch.permissions = body.permissions.filter((p) =>
        (ALL_PERMISSIONS as string[]).includes(p)
      ) as typeof ALL_PERMISSIONS[number][];
    }
    const role = await updateRole(id, patch);
    if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ role });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requirePermission("manage_roles");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await deleteRole(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Cannot delete this role (missing or system role)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
