import { NextResponse } from "next/server";
import { getSession, toPublicUser } from "@/lib/auth";
import {
  findUserById,
  findUserByLogin,
  getRoleById,
  getStore,
  OWNER_EMAIL,
  OWNER_USER_ID,
  OWNER_USERNAME,
} from "@/lib/store";
import type { PublicUser } from "@/lib/types";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ user: null });

    // Make sure store (and owner account) is initialized on this instance
    await getStore();

    let user =
      (await findUserById(session.userId)) ||
      (await findUserByLogin(session.email)) ||
      (await findUserByLogin(session.username));

    // Owner cookie from an older instance — recover by stable identity
    if (
      !user &&
      (session.email.toLowerCase() === OWNER_EMAIL ||
        session.username.toLowerCase() === "damian_e" ||
        session.userId === OWNER_USER_ID)
    ) {
      user = await findUserById(OWNER_USER_ID);
    }

    if (user) {
      return NextResponse.json({ user: await toPublicUser(user) });
    }

    // Last resort: build account from the signed session so Profile still works
    const role = await getRoleById(session.roleId);
    const publicUser: PublicUser = {
      id: session.userId || OWNER_USER_ID,
      email: session.email || OWNER_EMAIL,
      username: session.username || OWNER_USERNAME,
      phoneNumber: "",
      dateOfBirth: "",
      roleId: session.roleId,
      roleName: role?.name || "Customer",
      permissions: session.permissions || [],
    };
    return NextResponse.json({ user: publicUser });
  } catch {
    return NextResponse.json({ user: null });
  }
}
