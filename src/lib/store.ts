import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type {
  StoreData,
  User,
  Product,
  Sponsor,
  Deal,
  Subscriber,
  Coach,
  PageText,
  Role,
  Order,
  OrderItem,
  OrderStatus,
  Permission,
  Coupon,
  ShopifySiteConfig,
} from "./types";
import { ALL_PERMISSIONS } from "./types";
import seedJson from "@/data/seed.json";
import {
  durableStoreConfigured,
  durableWriteConfigured,
  getLastPersistResult,
  loadDurableStore,
  saveDurableStoreDetailed,
} from "./durable-store";
import { githubWriteConfigured } from "./github-store";
import {
  codesMatch,
  couponHasUsesLeft,
  couponMaxUses,
  couponUsedCount,
  normalizeCouponCode,
  OWNER_FREE_COUPON_CODE,
} from "./coupons";
import {
  normalizeWeightOptions,
  normalizeWeightStock,
  totalFromWeightStock,
  weightKey,
} from "./weights";
import {
  CUSTOM_ROLE_RANK_DEFAULT,
  CUSTOMER_ROLE_ID,
  CUSTOMER_ROLE_RANK,
  isOwnerRole,
  normalizeRole,
  OWNER_ROLE_ID,
  OWNER_ROLE_RANK,
  roleRank,
  STAFF_ROLE_ID,
  STAFF_ROLE_RANK,
} from "./role-rank";

const GLOBAL_KEY = "__bba_store_v6__";

type GlobalStore = {
  data: StoreData | null;
  ready: Promise<StoreData> | null;
  lastPersistOk: boolean;
  lastPersistDetail: string;
};

function storeUpdatedAtMs(data: StoreData | null | undefined) {
  if (!data?.updatedAt) return 0;
  const n = Date.parse(data.updatedAt);
  return Number.isFinite(n) ? n : 0;
}

function catalogUpdatedAtMs(data: StoreData | null | undefined) {
  const raw = data?.catalogUpdatedAt || data?.updatedAt || "";
  const n = Date.parse(raw);
  return Number.isFinite(n) ? n : 0;
}

function touchUpdatedAt(data: StoreData) {
  data.updatedAt = new Date().toISOString();
}

function touchCatalogUpdatedAt(data: StoreData) {
  const now = new Date().toISOString();
  data.catalogUpdatedAt = now;
  data.updatedAt = now;
}

/** Union-merge by id. Local wins on conflicts so in-progress edits stick. */
function mergeByIdPreferLocal<T extends { id: string }>(
  remote: T[] | undefined,
  local: T[] | undefined
): T[] {
  const map = new Map<string, T>();
  for (const item of remote || []) {
    if (item?.id) map.set(item.id, item);
  }
  for (const item of local || []) {
    if (item?.id) map.set(item.id, item);
  }
  return Array.from(map.values());
}

/**
 * Users must never be lost across serverless instances.
 * Merge by id AND by email/username so duplicates collapse safely.
 */
function mergeUsersPreferLocal(
  remote: User[] | undefined,
  local: User[] | undefined
): User[] {
  const byId = new Map<string, User>();
  const emailToId = new Map<string, string>();
  const usernameToId = new Map<string, string>();

  const put = (u: User, preferLocal: boolean) => {
    if (!u?.id) return;
    const email = (u.email || "").toLowerCase();
    const username = (u.username || "").toLowerCase();
    const existingId =
      byId.has(u.id)
        ? u.id
        : emailToId.get(email) || usernameToId.get(username);
    if (existingId && existingId !== u.id) {
      // Same person under different ids — keep preferred copy
      if (preferLocal || !byId.has(existingId)) {
        byId.delete(existingId);
        byId.set(u.id, u);
        if (email) emailToId.set(email, u.id);
        if (username) usernameToId.set(username, u.id);
      }
      return;
    }
    if (!byId.has(u.id) || preferLocal) {
      byId.set(u.id, u);
      if (email) emailToId.set(email, u.id);
      if (username) usernameToId.set(username, u.id);
    }
  };

  for (const u of remote || []) put(u, false);
  for (const u of local || []) put(u, true);
  return Array.from(byId.values());
}

/**
 * Before writing, pull remote and merge account-critical collections.
 * Catalog (prices/discounts/stock) is protected by catalogUpdatedAt so an
 * order write on a cold instance cannot wipe a newer Ops price edit.
 */
async function reconcileWithRemote(local: StoreData): Promise<StoreData> {
  let remote: StoreData | null = null;
  try {
    remote = await loadDurableStore();
  } catch {
    remote = null;
  }
  if (!remote) return local;

  local.users = mergeUsersPreferLocal(remote.users, local.users);
  local.orders = mergeByIdPreferLocal(remote.orders, local.orders);
  local.subscribers = mergeByIdPreferLocal(
    remote.subscribers,
    local.subscribers
  );
  local.roles = mergeByIdPreferLocal(remote.roles, local.roles);

  const remoteCatalogTs = catalogUpdatedAtMs(remote);
  const localCatalogTs = catalogUpdatedAtMs(local);
  if (remoteCatalogTs > localCatalogTs) {
    // Remote catalog is newer — keep Ops price/discount/stock edits.
    local.products = remote.products || local.products;
    local.deals = remote.deals || local.deals;
    local.sponsors = remote.sponsors || local.sponsors;
    local.coupons = remote.coupons || local.coupons;
    local.catalogUpdatedAt = remote.catalogUpdatedAt || remote.updatedAt;
  } else {
    // Local catalog is newer (or equal) — still union coupons carefully
    local.coupons = mergeByIdPreferLocal(remote.coupons, local.coupons);
  }

  // Keep Shopify keys from whichever side has them (local wins non-empty fields)
  local.shopifyConfig = {
    ...(remote.shopifyConfig || {}),
    ...(local.shopifyConfig || {}),
  };

  ensureCoupons(local);
  ensureRoleRanks(local);
  return local;
}

function g(): GlobalStore {
  const root = globalThis as typeof globalThis & { [GLOBAL_KEY]?: GlobalStore };
  if (!root[GLOBAL_KEY]) {
    // On Vercel, do not claim success until a real durable write lands.
    const onVercel = Boolean(process.env.VERCEL);
    root[GLOBAL_KEY] = {
      data: null,
      ready: null,
      lastPersistOk: !onVercel,
      lastPersistDetail: onVercel
        ? "No durable save verified yet on this instance"
        : "local-ready",
    };
  }
  if (root[GLOBAL_KEY] && root[GLOBAL_KEY].lastPersistDetail == null) {
    root[GLOBAL_KEY].lastPersistDetail = "unknown";
  }
  return root[GLOBAL_KEY]!;
}

function runtimePath() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "bba-store.json");
  }
  return path.join(process.cwd(), "data", "runtime.json");
}

