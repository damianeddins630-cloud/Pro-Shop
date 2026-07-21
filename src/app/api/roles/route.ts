import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { ALL_PERMISSIONS } from "@/lib/types";
import { createRole, listRoles } from "@/lib/store";

export async function GET() {
  const session = await requirePermission("manage_roles");
  if (!session) {
    // Allow manage_users to at least read role names when assigning
    const usersPerm = await requirePermission("manage_users");
    if (!usersPerm) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return NextResponse.json({ roles: await listRoles(), permissions: ALL_PERMISSIONS });
}

const schema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  permissions: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  const session = await requirePermission("manage_roles");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    const permissions = body.permissions.filter((p) =>
      (ALL_PERMISSIONS as string[]).includes(p)
    ) as typeof ALL_PERMISSIONS[number][];
    const role = await createRole({
      name: body.name,
      description: body.description,
      permissions,
    });
    return NextResponse.json({ role }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Create failed" },
      { status: 400 }
    );
  }
}
