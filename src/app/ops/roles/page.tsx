"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Permission, Role } from "@/lib/types";
import { PERMISSION_LABELS } from "@/lib/types";
import {
  canManageRole,
  isOwnerRole,
  OWNER_ROLE_RANK,
  roleRank,
} from "@/lib/role-rank";

const empty = {
  name: "",
  description: "",
  permissions: [] as Permission[],
  rank: "25",
};

export default function OpsRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [actorRank, setActorRank] = useState(0);
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
    setActorRank(Number(data.actorRank) || 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const editingRole = useMemo(
    () => roles.find((r) => r.id === editingId) || null,
    [roles, editingId]
  );
  const editingLocked = Boolean(editingRole && isOwnerRole(editingRole));

  function togglePerm(p: Permission) {
    if (editingLocked) return;
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
    const payload = {
      name: form.name,
      description: form.description,
      permissions: form.permissions,
      rank: Number(form.rank),
    };
    const res = await fetch(editingId ? `/api/roles/${editingId}` : "/api/roles", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
        Roles are ranked. Higher ranks outrank lower ones. Website Owner is rank{" "}
        {OWNER_ROLE_RANK} and locked — its permissions can never be removed. Your rank:{" "}
        <span className="text-red">{actorRank}</span>
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
          {editingLocked && (
            <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
              Website Owner is locked. Permissions and rank cannot be changed.
            </p>
          )}
          <input
            className="field"
            placeholder="Role name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            disabled={editingLocked}
          />
          <textarea
            className="field min-h-20"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          {!editingLocked && (
            <div>
              <label className="label" htmlFor="rank">
                Rank (1–{Math.max(1, actorRank - 1)}, must be below yours)
              </label>
              <input
                id="rank"
                className="field"
                type="number"
                min={1}
                max={Math.max(1, actorRank - 1)}
                value={form.rank}
                onChange={(e) => setForm({ ...form, rank: e.target.value })}
                required
              />
            </div>
          )}
          <div>
            <p className="mb-2 text-sm text-mist">Permissions</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {permissions.map((p) => (
                <label
                  key={p}
                  className={`flex items-start gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm ${
                    editingLocked ? "opacity-60" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.permissions.includes(p)}
                    onChange={() => togglePerm(p)}
                    disabled={editingLocked}
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
            <button className="btn btn-primary" type="submit" disabled={editingLocked}>
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
          {roles.map((role) => {
            const rank = roleRank(role);
            const manageable = canManageRole(actorRank, role);
            const owner = isOwnerRole(role);
            return (
              <article
                key={role.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold">
                      {role.name}
                      <span className="ml-2 text-xs text-red">Rank {rank}</span>
                      {owner ? (
                        <span className="ml-2 text-xs text-amber-300">(locked owner)</span>
                      ) : role.system ? (
                        <span className="ml-2 text-xs text-mist">(system)</span>
                      ) : null}
                    </h4>
                    <p className="text-sm text-mist">{role.description || "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    {owner ? (
                      <span className="text-xs text-mist">Protected</span>
                    ) : manageable ? (
                      <>
                        <button
                          type="button"
                          className="text-xs text-red underline"
                          onClick={() => {
                            setEditingId(role.id);
                            setForm({
                              name: role.name,
                              description: role.description,
                              permissions: [...role.permissions],
                              rank: String(roleRank(role)),
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
                      </>
                    ) : (
                      <span className="text-xs text-mist">Above your rank</span>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs text-mist">
                  {role.permissions.length
                    ? role.permissions.map((p) => PERMISSION_LABELS[p] || p).join(" · ")
                    : "No permissions"}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
