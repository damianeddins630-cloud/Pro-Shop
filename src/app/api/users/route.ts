import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, toPublicUser } from "@/lib/auth";
import { listAllOrders, listRoles, listUsers, updateUser } from "@/lib/store";
import { actorRankFromSession } from "@/lib/role-rank";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

async function publicUsersList() {
  const [users, orders] = await Promise.all([listUsers(), listAllOrders()]);
  return Promise.all(
    users.map((u) => {
      const userOrders = orders.filter((o) => o.userId === u.id);
      const last = userOrders[0];
      return toPublicUser(u, {
        hasOrdered: userOrders.length > 0,
        orderCount: userOrders.length,
        lastOrderAt: last?.createdAt,
      });
    })
  );
}

export async function GET() {
  const session = await requirePermission("manage_users");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = await listRoles();
  return NextResponse.json(
    {
      users: await publicUsersList(),
      actorRank: actorRankFromSession(session, roles),
    },
    { headers: noStore }
  );
}

const schema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
});

export async function PUT(req: Request) {
  const session = await requirePermission("manage_users");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    const roles = await listRoles();
    const actorRank = actorRankFromSession(session, roles);
    const user = await updateUser(
      body.userId,
      { roleId: body.roleId },
      { actorRank, actorUserId: session.userId }
    );
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        user: await toPublicUser(user),
        users: await publicUsersList(),
      },
      { headers: noStore }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 }
    );
  }
}