function defaultRoles(): Role[] {
  return [
    {
      id: OWNER_ROLE_ID,
      name: "Website Owner",
      description: "Full website owner access — locked top rank",
      permissions: [...ALL_PERMISSIONS],
      system: true,
      rank: OWNER_ROLE_RANK,
    },
    {
      id: CUSTOMER_ROLE_ID,
      name: "Customer",
      description: "Shop and place orders",
      permissions: [],
      system: true,
      rank: CUSTOMER_ROLE_RANK,
    },
    {
      id: STAFF_ROLE_ID,
      name: "Staff",
      description: "Edit pages and manage shop content",
      permissions: [
        "edit_pages",
        "manage_inventory",
        "manage_sponsors",
        "manage_deals",
        "manage_coaches",
        "view_orders",
      ],
      system: true,
      rank: STAFF_ROLE_RANK,
    },
  ];
}

function ensureRoleRanks(data: StoreData) {
  data.roles = (data.roles || []).map(normalizeRole);
  // Guarantee Website Owner + Customer exist
  if (!data.roles.some((r) => r.id === OWNER_ROLE_ID || isOwnerRole(r))) {
    data.roles.unshift(defaultRoles()[0]);
  } else {
    data.roles = data.roles.map((r) =>
      isOwnerRole(r) ? normalizeRole({ ...r, id: OWNER_ROLE_ID }) : r
    );
  }
  if (!data.roles.some((r) => r.id === CUSTOMER_ROLE_ID)) {
    data.roles.push(defaultRoles()[1]);
  }
}

function cloneSeed(): StoreData {
  const seed = JSON.parse(JSON.stringify(seedJson)) as StoreData;
  seed.users = seed.users || [];
  seed.subscribers = seed.subscribers || [];
  seed.products = seed.products || [];
  seed.sponsors = seed.sponsors || [];
  seed.deals = seed.deals || [];
  seed.coaches = seed.coaches || [];
  seed.texts = seed.texts || [];
  seed.roles = seed.roles?.length ? seed.roles : defaultRoles();
  seed.orders = seed.orders || [];
  seed.coupons = seed.coupons || [];
  return seed;
}

function normalizeCoupon(c: Coupon): Coupon {
  return {
    ...c,
    description: c.description || "",
    value: Number(c.value) || 0,
    active: c.active !== false,
    maxUses: couponMaxUses(c),
    usedCount: couponUsedCount(c),
    system: Boolean(c.system),
  };
}

function ensureCoupons(data: StoreData) {
  // Normalize only — do NOT recreate deleted coupons (including the owner free code).
  data.coupons = (data.coupons || []).map(normalizeCoupon);
  for (const c of data.coupons) {
    if (codesMatch(c.code, OWNER_FREE_COUPON_CODE)) {
      // Keep a stable id/label if the owner code is still present; never force it back.
      c.id = c.id || "coupon_cityviewlanes";
      c.code = OWNER_FREE_COUPON_CODE;
    }
  }
}

function migrateUsers(users: User[], roles: Role[]): User[] {
  const adminId =
    roles.find((r) => r.id === "role_admin")?.id ||
    roles.find((r) => {
      const n = r.name.toLowerCase();
      return n === "website owner" || n === "admin";
    })?.id ||
    "role_admin";
  const customerId =
    roles.find((r) => r.name.toLowerCase() === "customer")?.id || "role_customer";

  return users.map((u) => {
    const next = { ...u };
    if (!next.roleId) {
      next.roleId =
        next.role === "admin" ||
        next.username?.toLowerCase() === "cv_damian" ||
        next.username?.toLowerCase() === "damian_e"
          ? adminId
          : customerId;
    }
    return next;
  });
}

/** Stable across Vercel serverless instances so login cookies keep working */
export const OWNER_USER_ID = "user_owner";
export const OWNER_EMAIL = "damianeddins630@gmail.com";
export const OWNER_USERNAME = "CV_damian";
/** Stable owner password hash — restored on every cold start for recovery */
export const OWNER_PASSWORD_HASH =
  "$2b$10$7aHB08kNpgY72y/mHpDsp.hv2TtzWd8lX4gTzEsZYKHNmmiiyfujC";

const OWNER_USERNAME_ALIASES = new Set(["cv_damian", "damian_e"]);

function isOwnerUser(u: { id: string; username: string; email: string }) {
  return (
    u.id === OWNER_USER_ID ||
    OWNER_USERNAME_ALIASES.has(u.username.toLowerCase()) ||
    u.email.toLowerCase() === OWNER_EMAIL
  );
}

async function ensureAdmin(data: StoreData): Promise<void> {
  data.roles = data.roles?.length ? data.roles : defaultRoles();
  data.orders = data.orders || [];
  ensureRoleRanks(data);
  ensureCoupons(data);

  // Owner role always titled Website Owner with full permissions
  let adminRole =
    data.roles.find((r) => r.id === OWNER_ROLE_ID) ||
    data.roles.find((r) => isOwnerRole(r));
  if (!adminRole) {
    adminRole = defaultRoles()[0];
    data.roles.unshift(adminRole);
  } else {
    Object.assign(adminRole, normalizeRole(adminRole));
  }

  data.users = migrateUsers(data.users || [], data.roles);

  const existing = data.users.find(isOwnerUser);

  if (existing) {
    // Keep one stable owner row (same id on every cold start)
    existing.id = OWNER_USER_ID;
    existing.username = OWNER_USERNAME;
    existing.email = OWNER_EMAIL;
    existing.roleId = adminRole.id;
    existing.role = "admin";
    existing.passwordHash = OWNER_PASSWORD_HASH;
    // Drop duplicate owner rows from older runtimes
    data.users = data.users.filter((u) => u === existing || !isOwnerUser(u));
    return;
  }

  data.users.push({
    id: OWNER_USER_ID,
    email: OWNER_EMAIL,
    username: OWNER_USERNAME,
    passwordHash: OWNER_PASSWORD_HASH,
    phoneNumber: "",
    dateOfBirth: "1990-01-01",
    roleId: adminRole.id,
    role: "admin",
    createdAt: new Date().toISOString(),
  });
}

function mergeWithSeed(parsed: StoreData): StoreData {
  const seed = cloneSeed();
  parsed.products = parsed.products?.length ? parsed.products : seed.products;
  parsed.sponsors = parsed.sponsors?.length ? parsed.sponsors : seed.sponsors;
  parsed.deals = parsed.deals?.length ? parsed.deals : seed.deals;
  parsed.coaches = parsed.coaches?.length ? parsed.coaches : seed.coaches;
  parsed.texts = parsed.texts?.length ? parsed.texts : seed.texts;
  parsed.roles = parsed.roles?.length ? parsed.roles : seed.roles;
  parsed.orders = parsed.orders || [];
  parsed.subscribers = parsed.subscribers || [];
  parsed.users = parsed.users || [];
  // Keep an empty coupons list if ops deleted every custom code — only
  // fall back to seed when the field is missing entirely.
  parsed.coupons = Array.isArray(parsed.coupons)
    ? parsed.coupons
    : seed.coupons || [];
  parsed.shopifyConfig = parsed.shopifyConfig || seed.shopifyConfig;
  ensureCoupons(parsed);
  return parsed;
}

