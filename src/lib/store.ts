import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { StoreData, User, Product, Sponsor, Deal, Subscriber } from "./types";
import { hashPassword } from "./auth";

const GLOBAL_KEY = "__bba_store__";

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
  // Writable on local + Vercel /tmp
  if (process.env.VERCEL) return path.join("/tmp", "bba-store.json");
  return path.join(process.cwd(), "data", "runtime.json");
}

function seedPath() {
  return path.join(process.cwd(), "data", "seed.json");
}

async function ensureAdmin(users: User[]): Promise<User[]> {
  const existing = users.find(
    (u) => u.username.toLowerCase() === "damian_e" || u.email.toLowerCase() === "damianeddins630@gmail.com"
  );
  if (existing) {
    existing.role = "admin";
    return users;
  }
  const admin: User = {
    id: randomUUID(),
    email: "damianeddins630@gmail.com",
    username: "Damian_e",
    passwordHash: await hashPassword("Archer6!9"),
    phoneNumber: "",
    dateOfBirth: "1990-01-01",
    role: "admin",
    createdAt: new Date().toISOString(),
  };
  return [...users, admin];
}

async function loadFromDisk(): Promise<StoreData> {
  const rt = runtimePath();
  try {
    const raw = await fs.readFile(rt, "utf8");
    const parsed = JSON.parse(raw) as StoreData;
    parsed.users = await ensureAdmin(parsed.users || []);
    return parsed;
  } catch {
    // fall through to seed
  }
  const seedRaw = await fs.readFile(seedPath(), "utf8");
  const seed = JSON.parse(seedRaw) as StoreData;
  seed.users = await ensureAdmin(seed.users || []);
  seed.subscribers = seed.subscribers || [];
  return seed;
}

async function persist(data: StoreData) {
  try {
    const rt = runtimePath();
    await fs.mkdir(path.dirname(rt), { recursive: true });
    await fs.writeFile(rt, JSON.stringify(data, null, 2), "utf8");
  } catch {
    // Read-only environments: keep in-memory only
  }
}

export async function getStore(): Promise<StoreData> {
  const store = g();
  if (store.data) return store.data;
  if (!store.ready) {
    store.ready = loadFromDisk().then((data) => {
      store.data = data;
      return data;
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
  role?: User["role"];
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
  const user: User = {
    id: randomUUID(),
    email,
    username,
    passwordHash: await hashPassword(input.password),
    phoneNumber: input.phoneNumber,
    dateOfBirth: input.dateOfBirth,
    role: input.role || "customer",
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
