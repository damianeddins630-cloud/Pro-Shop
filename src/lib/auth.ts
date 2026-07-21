import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { Permission, PublicUser, SessionPayload, User } from "./types";
import { getRoleById, resolveUserRole } from "./store";

const COOKIE_NAME = "bba_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "ballards-bowling-academy-dev-secret-change-me"
);

export async function toPublicUser(user: User): Promise<PublicUser> {
  const role = await resolveUserRole(user);
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    phoneNumber: user.phoneNumber,
    dateOfBirth: user.dateOfBirth,
    roleId: role.id,
    roleName: role.name,
    permissions: role.permissions,
  };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secret);

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function createSessionForUser(user: User) {
  const role = await resolveUserRole(user);
  await createSession({
    userId: user.id,
    roleId: role.id,
    username: user.username,
    email: user.email,
    permissions: role.permissions,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    let roleId = String(payload.roleId || "");
    const legacyRole = String(payload.role || "");
    if (!roleId || roleId === "admin" || roleId === "customer") {
      if (legacyRole === "admin" || roleId === "admin") roleId = "role_admin";
      else if (legacyRole === "customer" || roleId === "customer") roleId = "role_customer";
    }

    let permissions = Array.isArray(payload.permissions)
      ? (payload.permissions as Permission[])
      : [];

    // Always refresh permissions from live role data
    const role = roleId ? await getRoleById(roleId) : null;
    if (role) {
      permissions = role.permissions;
      roleId = role.id;
    } else if (legacyRole === "admin") {
      const adminRole = await getRoleById("role_admin");
      if (adminRole) {
        permissions = adminRole.permissions;
        roleId = adminRole.id;
      }
    }

    return {
      userId: String(payload.userId),
      roleId: roleId || "role_customer",
      username: String(payload.username),
      email: String(payload.email),
      permissions,
    };
  } catch {
    return null;
  }
}

export async function requirePermission(...needed: Permission[]) {
  const session = await getSession();
  if (!session) return null;
  if (needed.every((p) => session.permissions.includes(p))) return session;
  return null;
}

export async function requireAnyPermission(...needed: Permission[]) {
  const session = await getSession();
  if (!session) return null;
  if (needed.some((p) => session.permissions.includes(p))) return session;
  return null;
}

/** Back-compat helper: full owner/admin access */
export async function requireAdmin() {
  return requireAnyPermission(
    "manage_roles",
    "manage_users",
    "manage_inventory",
    "edit_pages"
  );
}