async function loadFromDisk(): Promise<StoreData> {
  const remote = await loadDurableStore();
  if (remote) {
    const merged = mergeWithSeed(remote);
    await ensureAdmin(merged);
    return merged;
  }

  const rt = runtimePath();
  try {
    const raw = await fs.readFile(rt, "utf8");
    const parsed = mergeWithSeed(JSON.parse(raw) as StoreData);
    await ensureAdmin(parsed);
    return parsed;
  } catch {
    // fall through
  }
  const seed = cloneSeed();
  await ensureAdmin(seed);
  return seed;
}

async function persist(data: StoreData) {
  const store = g();
  let ok = true;

  // Merge remote first so a product/inventory save cannot erase new accounts
  // or newer Ops catalog prices.
  await reconcileWithRemote(data);
  await ensureAdmin(data);
  // Bump store clock only — never invent a newer catalogUpdatedAt here.
  data.updatedAt = new Date().toISOString();
  store.data = data;

  const payload = JSON.stringify(
    { version: 2, ...data, updatedAt: data.updatedAt },
    null,
    2
  );
  try {
    const rt = runtimePath();
    await fs.mkdir(path.dirname(rt), { recursive: true });
    await fs.writeFile(rt, payload, "utf8");
  } catch {
    ok = false;
  }

  // Keep committed live-store path in sync for local / non-Vercel
  try {
    const live = path.join(process.cwd(), "data", "live-store.json");
    await fs.mkdir(path.dirname(live), { recursive: true });
    await fs.writeFile(live, payload, "utf8");
    ok = true;
  } catch {
    // Vercel FS is read-only outside /tmp — ignore
  }

  if (durableStoreConfigured()) {
    const durable = await saveDurableStoreDetailed(data);
    store.lastPersistDetail = durable.detail;
    // On Vercel, /tmp success alone is not enough — business data must hit durable storage
    if (process.env.VERCEL) {
      ok = durable.ok;
    } else {
      ok = durable.ok || ok;
    }
  } else {
    store.lastPersistDetail = "no durable backend configured";
  }

  store.lastPersistOk = ok;
  return ok;
}

export function storePersistStatus() {
  const last = getLastPersistResult();
  return {
    durableConfigured: durableStoreConfigured(),
    durableWriteConfigured: durableWriteConfigured(),
    githubWriteConfigured: githubWriteConfigured(),
    lastPersistOk: g().lastPersistOk,
    lastPersistDetail: g().lastPersistDetail || last.detail,
    backends: {
      redis: last.redis,
      blob: last.blob,
      github: last.github,
    },
  };
}

/** True when the latest mutate() actually landed in Redis/Blob/GitHub (or local non-Vercel disk). */
export function lastPersistSucceeded() {
  return g().lastPersistOk;
}

/** Drop dirty in-memory catalog after a failed durable write so this instance can't lie. */
export function discardMemoryStore() {
  const store = g();
  store.data = null;
  store.ready = null;
}

/**
 * After Blob/Redis self-test succeeds, write the live catalog once so
 * lastPersistOk flips true and Ops warning clears.
 */
export async function verifyDurablePersistWithLiveStore() {
  const data = await getStore();
  touchUpdatedAt(data);
  const ok = await persist(data);
  return {
    ok,
    persist: storePersistStatus(),
  };
}

/** Let Ops self-test mark this instance as durable-verified. */
export function markDurablePersistVerified(detail: string) {
  const store = g();
  store.lastPersistOk = true;
  store.lastPersistDetail = detail;
}

export async function getStore(): Promise<StoreData> {
  const store = g();

  // Always try GitHub/Redis/Blob so EVERY serverless instance sees Ops edits
  // (public GitHub live-store is readable even without GITHUB_TOKEN)
  let remote: StoreData | null = null;
  try {
    remote = await loadDurableStore();
  } catch {
    remote = null;
  }

  if (remote) {
    const merged = mergeWithSeed(remote);
    await ensureAdmin(merged);
    const remoteTs = storeUpdatedAtMs(merged);
    const memTs = storeUpdatedAtMs(store.data);
    // Keep in-memory copy when this instance just saved something newer,
    // but still union-merge users/orders so accounts never disappear.
    if (store.data && memTs > remoteTs) {
      store.data.users = mergeUsersPreferLocal(merged.users, store.data.users);
      store.data.orders = mergeByIdPreferLocal(merged.orders, store.data.orders);
      store.data.roles = mergeByIdPreferLocal(merged.roles, store.data.roles);
      store.data.coupons = mergeByIdPreferLocal(
        merged.coupons,
        store.data.coupons
      );
      store.data.shopifyConfig = {
        ...(merged.shopifyConfig || {}),
        ...(store.data.shopifyConfig || {}),
      };
      return store.data;
    }
    if (store.data) {
      merged.users = mergeUsersPreferLocal(store.data.users, merged.users);
      merged.orders = mergeByIdPreferLocal(store.data.orders, merged.orders);
      merged.shopifyConfig = {
        ...(merged.shopifyConfig || {}),
        ...(store.data.shopifyConfig || {}),
      };
    }
    store.data = merged;
    return merged;
  }

  // Same-instance memory wins (admin just edited on this lambda)
  if (store.data) return store.data;

  if (!store.ready) {
    store.ready = loadFromDisk()
      .then((data) => {
        store.data = data;
        return data;
      })
      .catch(async () => {
        const fallback = cloneSeed();
        await ensureAdmin(fallback);
        touchUpdatedAt(fallback);
        store.data = fallback;
        return fallback;
      });
  }
  return store.ready;
}

async function mutate(
  updater: (data: StoreData) => void | Promise<void>,
  opts?: { catalog?: boolean }
) {
  // Always resolve latest store (remote + memory) so coupon/inventory edits
  // don't clobber newer durable data with a stale in-memory copy.
  const data = await getStore();
  await updater(data);
  if (opts?.catalog) touchCatalogUpdatedAt(data);
  else touchUpdatedAt(data);
  g().data = data;
  await persist(data);
  return data;
}

/** ISO timestamp of the latest catalog mutation */
export async function getInventoryUpdatedAt() {
  const data = await getStore();
  return data.updatedAt || new Date(0).toISOString();
}

export async function getRoleById(id: string) {
  const data = await getStore();
  return data.roles.find((r) => r.id === id) || null;
}

export async function resolveUserRole(user: User): Promise<Role> {
  const data = await getStore();
  ensureRoleRanks(data);
  const byId = data.roles.find((r) => r.id === user.roleId);
  if (byId) return normalizeRole(byId);
  if (
    user.role === "admin" ||
    isOwnerUser(user) ||
    user.username.toLowerCase() === "damian_e"
  ) {
    return normalizeRole(
      data.roles.find((r) => r.id === OWNER_ROLE_ID) || defaultRoles()[0]
    );
  }
  return normalizeRole(
    data.roles.find((r) => r.id === CUSTOMER_ROLE_ID) || defaultRoles()[1]
  );
}

export async function listRoles() {
  const data = await getStore();
  ensureRoleRanks(data);
  return [...data.roles].sort((a, b) => roleRank(b) - roleRank(a));
}

