"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicUser, Role } from "@/lib/types";
import {
  canAssignRole,
  isOwnerRole,
  OWNER_ROLE_ID,
  roleRank,
} from "@/lib/role-rank";
import { useEditMode } from "@/lib/edit-mode";

export default function OpsUsersPage() {
  const { user: me, refreshUser } = useEditMode();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [actorRank, setActorRank] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [uRes, rRes] = await Promise.all([
      fetch("/api/users", { cache: "no-store", credentials: "same-origin" }),
      fetch("/api/roles", { cache: "no-store", credentials: "same-origin" }),
    ]);
    const uData = await uRes.json().catch(() => ({}));
    const rData = await rRes.json().catch(() => ({}));
    if (!uRes.ok) {
      setError(uData.error || "Could not load users");
      setUsers([]);
      setLoading(false);
      return;
    }
    setUsers(Array.isArray(uData.users) ? uData.users : []);
    setRoles(Array.isArray(rData.roles) ? rData.roles : []);
    setActorRank(Number(uData.actorRank ?? rData.actorRank) || 0);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assignableRoles = useMemo(
    () => roles.filter((r) => canAssignRole(actorRank, r) && !isOwnerRole(r)),
    [roles, actorRank]
  );

  async function assignRole(userId: string, roleId: string) {
    const previous = users.find((u) => u.id === userId);
    if (!previous || previous.roleId === roleId) return;

    setError("");
    setMessage("");
    setSavingId(userId);

    // Optimistic UI so the dropdown doesn't snap back while saving
    setUsers((list) =>
      list.map((u) => {
        if (u.id !== userId) return u;
        const role = roles.find((r) => r.id === roleId);
        return {
          ...u,
          roleId,
          roleName: role?.name || u.roleName,
          permissions: role?.permissions || u.permissions,
        };
      })
    );

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId, roleId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Revert
        setUsers((list) =>
          list.map((u) => (u.id === userId ? previous : u))
        );
        setError(data.error || "Could not update role");
        return;
      }
      if (Array.isArray(data.users)) {
        setUsers(data.users);
      } else if (data.user) {
        setUsers((list) =>
          list.map((u) => (u.id === data.user.id ? { ...u, ...data.user } : u))
        );
      } else {
        await load();
      }
      setMessage(
        `Saved ${data.user?.username || "user"} as ${data.user?.roleName || "updated role"}.`
      );
      // Refresh current session permissions if you edited yourself
      if (userId === me?.id) {
        await refreshUser();
      }
    } catch {
      setUsers((list) => list.map((u) => (u.id === userId ? previous : u)));
      setError("Could not update role — check your connection and try again.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <p className="text-mist">Loading users...</p>;

  return (
    <div>
      <h2 className="display text-4xl">Users & accounts</h2>
      <p className="mt-1 text-sm text-mist">
        Every account: when it was made, name, email, role, and whether they ordered.
        Role changes save immediately and apply the next time that user loads a page
        (no re-login needed). Website Owner stays locked.
      </p>
      {(message || error) && (
        <p className={`mt-4 text-sm ${error ? "text-red-300" : "text-emerald-300"}`}>
          {error || message}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-3xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.04] text-mist">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Orders</th>
              <th className="px-4 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const currentRole = roles.find((r) => r.id === u.roleId);
              const lockedOwner =
                u.id === "user_owner" ||
                u.username.toLowerCase() === "cv_damian" ||
                isOwnerRole(currentRole || { id: u.roleId, name: u.roleName });
              const targetOutranks =
                roleRank(currentRole || { id: u.roleId, name: u.roleName }) >=
                  actorRank &&
                u.id !== me?.id;

              return (
                <tr key={u.id} className="border-b border-white/5">
                  <td className="px-4 py-3 font-medium">
                    {u.username}
                    {lockedOwner && (
                      <span className="ml-2 text-xs text-amber-300">owner</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-mist">{u.email}</td>
                  <td className="px-4 py-3 text-mist">
                    {u.createdAt
                      ? new Date(u.createdAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {u.hasOrdered ? (
                      <span className="text-emerald-300">
                        Yes ({u.orderCount}
                        {u.lastOrderAt
                          ? ` · last ${new Date(u.lastOrderAt).toLocaleDateString()}`
                          : ""}
                        )
                      </span>
                    ) : (
                      <span className="text-mist">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lockedOwner || targetOutranks ? (
                      <span className="text-mist">
                        {u.roleName}
                        {lockedOwner ? " (locked)" : " (above your rank)"}
                      </span>
                    ) : (
                      <select
                        className="field !py-2"
                        value={u.roleId}
                        disabled={savingId === u.id}
                        onChange={(e) => assignRole(u.id, e.target.value)}
                      >
                        {!assignableRoles.some((r) => r.id === u.roleId) &&
                          currentRole && (
                            <option value={currentRole.id}>
                              {currentRole.name} (current)
                            </option>
                          )}
                        {assignableRoles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} · rank {roleRank(r)}
                          </option>
                        ))}
                        {u.roleId === OWNER_ROLE_ID && (
                          <option value={OWNER_ROLE_ID}>Website Owner</option>
                        )}
                      </select>
                    )}
                    {savingId === u.id && (
                      <span className="ml-2 text-xs text-mist">Saving...</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!users.length && (
        <p className="mt-4 text-mist">No users found.</p>
      )}
    </div>
  );
}
