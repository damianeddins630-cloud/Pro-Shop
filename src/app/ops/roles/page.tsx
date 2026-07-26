"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Permission, Role } from "@/lib/types";
import { PERMISSION_LABELS } from "@/lib/types";

const empty = {
  name: "",
  description: "",
  permissions: [] as Permission[],
};

export default function OpsRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/roles", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load roles");
      setLoading(false);
      return;
    }
    setRoles(data.roles || []);
    setPermissions(data.permissions || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function togglePerm(p: Permission) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p)
        ? f.permissions.filter((x) => x !== p)
        : [...f.permissions, p],
    }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const res = await fetch(editingId ? `/api/roles/${editingId}` : "/api/roles", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setMessage(editingId ? "Role updated" : "Role created");
    setForm(empty);
    setEditingId(null);
    load();
  }

  async function remove(id: string) {
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

  if (loading) return <p className="text-mist">Loading roles...</p>;

  return (
    <div>
      <h2 className="display text-4xl">Roles & permissions</h2>
      <p className="mt-1 text-sm text-mist">
        Create roles, set what each role can do, and remove roles you no longer need.
      </p>
      {(message || error) && (
        <p className={`mt-4 text-sm ${error ? "text-red-300" : "text-emerald-300"}`}>
          {error || message}
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <form
          onSubmit={save}
          className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6"
        >
          <h3 className="display text-3xl">
            {editingId ? "Edit role" : "Create role"}
          </h3>
          <input
            className="field"
            placeholder="Role name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <textarea
            className="field min-h-20"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                    checked={form.permissions.includes(p)}
                    onChange={() => togglePerm(p)}
                  />
                  <span>
                    <span className="block text-chalk">
                      {PERMISSION_LABELS[p] || p}
                    </span>
                    <span className="text-xs text-mist">{p}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" type="submit">
              {editingId ? "Save role" : "Add role"}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(empty);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="space-y-3">
          <h3 className="display text-3xl">Roles ({roles.length})</h3>
          {roles.map((role) => (
            <article
              key={role.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold">
                    {role.name}
                    {role.system ? (
                      <span className="ml-2 text-xs text-mist">(system)</span>
                    ) : null}
                  </h4>
                  <p className="text-sm text-mist">{role.description || "—"}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-red underline"
                    onClick={() => {
                      setEditingId(role.id);
                      setForm({
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
                      onClick={() => remove(role.id)}
                    >
                      Remove
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
    </div>
  );
}
