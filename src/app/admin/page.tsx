"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  Deal,
  Order,
  OrderStatus,
  Permission,
  Product,
  PublicUser,
  Role,
  Sponsor,
} from "@/lib/types";
import { PERMISSION_LABELS } from "@/lib/types";

type Tab = "inventory" | "deals" | "sponsors" | "roles" | "users" | "orders";

const emptyProduct = {
  name: "",
  description: "",
  price: 0,
  stock: 0,
  category: "Accessories",
  brand: "Ballard's Bowling",
  image: "",
  featured: false,
  active: true,
};

function hasPerm(user: PublicUser | null, ...perms: Permission[]) {
  if (!user?.permissions) return false;
  return perms.some((p) => user.permissions.includes(p));
}

export default function AdminPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [tab, setTab] = useState<Tab>("inventory");
  const [products, setProducts] = useState<Product[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dealForm, setDealForm] = useState({
    title: "",
    description: "",
    image: "",
    active: true,
    featured: false,
  });
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [sponsorForm, setSponsorForm] = useState({ name: "", image: "", url: "#" });
  const [editingSponsorId, setEditingSponsorId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    permissions: [] as Permission[],
  });
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const canAccess =
    hasPerm(
      user,
      "manage_inventory",
      "manage_deals",
      "manage_sponsors",
      "manage_roles",
      "manage_users",
      "view_orders",
      "manage_orders",
      "edit_pages"
    );

  const load = useCallback(async () => {
    const me = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json());
    const u = me.user as PublicUser | null;
    setUser(u);
    if (!u) {
      setLoading(false);
      return;
    }

    const tasks: Promise<void>[] = [];

    if (hasPerm(u, "manage_inventory", "edit_pages")) {
      tasks.push(
        fetch("/api/products?admin=1")
          .then((r) => r.json())
          .then((d) => setProducts(d.products || []))
      );
    }
    if (hasPerm(u, "manage_deals", "edit_pages")) {
      tasks.push(
        fetch("/api/deals")
          .then((r) => r.json())
          .then((d) => setDeals(d.deals || []))
      );
    }
    if (hasPerm(u, "manage_sponsors", "edit_pages")) {
      tasks.push(
        fetch("/api/sponsors")
          .then((r) => r.json())
          .then((d) => setSponsors(d.sponsors || []))
      );
    }
    if (hasPerm(u, "manage_roles", "manage_users")) {
      tasks.push(
        fetch("/api/roles")
          .then((r) => r.json())
          .then((d) => {
            setRoles(d.roles || []);
            setPermissions(d.permissions || []);
          })
      );
    }
    if (hasPerm(u, "manage_users")) {
      tasks.push(
        fetch("/api/users")
          .then((r) => r.json())
          .then((d) => setUsers(d.users || []))
      );
    }
    if (hasPerm(u, "view_orders", "manage_orders")) {
      tasks.push(
        fetch("/api/orders?all=1")
          .then((r) => r.json())
          .then((d) => setOrders(d.orders || []))
      );
    }

    await Promise.all(tasks);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const preferred: Tab[] = [];
    if (hasPerm(user, "manage_inventory", "edit_pages")) preferred.push("inventory");
    if (hasPerm(user, "manage_deals", "edit_pages")) preferred.push("deals");
    if (hasPerm(user, "manage_sponsors", "edit_pages")) preferred.push("sponsors");
    if (hasPerm(user, "manage_roles")) preferred.push("roles");
    if (hasPerm(user, "manage_users")) preferred.push("users");
    if (hasPerm(user, "view_orders", "manage_orders")) preferred.push("orders");
    if (preferred.length && !preferred.includes(tab)) setTab(preferred[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function uploadImage(file: File): Promise<string | null> {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Upload failed");
      return null;
    }
    return data.url as string;
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const payload = {
      ...form,
      price: Number(form.price),
      stock: Number(form.stock),
    };
    const res = await fetch(editingId ? `/api/products/${editingId}` : "/api/products", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setMessage(editingId ? "Product updated" : "Product added");
    setForm(emptyProduct);
    setEditingId(null);
    load();
  }

  async function removeProduct(id: string) {
    if (!confirm("Delete this product from inventory?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Delete failed");
      return;
    }
    setMessage("Product deleted");
    load();
  }

  async function saveDeal(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(editingDealId ? `/api/deals/${editingDealId}` : "/api/deals", {
      method: editingDealId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dealForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setMessage(editingDealId ? "Deal updated" : "Deal added");
    setDealForm({ title: "", description: "", image: "", active: true, featured: false });
    setEditingDealId(null);
    load();
  }

  async function removeDeal(id: string) {
    if (!confirm("Delete this deal?")) return;
    await fetch(`/api/deals/${id}`, { method: "DELETE" });
    setMessage("Deal deleted");
    load();
  }

  async function saveSponsor(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(
      editingSponsorId ? `/api/sponsors/${editingSponsorId}` : "/api/sponsors",
      {
        method: editingSponsorId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sponsorForm),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setMessage(editingSponsorId ? "Sponsor updated" : "Sponsor added");
    setSponsorForm({ name: "", image: "", url: "#" });
    setEditingSponsorId(null);
    load();
  }

  async function removeSponsor(id: string) {
    if (!confirm("Delete this sponsor?")) return;
    await fetch(`/api/sponsors/${id}`, { method: "DELETE" });
    setMessage("Sponsor deleted");
    load();
  }

  async function saveRole(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const res = await fetch(editingRoleId ? `/api/roles/${editingRoleId}` : "/api/roles", {
      method: editingRoleId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(roleForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Role save failed");
      return;
    }
    setMessage(editingRoleId ? "Role updated" : "Role created");
    setRoleForm({ name: "", description: "", permissions: [] });
    setEditingRoleId(null);
    load();
  }

  async function removeRole(id: string) {
    if (!confirm("Delete this role? Users on it become Customers.")) return;
    const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Delete failed");
      return;
    }
    setMessage("Role deleted");
    load();
  }

  async function assignUserRole(userId: string, roleId: string) {
    setError("");
    const res = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, roleId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not update user role");
      return;
    }
    setMessage("User role updated");
    load();
  }

  async function setOrderStatus(id: string, status: OrderStatus) {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not update order");
      return;
    }
    setMessage("Order updated");
    load();
  }

  function toggleRolePerm(p: Permission) {
    setRoleForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p)
        ? f.permissions.filter((x) => x !== p)
        : [...f.permissions, p],
    }));
  }

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    {
      id: "inventory",
      label: "Inventory",
      show: hasPerm(user, "manage_inventory", "edit_pages"),
    },
    { id: "deals", label: "Deals", show: hasPerm(user, "manage_deals", "edit_pages") },
    {
      id: "sponsors",
      label: "Sponsors",
      show: hasPerm(user, "manage_sponsors", "edit_pages"),
    },
    { id: "roles", label: "Roles", show: hasPerm(user, "manage_roles") },
    { id: "users", label: "Users", show: hasPerm(user, "manage_users") },
    {
      id: "orders",
      label: "Orders",
      show: hasPerm(user, "view_orders", "manage_orders"),
    },
  ];

  if (loading) {
    return (
      <section className="site-shell section-pad pt-24">
        <p className="text-mist">Loading admin...</p>
      </section>
    );
  }

  if (!user || !canAccess) {
    return (
      <section className="site-shell section-pad pt-24">
        <h1 className="display text-5xl">Admin</h1>
        <p className="mt-4 text-mist">Login required with admin permissions.</p>
        <Link href="/login" className="btn btn-primary mt-6">
          Login
        </Link>
      </section>
    );
  }

  return (
    <section className="site-shell section-pad pt-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm tracking-[0.2em] text-red uppercase">Owner dashboard</p>
          <h1 className="display text-5xl md:text-6xl">Inventory & Site Admin</h1>
          <p className="mt-2 text-mist">
            Signed in as <span className="text-red">{user.username}</span> (
            {user.roleName})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-2 text-sm ${
                  tab === t.id
                    ? "bg-red text-white font-bold"
                    : "border border-white/15 text-mist"
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>
      </div>

      {(message || error) && (
        <p className={`mb-6 text-sm ${error ? "text-red-300" : "text-emerald-300"}`}>
          {error || message}
        </p>
      )}

      {tab === "inventory" && (
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <form
            onSubmit={saveProduct}
            className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h2 className="display text-3xl">
              {editingId ? "Update product" : "Add inventory"}
            </h2>
            <input
              className="field"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <textarea
              className="field min-h-24"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="field"
                type="number"
                step="0.01"
                placeholder="Price"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                required
              />
              <input
                className="field"
                type="number"
                placeholder="Stock"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="field"
                placeholder="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <input
                className="field"
                placeholder="Brand"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </div>
            <input
              className="field"
              placeholder="Image URL or upload below"
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              required
            />
            <input
              type="file"
              accept="image/*"
              className="text-sm text-mist"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await uploadImage(file);
                if (url) setForm((f) => ({ ...f, image: url }));
              }}
            />
            {form.image && (
              <div className="relative h-28 w-28 overflow-hidden rounded-xl border border-white/10">
                <Image src={form.image} alt="" fill className="object-contain" unoptimized />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-mist">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm text-mist">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active on website
            </label>
            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit">
                {editingId ? "Update" : "Add product"}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyProduct);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="space-y-3">
            <h2 className="display text-3xl">Current inventory ({products.length})</h2>
            <div className="max-h-[70vh] space-y-3 overflow-auto pr-1">
              {products.map((p) => (
                <article
                  key={p.id}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/30">
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      className="object-contain p-1"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{p.name}</h3>
                    <p className="text-sm text-mist">
                      ${p.price.toFixed(2)} · stock {p.stock} · {p.brand}
                      {!p.active && " · hidden"}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="text-xs text-red underline"
                        onClick={() => {
                          setEditingId(p.id);
                          setForm({
                            name: p.name,
                            description: p.description,
                            price: p.price,
                            stock: p.stock,
                            category: p.category,
                            brand: p.brand,
                            image: p.image,
                            featured: p.featured,
                            active: p.active,
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-300 underline"
                        onClick={() => removeProduct(p.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "deals" && (
        <div className="grid gap-8 lg:grid-cols-2">
          <form
            onSubmit={saveDeal}
            className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h2 className="display text-3xl">
              {editingDealId ? "Update deal" : "Add deal"}
            </h2>
            <input
              className="field"
              placeholder="Title"
              value={dealForm.title}
              onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })}
              required
            />
            <textarea
              className="field min-h-24"
              placeholder="Description"
              value={dealForm.description}
              onChange={(e) => setDealForm({ ...dealForm, description: e.target.value })}
            />
            <input
              className="field"
              placeholder="Image URL"
              value={dealForm.image}
              onChange={(e) => setDealForm({ ...dealForm, image: e.target.value })}
              required
            />
            <input
              type="file"
              accept="image/*"
              className="text-sm text-mist"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await uploadImage(file);
                if (url) setDealForm((f) => ({ ...f, image: url }));
              }}
            />
            <label className="flex items-center gap-2 text-sm text-mist">
              <input
                type="checkbox"
                checked={dealForm.featured}
                onChange={(e) => setDealForm({ ...dealForm, featured: e.target.checked })}
              />
              Deal of the month
            </label>
            <label className="flex items-center gap-2 text-sm text-mist">
              <input
                type="checkbox"
                checked={dealForm.active}
                onChange={(e) => setDealForm({ ...dealForm, active: e.target.checked })}
              />
              Active
            </label>
            <button className="btn btn-primary" type="submit">
              {editingDealId ? "Update deal" : "Add deal"}
            </button>
          </form>
          <div className="space-y-3">
            {deals.map((d) => (
              <article
                key={d.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex gap-3">
                  <div className="relative h-20 w-28 overflow-hidden rounded-lg">
                    <Image
                      src={d.image}
                      alt={d.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold">{d.title}</h3>
                    <p className="text-xs text-mist">
                      {d.featured ? "Deal of the month · " : ""}
                      {d.active ? "Active" : "Hidden"}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="text-xs text-red underline"
                        onClick={() => {
                          setEditingDealId(d.id);
                          setDealForm({
                            title: d.title,
                            description: d.description,
                            image: d.image,
                            active: d.active,
                            featured: d.featured,
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-300 underline"
                        onClick={() => removeDeal(d.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === "sponsors" && (
        <div className="grid gap-8 lg:grid-cols-2">
          <form
            onSubmit={saveSponsor}
            className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h2 className="display text-3xl">
              {editingSponsorId ? "Update sponsor" : "Add sponsor (name + photo)"}
            </h2>
            <input
              className="field"
              placeholder="Sponsor name"
              value={sponsorForm.name}
              onChange={(e) => setSponsorForm({ ...sponsorForm, name: e.target.value })}
              required
            />
            <input
              className="field"
              placeholder="Image URL / logo"
              value={sponsorForm.image}
              onChange={(e) => setSponsorForm({ ...sponsorForm, image: e.target.value })}
              required
            />
            <input
              type="file"
              accept="image/*"
              className="text-sm text-mist"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await uploadImage(file);
                if (url) setSponsorForm((f) => ({ ...f, image: url }));
              }}
            />
            <input
              className="field"
              placeholder="Website URL"
              value={sponsorForm.url}
              onChange={(e) => setSponsorForm({ ...sponsorForm, url: e.target.value })}
            />
            <button className="btn btn-primary" type="submit">
              {editingSponsorId ? "Update sponsor" : "Add sponsor"}
            </button>
          </form>
          <div className="grid grid-cols-2 gap-3">
            {sponsors.map((s) => (
              <article
                key={s.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="relative mb-3 h-20 w-full">
                  <Image
                    src={s.image}
                    alt={s.name}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <h3 className="text-sm font-semibold">{s.name}</h3>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-red underline"
                    onClick={() => {
                      setEditingSponsorId(s.id);
                      setSponsorForm({ name: s.name, image: s.image, url: s.url });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-300 underline"
                    onClick={() => removeSponsor(s.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === "roles" && (
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <form
            onSubmit={saveRole}
            className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h2 className="display text-3xl">
              {editingRoleId ? "Update role" : "Create role"}
            </h2>
            <input
              className="field"
              placeholder="Role name"
              value={roleForm.name}
              onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
              required
            />
            <textarea
              className="field min-h-20"
              placeholder="Description"
              value={roleForm.description}
              onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
            />
            <div>
              <p className="mb-2 text-sm text-mist">Permissions</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {permissions.map((p) => (
                  <label
                    key={p}
                    className="flex items-start gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={roleForm.permissions.includes(p)}
                      onChange={() => toggleRolePerm(p)}
                    />
                    <span>
                      <span className="block text-chalk">{PERMISSION_LABELS[p] || p}</span>
                      <span className="text-xs text-mist">{p}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit">
                {editingRoleId ? "Update role" : "Add role"}
              </button>
              {editingRoleId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditingRoleId(null);
                    setRoleForm({ name: "", description: "", permissions: [] });
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="space-y-3">
            <h2 className="display text-3xl">Roles ({roles.length})</h2>
            {roles.map((role) => (
              <article
                key={role.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-chalk">
                      {role.name}
                      {role.system ? (
                        <span className="ml-2 text-xs text-mist">(system)</span>
                      ) : null}
                    </h3>
                    <p className="text-sm text-mist">{role.description || "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-red underline"
                      onClick={() => {
                        setEditingRoleId(role.id);
                        setRoleForm({
                          name: role.name,
                          description: role.description,
                          permissions: [...role.permissions],
                        });
                      }}
                    >
                      Edit
                    </button>
                    {!role.system && (
                      <button
                        type="button"
                        className="text-xs text-red-300 underline"
                        onClick={() => removeRole(role.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs text-mist">
                  {role.permissions.length
                    ? role.permissions.map((p) => PERMISSION_LABELS[p] || p).join(" · ")
                    : "No permissions"}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-3">
          <h2 className="display text-3xl">Users ({users.length})</h2>
          <div className="overflow-x-auto rounded-3xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-mist">
                <tr>
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/5">
                    <td className="px-4 py-3">{u.username}</td>
                    <td className="px-4 py-3 text-mist">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        className="field !py-2"
                        value={u.roleId}
                        onChange={(e) => assignUserRole(u.id, e.target.value)}
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-4">
          <h2 className="display text-3xl">All orders ({orders.length})</h2>
          {orders.length === 0 ? (
            <p className="text-mist">No orders yet.</p>
          ) : (
            orders.map((order) => (
              <article
                key={order.id}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-mist">
                      {new Date(order.createdAt).toLocaleString()} · {order.username} (
                      {order.email})
                    </p>
                    <h3 className="display mt-1 text-3xl">${order.total.toFixed(2)}</h3>
                  </div>
                  {hasPerm(user, "manage_orders") ? (
                    <select
                      className="field !w-auto !py-2 capitalize"
                      value={order.status}
                      onChange={(e) =>
                        setOrderStatus(order.id, e.target.value as OrderStatus)
                      }
                    >
                      {(["placed", "processing", "completed", "cancelled"] as OrderStatus[]).map(
                        (s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        )
                      )}
                    </select>
                  ) : (
                    <span className="rounded-full border border-red/40 px-3 py-1 text-xs capitalize text-red">
                      {order.status}
                    </span>
                  )}
                </div>
                <ul className="mt-4 space-y-2 text-sm text-mist">
                  {order.items.map((item) => (
                    <li key={`${order.id}-${item.productId}`}>
                      {item.name} × {item.quantity} — ${item.price.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </div>
      )}
    </section>
  );
}