export async function createRole(
  input: Omit<Role, "id" | "system"> & { rank?: number },
  opts?: { actorRank: number }
) {
  const actorRank = opts?.actorRank ?? OWNER_ROLE_RANK;
  let created: Role | null = null;
  await mutate((data) => {
    ensureRoleRanks(data);
    const name = input.name.trim();
    const reserved = ["website owner", "admin", "owner"];
    if (reserved.includes(name.toLowerCase())) {
      throw new Error("That role name is reserved for the Website Owner");
    }
    const requested =
      typeof input.rank === "number" ? Math.floor(input.rank) : CUSTOM_ROLE_RANK_DEFAULT;
    const rank = Math.max(1, Math.min(actorRank - 1, requested));
    if (rank >= actorRank) {
      throw new Error("You cannot create a role at or above your own rank");
    }
    created = {
      id: randomUUID(),
      name,
      description: input.description || "",
      permissions: input.permissions || [],
      system: false,
      rank,
    };
    data.roles.push(created);
  });
  return created!;
}

export async function updateRole(
  id: string,
  patch: Partial<Role>,
  opts?: { actorRank: number }
) {
  const actorRank = opts?.actorRank ?? OWNER_ROLE_RANK;
  let updated: Role | null = null;
  await mutate((data) => {
    ensureRoleRanks(data);
    const idx = data.roles.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const current = normalizeRole(data.roles[idx]);

    if (isOwnerRole(current)) {
      // Website Owner permissions/rank/name cannot be taken away
      if (
        patch.permissions ||
        (patch.name && patch.name !== "Website Owner") ||
        typeof patch.rank === "number" ||
        patch.system === false
      ) {
        throw new Error(
          "Website Owner permissions and rank are locked and cannot be changed"
        );
      }
      data.roles[idx] = normalizeRole({
        ...current,
        description:
          patch.description !== undefined ? patch.description : current.description,
      });
      updated = data.roles[idx];
      return;
    }

    if (roleRank(current) >= actorRank) {
      throw new Error("You cannot edit a role at or above your own rank");
    }

    let nextRank = current.rank ?? CUSTOM_ROLE_RANK_DEFAULT;
    if (typeof patch.rank === "number") {
      nextRank = Math.max(1, Math.min(actorRank - 1, Math.floor(patch.rank)));
    }

    data.roles[idx] = normalizeRole({
      ...current,
      ...patch,
      id,
      system: current.system,
      rank: nextRank,
      permissions: patch.permissions || current.permissions,
    });
    updated = data.roles[idx];
  });
  return updated;
}

export async function deleteRole(id: string, opts?: { actorRank: number }) {
  const actorRank = opts?.actorRank ?? OWNER_ROLE_RANK;
  let ok = false;
  await mutate((data) => {
    ensureRoleRanks(data);
    const role = data.roles.find((r) => r.id === id);
    if (!role || role.system || isOwnerRole(role)) {
      throw new Error("Cannot delete this role");
    }
    if (roleRank(role) >= actorRank) {
      throw new Error("You cannot delete a role at or above your own rank");
    }
    const customer =
      data.roles.find((r) => r.id === CUSTOMER_ROLE_ID) || data.roles[1];
    data.users = data.users.map((u) =>
      u.roleId === id ? { ...u, roleId: customer.id } : u
    );
    const before = data.roles.length;
    data.roles = data.roles.filter((r) => r.id !== id);
    ok = data.roles.length < before;
  });
  return ok;
}

