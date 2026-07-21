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
} from "./types";
import { ALL_PERMISSIONS } from "./types";
import seedJson from "@/data/seed.json";

const GLOBAL_KEY = "__bba_store_v4__";

type GlobalStore = {
  data: StoreData | null;
  ready: Promise<StoreData> | null;
};

function g(): GlobalStore {
  const root = globalThis as typeof globalThis & { [GLOBAL_KEY]?: GlobalStore };
  if (!root[GLOBAL_KEY]) {
    root[GLOBAL_KEY] = { data: null, ready: null };
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
      id: "role_admin",
      name: "Admin",
      description: "Full website owner access",
      permissions: [...ALL_PERMISSIONS],
      system: true,
    },
    {
      id: "role_customer",
      name: "Customer",
      description: "Shop and place orders",
      permissions: [],
      system: true,
    },
    {
      id: "role_staff",
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
      system: false,
    },
  ];
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
  return seed;
}

function migrateUsers(users: User[], roles: Role[]): User[] {
  const adminId = roles.find((r) => r.name.toLowerCase() === "admin")?.id || "role_admin";
  const customerId =
    roles.find((r) => r.name.toLowerCase() === "customer")?.id || "role_customer";

  return users.map((u) => {
    const next = { ...u };
    if (!next.roleId) {
      next.roleId =
        next.role === "admin" || next.username?.toLowerCase() === "damian_e"
          ? adminId
          : customerId;
    }
    return next;
  });
}

async function ensureAdmin(data: StoreData): Promise<void> {
  data.roles = data.roles?.length ? data.roles : defaultRoles();
  data.orders = data.orders || [];
  data.users = migrateUsers(data.users || [], data.roles);

  const adminRole =
    data.roles.find((r) => r.id === "role_admin") ||
    data.roles.find((r) => r.name.toLowerCase() === "admin") ||
    data.roles[0];

  const existing = data.users.find(
    (u) =>
      u.username.toLowerCase() === "damian_e" ||
      u.email.toLowerCase() === "damianeddins630@gmail.com"
  );

  if (existing) {
    existing.username = "Damian_e";
    existing.email = "damianeddins630@gmail.com";
    existing.roleId = adminRole.id;
    existing.role = "admin";
    return;
  }

  data.users.push({
    id: randomUUID(),
    email: "damianeddins630@gmail.com",
    username: "Damian_e",
    passwordHash: await bcrypt.hash("Archer6!9", 10),
    phoneNumber: "",
    dateOfBirth: "1990-01-01",
    roleId: adminRole.id,
    role: "admin",
    createdAt: new Date().toISOString(),
  });
}

async function loadFromDisk(): Promise<StoreData> {
  const rt = runtimePath();
  try {
    const raw = await fs.readFile(rt, "utf8");
    const parsed = JSON.parse(raw) as StoreData;
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
  try {
    const rt = runtimePath();
    await fs.mkdir(path.dirname(rt), { recursive: true });
    await fs.writeFile(rt, JSON.stringify(data), "utf8");
  } catch {
    // ignore
  }
}

export async function getStore(): Promise<StoreData> {
  const store = g();
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
        store.data = fallback;
        return fallback;
      });
  }
  return store.ready;
}

async function mutate(updater: (data: StoreData) => void | Promise<void>) {
  const data = await getStore();
  await updater(data);
  g().data = data;
  await persist(data);
  return data;
}

export async function getRoleById(id: string) {
  const data = await getStore();
  return data.roles.find((r) => r.id === id) || null;
}

export async function resolveUserRole(user: User): Promise<Role> {
  const data = await getStore();
  const byId = data.roles.find((r) => r.id === user.roleId);
  if (byId) return byId;
  if (user.role === "admin" || user.username.toLowerCase() === "damian_e") {
    return (
      data.roles.find((r) => r.id === "role_admin") ||
      defaultRoles()[0]
    );
  }
  return (
    data.roles.find((r) => r.id === "role_customer") ||
    defaultRoles()[1]
  );
}

export async function listRoles() {
  return (await getStore()).roles;
}

export async function createRole(input: Omit<Role, "id" | "system">) {
  let created: Role | null = null;
  await mutate((data) => {
    created = {
      id: randomUUID(),
      name: input.name,
      description: input.description || "",
      permissions: input.permissions || [],
      system: false,
    };
    data.roles.push(created);
  });
  return created!;
}

export async function updateRole(id: string, patch: Partial<Role>) {
  let updated: Role | null = null;
  await mutate((data) => {
    const idx = data.roles.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const current = data.roles[idx];
    data.roles[idx] = {
      ...current,
      ...patch,
      id,
      system: current.system,
      permissions: patch.permissions || current.permissions,
    };
    updated = data.roles[idx];
  });
  return updated;
}

