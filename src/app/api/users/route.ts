import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission, toPublicUser } from "@/lib/auth";
import {
  listAllOrders,
  listRoles,
  listUsers,
  storePersistStatus,
  updateUser,
} from "@/lib/store";
import { actorRankFromSession } from "@/lib/role-rank";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

async function publicUsersList() {
  const [users, orders] = await Promise.all([listUsers(), listAllOrders()]);
  const publicUsers: Awaited<ReturnType<typeof toPublicUser>>[] = [];

  for (const u of users) {
    try {
      const userOrders = orders.filter((o) => o.userId === u.id);
      const last = userOrders[0];
      publicUsers.push(
        await toPublicUser(u, {
          hasOrdered: userOrders.length > 0,
          orderCount: userOrders.length,
          lastOrderAt: last?.createdAt,
        })
      );
    } catch {
      // Never let one bad row blank the whole accounts table
      publicUsers.push({
        id: u.id,
        email: u.email,
        username: u.username,
        phoneNumber: u.phoneNumber || "",
        dateOfBirth: u.dateOfBirth || "",
        roleId: u.roleId || "role_customer",
        roleName: "Unknown",
        permissions: [],
        createdAt: u.createdAt,
        hasOrdered: false,
        orderCount: 0,
      });
    }
  }

  return publicUsers;
}

export async function GET() {
  const session = await requireAnyPermission("manage_users", "manage_roles");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const roles = await listRoles();
    const users = await publicUsersList();
    const persist = storePersistStatus();
    return NextResponse.json(
      {
        users,
        userCount: users.length,
        actorRank: actorRankFromSession(session, roles),
        persist,
        warning: persist.durableWriteConfigured
          ? null
          : "GITHUB_TOKEN is not set in Vercel. New accounts will disappear after restart. Add GITHUB_TOKEN (repo scope), then redeploy.",
      },
      { headers: noStore }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load users" },
      { status: 500 }
    );
  }
}

const schema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
});

export async function PUT(req: Request) {
  const session = await requireAnyPermission("manage_users", "manage_roles");
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
