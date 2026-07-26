import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, toPublicUser } from "@/lib/auth";
import { listAllOrders, listUsers, updateUser } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requirePermission("manage_users");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [users, orders] = await Promise.all([listUsers(), listAllOrders()]);
  const publicUsers = await Promise.all(
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
  return NextResponse.json(
    { users: publicUsers },
    { headers: { "Cache-Control": "no-store" } }
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
    const user = await updateUser(body.userId, { roleId: body.roleId });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ user: await toPublicUser(user) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 }
    );
  }
}