export async function deleteRole(id: string) {
  let ok = false;
  await mutate((data) => {
    const role = data.roles.find((r) => r.id === id);
    if (!role || role.system) return;
    const customer =
      data.roles.find((r) => r.id === "role_customer") || data.roles[1];
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
  return (await getStore()).users;
}

export async function updateUser(id: string, patch: Partial<User>) {
  let updated: User | null = null;
  await mutate((data) => {
    const idx = data.users.findIndex((u) => u.id === id);
    if (idx === -1) return;
    data.users[idx] = { ...data.users[idx], ...patch, id };
    updated = data.users[idx];
  });
  return updated;
}

export async function listProducts(opts?: { includeInactive?: boolean }) {
  const data = await getStore();
  return data.products.filter((p) => opts?.includeInactive || p.active);
}

export async function getProduct(id: string) {
  const data = await getStore();
  return data.products.find((p) => p.id === id || p.slug === id) || null;
}

export async function createProduct(input: Omit<Product, "id">) {
  let created: Product | null = null;
  await mutate((data) => {
    created = { ...input, id: randomUUID() };
    data.products.unshift(created);
  });
  return created!;
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  let updated: Product | null = null;
  await mutate((data) => {
    const idx = data.products.findIndex((p) => p.id === id);
    if (idx === -1) return;
    data.products[idx] = { ...data.products[idx], ...patch, id };
    updated = data.products[idx];
  });
  return updated;
}

export async function deleteProduct(id: string) {
  let ok = false;
  await mutate((data) => {
    const before = data.products.length;
    data.products = data.products.filter((p) => p.id !== id);
    ok = data.products.length < before;
  });
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
  });
  return created!;
}

export async function updateSponsor(id: string, patch: Partial<Sponsor>) {
  let updated: Sponsor | null = null;
  await mutate((data) => {
    const idx = data.sponsors.findIndex((s) => s.id === id);
    if (idx === -1) return;
    data.sponsors[idx] = { ...data.sponsors[idx], ...patch, id };
    updated = data.sponsors[idx];
  });
  return updated;
}

export async function deleteSponsor(id: string) {
  let ok = false;
  await mutate((data) => {
    const before = data.sponsors.length;
    data.sponsors = data.sponsors.filter((s) => s.id !== id);
    ok = data.sponsors.length < before;
  });
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
  });
  return created!;
}

export async function updateDeal(id: string, patch: Partial<Deal>) {
  let updated: Deal | null = null;
  await mutate((data) => {
    const idx = data.deals.findIndex((d) => d.id === id);
    if (idx === -1) return;
    data.deals[idx] = { ...data.deals[idx], ...patch, id };
    updated = data.deals[idx];
  });
  return updated;
}

export async function deleteDeal(id: string) {
  let ok = false;
  await mutate((data) => {
    const before = data.deals.length;
    data.deals = data.deals.filter((d) => d.id !== id);
    ok = data.deals.length < before;
  });
  return ok;
}

export async function findUserByLogin(login: string) {
  const data = await getStore();
  const key = login.trim().toLowerCase();
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
  const data = await getStore();
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();
  if (data.users.some((u) => u.email.toLowerCase() === email)) {
    throw new Error("Email already registered");
  }
  if (data.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("Username already taken");
  }
  const customer =
    data.roles.find((r) => r.id === "role_customer") ||
    data.roles.find((r) => r.name.toLowerCase() === "customer");
  const user: User = {
    id: randomUUID(),
    email,
    username,
    passwordHash: await bcrypt.hash(input.password, 10),
    phoneNumber: input.phoneNumber,
    dateOfBirth: input.dateOfBirth,
    roleId: input.roleId || customer?.id || "role_customer",
    role: "customer",
    createdAt: new Date().toISOString(),
  };
  await mutate((d) => {
    d.users.push(user);
  });
  return user;
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

export async function reduceStock(items: { productId: string; quantity: number }[]) {
  await mutate((data) => {
    for (const item of items) {
      const p = data.products.find((x) => x.id === item.productId);
      if (!p) throw new Error("Product not found");
      if (p.stock < item.quantity) throw new Error(`Not enough stock for ${p.name}`);
      p.stock -= item.quantity;
    }
  });
}

export async function createOrder(input: {
  userId: string;
  username: string;
  email: string;
  items: OrderItem[];
  total: number;
}) {
  let created: Order | null = null;
  await mutate((data) => {
    created = {
      id: randomUUID(),
      userId: input.userId,
      username: input.username,
      email: input.email,
      items: input.items,
      total: input.total,
      status: "placed",
      createdAt: new Date().toISOString(),
    };
    data.orders = data.orders || [];
    data.orders.unshift(created);
  });
  return created!;
}

export async function listOrdersForUser(userId: string) {
  const data = await getStore();
  return (data.orders || []).filter((o) => o.userId === userId);
}

export async function listAllOrders() {
  return (await getStore()).orders || [];
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  let updated: Order | null = null;
  await mutate((data) => {
    const idx = (data.orders || []).findIndex((o) => o.id === id);
    if (idx === -1) return;
    data.orders[idx] = { ...data.orders[idx], status };
    updated = data.orders[idx];
  });
  return updated;
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
