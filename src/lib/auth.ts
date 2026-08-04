import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { Permission, PublicUser, SessionPayload, User } from "./types";
import { findUserById, findUserByLogin, resolveUserRole } from "./store";

const COOKIE_NAME = "bba_session";
const DEFAULT_DEV_SECRET = "ballards-bowling-academy-dev-secret-change-me";
const authSecret = process.env.AUTH_SECRET?.trim() || DEFAULT_DEV_SECRET;
const secret = new TextEncoder().encode(authSecret);

/** True when production is using the built-in fallback secret (login still works). */
export function isUsingFallbackAuthSecret() {
  return authSecret === DEFAULT_DEV_SECRET;
}

export async function toPublicUser(
  user: User,
  extras?: Pick<PublicUser, "hasOrdered" | "orderCount" | "lastOrderAt">
): Promise<PublicUser> {
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
    createdAt: user.createdAt,
    hasOrdered: extras?.hasOrdered ?? false,
    orderCount: extras?.orderCount ?? 0,
    lastOrderAt: extras?.lastOrderAt,
  };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload) {
  // Login must work even if AUTH_SECRET is not set yet — fall back to the
  // built-in secret. Ops/health will still warn to set a real AUTH_SECRET.
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
    const userId = String(payload.userId || "");

    // Always use the live user record so Ops role changes apply immediately
    // (JWT alone can keep a stale roleId until the next login).
    // Also resolve by email/username when the cookie still has an old user id.
    const liveUser =
      (userId ? await findUserById(userId) : null) ||
      (await findUserByLogin(String(payload.email || ""))) ||
      (await findUserByLogin(String(payload.username || "")));
    if (liveUser) {
      const role = await resolveUserRole(liveUser);
      return {
        userId: liveUser.id,
        roleId: role.id,
        username: liveUser.username,
        email: liveUser.email,
        permissions: role.permissions,
      };
    }

    // User row missing from store — force re-login instead of trusting stale JWT perms
    return null;
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

/** Back-compat helper: elevated ops access (prefer requireAnyPermission with real perms). */
export async function requireAdmin() {
  return requireAnyPermission(
    "manage_roles",
    "manage_users",
    "manage_inventory",
    "manage_deals",
    "manage_sponsors",
    "manage_coaches",
    "edit_pages"
  );
}
