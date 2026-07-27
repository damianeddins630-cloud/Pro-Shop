import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { ALL_PERMISSIONS } from "@/lib/types";
import { createRole, listRoles } from "@/lib/store";
import { actorRankFromSession } from "@/lib/role-rank";

export async function GET() {
  const session =
    (await requirePermission("manage_roles")) ||
    (await requirePermission("manage_users"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = await listRoles();
  return NextResponse.json({
    roles,
    permissions: ALL_PERMISSIONS,
    actorRank: actorRankFromSession(session, roles),
  });
}

const schema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  permissions: z.array(z.string()).default([]),
  rank: z.coerce.number().int().min(1).max(99).optional(),
});

export async function POST(req: Request) {
  const session = await requirePermission("manage_roles");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    const roles = await listRoles();
    const actorRank = actorRankFromSession(session, roles);
    const permissions = body.permissions.filter((p) =>
      (ALL_PERMISSIONS as string[]).includes(p)
    ) as (typeof ALL_PERMISSIONS)[number][];
    const role = await createRole(
      {
        name: body.name,
        description: body.description,
        permissions,
        rank: body.rank,
      },
      { actorRank }
    );
    return NextResponse.json({ role }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Create failed" },
      { status: 400 }
    );
  }
}
