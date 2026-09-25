import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { Permission, PublicUser, SessionPayload, User } from "./types";
import { findUserById, findUserByLogin, resolveUserRole } from "./store";

const COOKIE_NAME = "bba_session";
const DEFAULT_DEV_SECRET = "ballards-bowling-academy-dev-secret-change-me";

function resolveAuthSecret(): string {
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;
  // Production may still lack AUTH_SECRET in Vercel (historical). Login must
  // work — fall back to the built-in secret. Ops/health warns to set a real one.
  return DEFAULT_DEV_SECRET;
}

let cachedSecret: Uint8Array | null = null;
function secretBytes() {
  if (!cachedSecret) {
    cachedSecret = new TextEncoder().encode(resolveAuthSecret());
  }
  return cachedSecret;
}

/** True when using the built-in fallback secret (set AUTH_SECRET in Vercel). */
export function isUsingFallbackAuthSecret() {
  return !process.env.AUTH_SECRET?.trim();
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
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretBytes());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL),
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
    secure: process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL),
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretBytes());
    const userId = String(payload.userId || "");

    // Always use the live user record so Ops role changes apply immediately
    // (JWT alone can keep a stale roleId until the next login).
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
    "manage_subscribers",
    "manage_coaches",
    "edit_pages"
  );
}
