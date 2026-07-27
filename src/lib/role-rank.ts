import type { Role, SessionPayload } from "@/lib/types";
import { ALL_PERMISSIONS } from "@/lib/types";

/** Highest rank — Website Owner. Locked forever. */
export const OWNER_ROLE_RANK = 100;
export const STAFF_ROLE_RANK = 50;
export const CUSTOM_ROLE_RANK_DEFAULT = 25;
export const CUSTOMER_ROLE_RANK = 0;

export const OWNER_ROLE_ID = "role_admin";
export const CUSTOMER_ROLE_ID = "role_customer";
export const STAFF_ROLE_ID = "role_staff";

export function roleRank(role: Pick<Role, "id" | "rank" | "name"> | null | undefined) {
  if (!role) return CUSTOMER_ROLE_RANK;
  if (typeof role.rank === "number" && Number.isFinite(role.rank)) return role.rank;
  if (role.id === OWNER_ROLE_ID || role.name.toLowerCase() === "website owner") {
    return OWNER_ROLE_RANK;
  }
  if (role.id === STAFF_ROLE_ID || role.name.toLowerCase() === "staff") {
    return STAFF_ROLE_RANK;
  }
  if (role.id === CUSTOMER_ROLE_ID || role.name.toLowerCase() === "customer") {
    return CUSTOMER_ROLE_RANK;
  }
  return CUSTOM_ROLE_RANK_DEFAULT;
}

export function isOwnerRole(role: Pick<Role, "id" | "name" | "system"> | null | undefined) {
  if (!role) return false;
  return (
    role.id === OWNER_ROLE_ID ||
    role.name.toLowerCase() === "website owner" ||
    role.name.toLowerCase() === "admin"
  );
}

export function normalizeRole(role: Role): Role {
  if (isOwnerRole(role)) {
    return {
      ...role,
      id: OWNER_ROLE_ID,
      name: "Website Owner",
      description: role.description || "Full website owner access",
      permissions: [...ALL_PERMISSIONS],
      system: true,
      rank: OWNER_ROLE_RANK,
    };
  }
  if (role.id === CUSTOMER_ROLE_ID) {
    return {
      ...role,
      name: "Customer",
      permissions: [],
      system: true,
      rank: CUSTOMER_ROLE_RANK,
    };
  }
  if (role.id === STAFF_ROLE_ID) {
    return {
      ...role,
      rank: typeof role.rank === "number" ? role.rank : STAFF_ROLE_RANK,
      system: Boolean(role.system),
    };
  }
  return {
    ...role,
    rank:
      typeof role.rank === "number" && Number.isFinite(role.rank)
        ? Math.max(1, Math.min(OWNER_ROLE_RANK - 1, Math.floor(role.rank)))
        : CUSTOM_ROLE_RANK_DEFAULT,
    system: Boolean(role.system),
  };
}

export function actorRankFromSession(
  session: SessionPayload | null | undefined,
  roles: Role[]
) {
  if (!session) return CUSTOMER_ROLE_RANK;
  const role =
    roles.find((r) => r.id === session.roleId) ||
    (session.permissions?.length === ALL_PERMISSIONS.length
      ? roles.find((r) => r.id === OWNER_ROLE_ID)
      : null);
  return roleRank(role);
}

/** Can this actor edit/delete the target role? */
export function canManageRole(actorRank: number, target: Role) {
  if (isOwnerRole(target)) return false;
  return roleRank(target) < actorRank;
}

/** Can this actor assign a user into targetRole? */
export function canAssignRole(actorRank: number, target: Role) {
  return roleRank(target) < actorRank;
}