export async function listUsers() {
  const data = await getStore();
  await ensureAdmin(data);
  // Owner first, then newest accounts
  return [...(data.users || [])].sort((a, b) => {
    if (a.id === OWNER_USER_ID) return -1;
    if (b.id === OWNER_USER_ID) return 1;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

export async function updateUser(
  id: string,
  patch: Partial<User>,
  opts?: { actorRank: number; actorUserId?: string }
) {
  const actorRank = opts?.actorRank ?? OWNER_ROLE_RANK;
  let updated: User | null = null;
  await mutate((data) => {
    ensureRoleRanks(data);
    const idx = data.users.findIndex((u) => u.id === id);
    if (idx === -1) return;
    const current = data.users[idx];

    const targetIsOwner =
      current.id === OWNER_USER_ID ||
      current.username.toLowerCase() === OWNER_USERNAME.toLowerCase() ||
      current.email.toLowerCase() === OWNER_EMAIL;

    // Website owner account role cannot be changed
    if (targetIsOwner) {
      if (patch.roleId && patch.roleId !== OWNER_ROLE_ID) {
        throw new Error("The Website Owner account role cannot be changed");
      }
      patch = { ...patch, roleId: OWNER_ROLE_ID };
    }

    if (patch.roleId && !targetIsOwner) {
      const targetRole = data.roles.find((r) => r.id === patch.roleId);
      if (!targetRole) throw new Error("Role not found");
      if (isOwnerRole(targetRole) && current.id !== OWNER_USER_ID) {
        throw new Error("Only the Website Owner account can hold that role");
      }
      if (roleRank(targetRole) >= actorRank) {
        throw new Error("You cannot assign a role at or above your own rank");
      }
      // Cannot demote/change users who currently outrank you
      const currentRole = data.roles.find((r) => r.id === current.roleId);
      if (
        roleRank(currentRole) >= actorRank &&
        current.id !== opts?.actorUserId
      ) {
        throw new Error("You cannot change a user at or above your own rank");
      }
    }

    const nextRoleId = patch.roleId || current.roleId;
    data.users[idx] = {
      ...current,
      ...patch,
      id,
      roleId: nextRoleId,
      // Keep legacy role field in sync for older session cookies
      role:
        nextRoleId === OWNER_ROLE_ID || isOwnerRole(
          data.roles.find((r) => r.id === nextRoleId)
        )
          ? "admin"
          : "customer",
    };
    updated = data.users[idx];
  });
  return updated;
}

function normalizeProduct(p: Product): Product {
  const weightOptions = normalizeWeightOptions(p.weightOptions);
  const weightStock = weightOptions?.length
    ? normalizeWeightStock(p.weightStock, weightOptions)
    : undefined;
  const stockFromWeights = weightStock
    ? totalFromWeightStock(weightStock)
    : null;

  return {
    ...p,
    price: Math.max(0, Number(p.price) || 0),
    discountPercent: Math.min(100, Math.max(0, Number(p.discountPercent) || 0)),
    stock:
      stockFromWeights != null
        ? stockFromWeights
        : Math.max(0, Math.floor(Number(p.stock) || 0)),
    weightOptions,
    weightStock,
  };
}

function appendStatusHistory(
  order: Order,
  status: OrderStatus,
  note?: string,
  opts?: { force?: boolean }
): Order {
  const at = new Date().toISOString();
  const history = [...(order.statusHistory || [])];
  const last = history[history.length - 1];
  const statusChanged = !last || last.status !== status;
  if (statusChanged || opts?.force) {
    history.push({ status, at, ...(note ? { note } : {}) });
  }
  return { ...order, status, updatedAt: at, statusHistory: history };
}

function applyLineStockDecrement(
  product: Product,
  quantity: number,
  weight?: number,
  opts?: { clamp?: boolean }
) {
  const clamp = Boolean(opts?.clamp);
  if (weight != null && product.weightStock) {
    const key = weightKey(weight);
    if (Object.prototype.hasOwnProperty.call(product.weightStock, key)) {
      const have = Math.max(0, Math.floor(Number(product.weightStock[key]) || 0));
      if (!clamp && have < quantity) {
        throw new Error(
          `Not enough stock for ${product.name} (${weight} lb)`
        );
      }
      product.weightStock = {
        ...product.weightStock,
        [key]: Math.max(0, have - quantity),
      };
      product.stock = totalFromWeightStock(product.weightStock);
      return;
    }
  }
  if (!clamp && product.stock < quantity) {
    throw new Error(`Not enough stock for ${product.name}`);
  }
  product.stock = Math.max(0, product.stock - quantity);
}

export async function listProducts(opts?: { includeInactive?: boolean }) {
  const data = await getStore();
  return data.products
    .map(normalizeProduct)
    .filter((p) => opts?.includeInactive || p.active);
}

export async function getProduct(id: string) {
  const data = await getStore();
  const product = data.products.find((p) => p.id === id || p.slug === id);
  return product ? normalizeProduct(product) : null;
}

/**
 * Checkout / charge path: ALWAYS prefer durable Blob/Redis catalog prices.
 * Memory is fallback only — cold order writes must not dictate Shopify totals.
 */
export async function getFreshProductForCheckout(id: string) {
  try {
    const remote = await loadDurableStore();
    const hit = remote?.products?.find((p) => p.id === id || p.slug === id);
    if (hit) {
      // Keep memory in sync so this instance doesn't later overwrite Blob
      // with an older catalog during an order save.
      const mem = g().data;
      if (mem && catalogUpdatedAtMs(remote) >= catalogUpdatedAtMs(mem)) {
        mem.products = remote!.products;
        mem.deals = remote!.deals || mem.deals;
        mem.coupons = remote!.coupons || mem.coupons;
        mem.sponsors = remote!.sponsors || mem.sponsors;
        mem.catalogUpdatedAt =
          remote!.catalogUpdatedAt || remote!.updatedAt || mem.catalogUpdatedAt;
      }
      return normalizeProduct(hit);
    }
  } catch {
    // fall through
  }
  return getProduct(id);
}

export async function getFreshCouponForCheckout(code: string) {
  const key = normalizeCouponCode(code);
  if (!key) return null;
  try {
    const remote = await loadDurableStore();
    if (Array.isArray(remote?.coupons)) {
      ensureCoupons(remote);
      const found = remote.coupons.find(
        (c) =>
          c.active !== false &&
          codesMatch(c.code, key) &&
          couponHasUsesLeft(c)
      );
      if (found) return normalizeCoupon(found);
      // Durable had coupons list but code missing/exhausted — don't fall back to stale memory
      return null;
    }
  } catch {
    // fall through
  }
  return findCouponByCode(code);
}

export async function createProduct(input: Omit<Product, "id">) {
  let created: Product | null = null;
  await mutate((data) => {
    created = normalizeProduct({ ...input, id: randomUUID() });
    data.products.unshift(created);
  }, { catalog: true });
  return created!;
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  let updated: Product | null = null;
  await mutate((data) => {
    const idx = data.products.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const next = normalizeProduct({
      ...data.products[idx],
      ...patch,
      id,
    });
    // Explicit empty weight list from Ops clears the requirement.
    if (Array.isArray(patch.weightOptions) && patch.weightOptions.length === 0) {
      delete next.weightOptions;
      delete next.weightStock;
    }
    if (patch.weightStock && Object.keys(patch.weightStock).length === 0) {
      delete next.weightStock;
    }
    data.products[idx] = next;
    updated = next;
  }, { catalog: true });
  return updated;
}

export async function deleteProduct(id: string) {
  let ok = false;
  await mutate((data) => {
    const before = data.products.length;
    data.products = data.products.filter((p) => p.id !== id);
    ok = data.products.length < before;
  }, { catalog: true });
  return ok;
}

export async function listSponsors() {
  return (await getStore()).sponsors;
}

export async function createSponsor(input: Omit<Sponsor, "id">) {
  let created: Sponsor | null = null;
  await mutate((data) => {
    created = { ...input, id: randomUUID() };
    data.sponsors.push(created);
  }, { catalog: true });
  return created!;
}

export async function updateSponsor(id: string, patch: Partial<Sponsor>) {
  let updated: Sponsor | null = null;
  await mutate((data) => {
    const idx = data.sponsors.findIndex((s) => s.id === id);
    if (idx === -1) return;
    data.sponsors[idx] = { ...data.sponsors[idx], ...patch, id };
    updated = data.sponsors[idx];
  }, { catalog: true });
  return updated;
}

export async function deleteSponsor(id: string) {
  let ok = false;
  await mutate((data) => {
    const before = data.sponsors.length;
    data.sponsors = data.sponsors.filter((s) => s.id !== id);
    ok = data.sponsors.length < before;
  }, { catalog: true });
  return ok;
}

export async function listDeals() {
  return (await getStore()).deals;
}

export async function createDeal(input: Omit<Deal, "id">) {
  let created: Deal | null = null;
  await mutate((data) => {
    created = { ...input, id: randomUUID() };
    data.deals.unshift(created);
  }, { catalog: true });
  return created!;
}

export async function updateDeal(id: string, patch: Partial<Deal>) {
  let updated: Deal | null = null;
  await mutate((data) => {
    const idx = data.deals.findIndex((d) => d.id === id);
    if (idx === -1) return;
    data.deals[idx] = { ...data.deals[idx], ...patch, id };
    updated = data.deals[idx];
  }, { catalog: true });
  return updated;
}

export async function deleteDeal(id: string) {
  let ok = false;
  await mutate((data) => {
    const before = data.deals.length;
    data.deals = data.deals.filter((d) => d.id !== id);
    ok = data.deals.length < before;
  }, { catalog: true });
  return ok;
}

export async function findUserByLogin(login: string) {
  const data = await getStore();
  const key = login.trim().toLowerCase();
  // Owner aliases always resolve to the website owner account
  if (OWNER_USERNAME_ALIASES.has(key) || key === OWNER_EMAIL) {
    return data.users.find((u) => u.id === OWNER_USER_ID) || null;
  }
  return (
    data.users.find(
      (u) => u.email.toLowerCase() === key || u.username.toLowerCase() === key
    ) || null
  );
}

export async function findUserById(id: string) {
  const data = await getStore();
  return data.users.find((u) => u.id === id) || null;
}

export async function createUser(input: {
  email: string;
  username: string;
  password: string;
  phoneNumber: string;
  dateOfBirth: string;
  roleId?: string;
}) {
  // On Vercel, accounts only survive if a durable write backend is configured.
  // Fail loudly instead of creating accounts that disappear on the next request.
  if (process.env.VERCEL && !durableWriteConfigured()) {
    throw new Error(
      "Account saving is not set up on the server yet (missing GITHUB_TOKEN). Please contact the site owner."
    );
  }

  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();
  const passwordHash = await bcrypt.hash(input.password, 10);
  let created: User | null = null;

  // Entire create happens inside mutate + reconcile so registration
  // cannot be wiped by a concurrent inventory/ops save.
  await mutate((data) => {
    ensureRoleRanks(data);
    data.users = data.users || [];
    if (data.users.some((u) => u.email.toLowerCase() === email)) {
      throw new Error("Email already registered");
    }
    if (
      data.users.some((u) => u.username.toLowerCase() === username.toLowerCase())
    ) {
      throw new Error("Username already taken");
    }
    const customer =
      data.roles.find((r) => r.id === CUSTOMER_ROLE_ID) ||
      data.roles.find((r) => r.name.toLowerCase() === "customer");
    created = {
      id: randomUUID(),
      email,
      username,
      passwordHash,
      phoneNumber: input.phoneNumber,
      dateOfBirth: input.dateOfBirth,
      roleId: input.roleId || customer?.id || CUSTOMER_ROLE_ID,
      role: "customer",
      createdAt: new Date().toISOString(),
    };
    data.users.push(created);
  });

  if (!created) throw new Error("Registration failed");
  return created;
}

export async function addSubscriber(input: Omit<Subscriber, "id" | "createdAt">) {
  let created: Subscriber | null = null;
  await mutate((data) => {
    created = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    data.subscribers.push(created);
  });
  return created!;
}

export async function reduceStock(
  items: { productId: string; quantity: number; weight?: number }[]
) {
  await mutate((data) => {
    for (const item of items) {
      const p = data.products.find((x) => x.id === item.productId);
      if (!p) throw new Error("Product not found");
      applyLineStockDecrement(p, item.quantity, item.weight);
      data.products[data.products.findIndex((x) => x.id === p.id)] =
        normalizeProduct(p);
    }
  }, { catalog: true });
}

export async function createOrder(input: {
  userId: string;
  username: string;
  email: string;
  phoneNumber?: string;
  items: OrderItem[];
  total: number;
  subtotal?: number;
  discountAmount?: number;
  couponCode?: string;
  status?: OrderStatus;
  shopifyDraftOrderId?: string;
  shopifyInvoiceUrl?: string;
  paymentProvider?: "shopify" | "local";
  inventoryApplied?: boolean;
  drillingNotes?: string;
}) {
  let created: Order | null = null;
  await mutate((data) => {
    const status = input.status || "placed";
    const createdAt = new Date().toISOString();
    const user = data.users.find((u) => u.id === input.userId);
    created = {
      id: randomUUID(),
      userId: input.userId,
      username: input.username,
      email: input.email,
      phoneNumber:
        (input.phoneNumber || user?.phoneNumber || "").trim() || undefined,
      items: input.items,
      total: input.total,
      subtotal: input.subtotal,
      discountAmount: input.discountAmount,
      couponCode: input.couponCode,
      status,
      createdAt,
      updatedAt: createdAt,
      statusHistory: [{ status, at: createdAt, note: "Order created" }],
      fulfillment: "in_store",
      drillingNotes: input.drillingNotes,
      shopifyDraftOrderId: input.shopifyDraftOrderId,
      shopifyInvoiceUrl: input.shopifyInvoiceUrl,
      paymentProvider: input.paymentProvider || "local",
      inventoryApplied: Boolean(input.inventoryApplied),
    };
    data.orders = data.orders || [];
    data.orders.unshift(created);
  });
  return created!;
}

/**
 * After Shopify (or local) payment succeeds: pull stock + count coupon once.
 * Safe to call repeatedly — inventory is only applied the first time.
 */
export async function markOrderPaid(
  orderId: string,
  nextStatus: OrderStatus = "processing"
): Promise<Order | null> {
  let updated: Order | null = null;
  await mutate((data) => {
    const idx = (data.orders || []).findIndex((o) => o.id === orderId);
    if (idx === -1) return;
    const current: Order = { ...data.orders[idx] };

    // Stock drops only after a real paid settlement (never on add-to-cart / unpaid draft).
    if (!current.inventoryApplied) {
      for (const item of current.items) {
        const p = data.products.find((x) => x.id === item.productId);
        if (!p) continue;
        // Customer already paid — never block settlement on a race; clamp at 0.
        applyLineStockDecrement(p, item.quantity, item.weight, { clamp: true });
        const pidx = data.products.findIndex((x) => x.id === p.id);
        if (pidx !== -1) data.products[pidx] = normalizeProduct(p);
      }

      if (current.couponCode) {
        ensureCoupons(data);
        const cidx = (data.coupons || []).findIndex((c) =>
          codesMatch(c.code, current.couponCode || "")
        );
        if (cidx !== -1) {
          const coupon = data.coupons![cidx];
          data.coupons![cidx] = normalizeCoupon({
            ...coupon,
            usedCount: couponUsedCount(coupon) + 1,
          });
        }
      }
      current.inventoryApplied = true;
    }

    // Paid always wins over a stale cancelled/awaiting row.
    if (
      current.status === "awaiting_payment" ||
      current.status === "placed" ||
      current.status === "cancelled"
    ) {
      Object.assign(
        current,
        appendStatusHistory(current, nextStatus, "Payment confirmed")
      );
    }
    data.orders[idx] = current;
    updated = current;
  }, { catalog: true });
  return updated;
}

export async function listCoupons() {
  const data = await getStore();
  ensureCoupons(data);
  return [...(data.coupons || [])];
}

export async function findCouponByCode(code: string) {
  const key = normalizeCouponCode(code);
  if (!key) return null;
  const coupons = await listCoupons();
  const coupon =
    coupons.find((c) => c.active && codesMatch(c.code, key)) || null;
  if (!coupon) return null;
  if (!couponHasUsesLeft(coupon)) return null;
  return coupon;
}

/** Why a code cannot be redeemed (for clearer cart errors) */
export async function getCouponRedeemBlockReason(code: string) {
  const key = normalizeCouponCode(code);
  if (!key) return "Enter a coupon code";
  const coupons = await listCoupons();
  const coupon = coupons.find((c) => codesMatch(c.code, key));
  if (!coupon) return "Coupon not found";
  if (!coupon.active) return "This coupon is inactive";
  if (!couponHasUsesLeft(coupon)) {
    return "This coupon has reached its use limit";
  }
  return null;
}

export async function createCoupon(
  input: Omit<Coupon, "id" | "system" | "usedCount"> & {
    system?: boolean;
    usedCount?: number;
    maxUses?: number;
  }
) {
  const code = normalizeCouponCode(input.code);
  if (!code) throw new Error("Coupon code is required");
  if (!["percent", "fixed", "free"].includes(input.type)) {
    throw new Error("Coupon type must be percent, fixed, or free");
  }
  if (input.type !== "free") {
    const value = Number(input.value);
    if (Number.isNaN(value) || value < 0) {
      throw new Error("Coupon value must be a number 0 or greater");
    }
    if (input.type === "percent" && value > 100) {
      throw new Error("Percent coupons cannot be over 100");
    }
  }
  const maxUses = couponMaxUses({ maxUses: Number(input.maxUses) || 0 });
  let created: Coupon | null = null;
  const data = await mutate((store) => {
    ensureCoupons(store);
    if ((store.coupons || []).some((c) => codesMatch(c.code, code))) {
      throw new Error("That coupon code already exists");
    }
    created = normalizeCoupon({
      id: randomUUID(),
      code,
      description: (input.description || "").trim(),
      type: input.type,
      value: input.type === "free" ? 100 : Number(input.value) || 0,
      active: input.active ?? true,
      maxUses,
      usedCount: Math.max(0, Math.floor(Number(input.usedCount) || 0)),
      system: Boolean(input.system),
    });
    store.coupons = store.coupons || [];
    store.coupons.unshift(created);
  }, { catalog: true });
  return { coupon: created!, coupons: [...(data.coupons || [])] };
}

export async function updateCoupon(id: string, patch: Partial<Coupon>) {
  let updated: Coupon | null = null;
  const data = await mutate((store) => {
    ensureCoupons(store);
    const idx = (store.coupons || []).findIndex((c) => c.id === id);
    if (idx === -1) return;
    const current = store.coupons![idx];
    const nextCode = patch.code
      ? normalizeCouponCode(patch.code)
      : current.code;
    if (!nextCode) throw new Error("Coupon code is required");
    if (
      (store.coupons || []).some(
        (c) => c.id !== id && codesMatch(c.code, nextCode)
      )
    ) {
      throw new Error("That coupon code already exists");
    }
    const nextType = patch.type || current.type;
    let nextValue = Number(patch.value ?? current.value);
    if (Number.isNaN(nextValue) || nextValue < 0) {
      throw new Error("Coupon value must be a number 0 or greater");
    }
    if (nextType === "free") nextValue = 100;
    if (nextType === "percent" && nextValue > 100) {
      throw new Error("Percent coupons cannot be over 100");
    }
    const nextMaxUses =
      typeof patch.maxUses === "number"
        ? couponMaxUses({ maxUses: patch.maxUses })
        : current.maxUses;
    const nextUsedCount =
      typeof patch.usedCount === "number"
        ? Math.max(0, Math.floor(patch.usedCount))
        : current.usedCount;

    const next: Coupon = normalizeCoupon({
      ...current,
      description:
        typeof patch.description === "string"
          ? patch.description.trim()
          : current.description,
      id: current.id,
      code: nextCode,
      type: nextType,
      value: nextValue,
      active: typeof patch.active === "boolean" ? patch.active : current.active,
      maxUses: nextMaxUses,
      usedCount: nextUsedCount,
      // Keep system flag only as a label; coupons are fully editable/removable
      system: current.system,
    });
    store.coupons![idx] = next;
    updated = next;
  }, { catalog: true });
  if (!updated) return null;
  return { coupon: updated, coupons: [...(data.coupons || [])] };
}

export async function deleteCoupon(id: string) {
  let ok = false;
  let removedCode = "";
  const data = await mutate((store) => {
    ensureCoupons(store);
    const target = (store.coupons || []).find((c) => c.id === id);
    if (!target) return;
    removedCode = target.code;
    const before = store.coupons!.length;
    store.coupons = store.coupons!.filter((c) => c.id !== id);
    ok = store.coupons.length < before;
  }, { catalog: true });
  return { ok, removedCode, coupons: [...(data.coupons || [])] };
}

/** Count one successful checkout redemption for a coupon code */
export async function recordCouponUse(code: string) {
  const key = normalizeCouponCode(code);
  if (!key) return null;
  let updated: Coupon | null = null;
  const data = await mutate((store) => {
    ensureCoupons(store);
    const idx = (store.coupons || []).findIndex((c) => codesMatch(c.code, key));
    if (idx === -1) return;
    const current = store.coupons![idx];
    const next = normalizeCoupon({
      ...current,
      usedCount: couponUsedCount(current) + 1,
    });
    store.coupons![idx] = next;
    updated = next;
  }, { catalog: true });
  return updated
    ? { coupon: updated, coupons: [...(data.coupons || [])] }
    : null;
}

export async function updateOrder(
  id: string,
  patch: Partial<
    Pick<
      Order,
      | "status"
      | "shopifyDraftOrderId"
      | "shopifyInvoiceUrl"
      | "paymentProvider"
      | "items"
      | "subtotal"
      | "discountAmount"
      | "couponCode"
      | "total"
      | "drillingNotes"
      | "customerNotifiedAt"
      | "handedOffAt"
      | "phoneNumber"
    >
  >
) {
  let updated: Order | null = null;
  await mutate((data) => {
    const idx = (data.orders || []).findIndex((o) => o.id === id);
    if (idx === -1) return;
    let next: Order = {
      ...data.orders[idx],
      ...patch,
      id,
      fulfillment: "in_store",
      updatedAt: new Date().toISOString(),
    };
    if (patch.status && patch.status !== data.orders[idx].status) {
      next = appendStatusHistory(
        next,
        patch.status,
        patch.status === "completed"
          ? "Handed off in store"
          : "Updated in Operations"
      );
      if (patch.status === "completed" && !next.handedOffAt) {
        next.handedOffAt = next.updatedAt;
      }
    }
    data.orders[idx] = next;
    updated = next;
  });
  return updated;
}

/** Ops workstation patch: notes, notify flag, status advance */
export async function updateOrderFulfillment(
  id: string,
  patch: {
    status?: OrderStatus;
    drillingNotes?: string;
    customerNotified?: boolean;
    markHandedOff?: boolean;
  }
) {
  let updated: Order | null = null;
  await mutate((data) => {
    const idx = (data.orders || []).findIndex((o) => o.id === id);
    if (idx === -1) return;
    let next: Order = {
      ...data.orders[idx],
      fulfillment: "in_store",
    };
    if (typeof patch.drillingNotes === "string") {
      next.drillingNotes = patch.drillingNotes;
    }
    if (patch.customerNotified === true) {
      next.customerNotifiedAt = new Date().toISOString();
      next = appendStatusHistory(
        next,
        next.status,
        "Customer notified — come in for drilling/pickup",
        { force: true }
      );
    }
    if (patch.markHandedOff || patch.status === "completed") {
      next.handedOffAt = new Date().toISOString();
    }
    if (patch.status && patch.status !== next.status) {
      next = appendStatusHistory(
        next,
        patch.status,
        patch.status === "completed"
          ? "Handed off in store"
          : "Updated in Operations"
      );
    } else {
      next.updatedAt = new Date().toISOString();
    }
    data.orders[idx] = next;
    updated = next;
  });
  return updated;
}

/** Cancel stale unpaid Shopify checkouts so shoppers can't pay old prices. */
export async function cancelOpenShopifyCheckoutsForUser(
  userId: string,
  exceptOrderId?: string
) {
  const cancelled: Order[] = [];
  await mutate((data) => {
    data.orders = (data.orders || []).map((o) => {
      if (o.userId !== userId) return o;
      if (exceptOrderId && o.id === exceptOrderId) return o;
      if (o.status !== "awaiting_payment") return o;
      if (o.paymentProvider !== "shopify") return o;
      if (o.inventoryApplied) return o;
      const next = { ...o, status: "cancelled" as OrderStatus };
      cancelled.push(next);
      return next;
    });
  });
  return cancelled;
}

/** After Ops price/discount/stock edits — void every unpaid Shopify invoice. */
export async function cancelAllOpenShopifyCheckouts() {
  const cancelled: Order[] = [];
  await mutate((data) => {
    data.orders = (data.orders || []).map((o) => {
      if (o.status !== "awaiting_payment") return o;
      if (o.paymentProvider !== "shopify") return o;
      if (o.inventoryApplied) return o;
      const next = { ...o, status: "cancelled" as OrderStatus };
      cancelled.push(next);
      return next;
    });
  });
  return cancelled;
}

export async function findOrderById(id: string) {
  const data = await getStore();
  return (data.orders || []).find((o) => o.id === id) || null;
}

export async function findOrderByShopifyDraftId(draftId: string) {
  const data = await getStore();
  return (
    (data.orders || []).find((o) => o.shopifyDraftOrderId === draftId) || null
  );
}

export async function listOrdersForUser(userId: string) {
  const data = await getStore();
  return (data.orders || []).filter((o) => o.userId === userId);
}

export async function listAllOrders() {
  return (await getStore()).orders || [];
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  return updateOrderFulfillment(id, { status });
}

/** Enrich Ops order list with phone from user account when missing on older orders */
export async function listAllOrdersForOps() {
  const data = await getStore();
  const users = new Map(data.users.map((u) => [u.id, u]));
  return (data.orders || []).map((o) => {
    const u = users.get(o.userId);
    return {
      ...o,
      fulfillment: "in_store" as const,
      phoneNumber: o.phoneNumber || u?.phoneNumber || undefined,
    };
  });
}

export async function listCoaches() {
  return (await getStore()).coaches || [];
}

export async function createCoach(input: Omit<Coach, "id">) {
  let created: Coach | null = null;
  await mutate((data) => {
    data.coaches = data.coaches || [];
    created = { ...input, id: randomUUID() };
    data.coaches.push(created);
  });
  return created!;
}

export async function updateCoach(id: string, patch: Partial<Coach>) {
  let updated: Coach | null = null;
  await mutate((data) => {
    data.coaches = data.coaches || [];
    const idx = data.coaches.findIndex((c) => c.id === id);
    if (idx === -1) return;
    data.coaches[idx] = { ...data.coaches[idx], ...patch, id };
    updated = data.coaches[idx];
  });
  return updated;
}

export async function deleteCoach(id: string) {
  let ok = false;
  await mutate((data) => {
    data.coaches = data.coaches || [];
    const before = data.coaches.length;
    data.coaches = data.coaches.filter((c) => c.id !== id);
    ok = data.coaches.length < before;
  });
  return ok;
}

export async function listTexts(page?: string) {
  const texts = (await getStore()).texts || [];
  return page ? texts.filter((t) => t.page === page) : texts;
}

export async function getText(page: string, slot: string, fallback = "") {
  const texts = await listTexts(page);
  return texts.find((t) => t.slot === slot)?.text || fallback;
}

export async function upsertText(page: string, slot: string, text: string) {
  let saved: PageText | null = null;
  await mutate((data) => {
    data.texts = data.texts || [];
    const idx = data.texts.findIndex((t) => t.page === page && t.slot === slot);
    if (idx >= 0) {
      data.texts[idx] = { ...data.texts[idx], text };
      saved = data.texts[idx];
    } else {
      saved = { id: randomUUID(), page, slot, text };
      data.texts.push(saved);
    }
  });
  return saved!;
}

export async function createText(input: Omit<PageText, "id">) {
  let created: PageText | null = null;
  await mutate((data) => {
    data.texts = data.texts || [];
    created = { ...input, id: randomUUID() };
    data.texts.push(created);
  });
  return created!;
}

export async function deleteText(id: string) {
  let ok = false;
  await mutate((data) => {
    data.texts = data.texts || [];
    const before = data.texts.length;
    data.texts = data.texts.filter((t) => t.id !== id);
    ok = data.texts.length < before;
  });
  return ok;
}

export function userHasPermission(permissions: Permission[], needed: Permission) {
  return permissions.includes(needed);
}

export async function getShopifyConfig(): Promise<ShopifySiteConfig | null> {
  const { loadDurableShopifyConfig } = await import("./shopify-config-store");
  const dedicated = await loadDurableShopifyConfig();
  const data = await getStore();
  const fromStore = data.shopifyConfig || null;
  if (!dedicated && !fromStore) return null;
  return {
    ...(fromStore || {}),
    ...(dedicated || {}),
    storeDomain: dedicated?.storeDomain || fromStore?.storeDomain,
    clientId: dedicated?.clientId || fromStore?.clientId,
    clientSecret: dedicated?.clientSecret || fromStore?.clientSecret,
    webhookSecret: dedicated?.webhookSecret || fromStore?.webhookSecret,
    adminAccessToken:
      dedicated?.adminAccessToken || fromStore?.adminAccessToken,
    apiVersion: dedicated?.apiVersion || fromStore?.apiVersion || "2025-01",
    updatedAt:
      (dedicated?.updatedAt || "") > (fromStore?.updatedAt || "")
        ? dedicated?.updatedAt
        : fromStore?.updatedAt,
    updatedBy: dedicated?.updatedBy || fromStore?.updatedBy,
  };
}

export async function saveShopifyConfig(
  input: ShopifySiteConfig,
  opts?: { updatedBy?: string }
) {
  const prev = (await getShopifyConfig()) || {};
  const saved: ShopifySiteConfig = {
    storeDomain: (input.storeDomain ?? prev.storeDomain ?? "")
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .trim(),
    clientId: (input.clientId ?? prev.clientId ?? "").trim(),
    clientSecret: (input.clientSecret ?? prev.clientSecret ?? "").trim(),
    webhookSecret: (input.webhookSecret ?? prev.webhookSecret ?? "").trim(),
    adminAccessToken: (
      input.adminAccessToken ??
      prev.adminAccessToken ??
      ""
    ).trim(),
    apiVersion: (input.apiVersion ?? prev.apiVersion ?? "2025-01").trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: opts?.updatedBy || prev.updatedBy,
  };

  // Keep a copy on the main store...
  await mutate((data) => {
    data.shopifyConfig = saved;
  });

  // ...and also on a small dedicated durable key so large catalog writes
  // cannot drop checkout credentials.
  const { saveDurableShopifyConfig } = await import("./shopify-config-store");
  const dedicated = await saveDurableShopifyConfig(saved);
  if (dedicated.ok) {
    g().lastPersistOk = true;
  }
  (saved as ShopifySiteConfig & { _persistDetail?: string })._persistDetail =
    dedicated.detail;
  return saved;
}
