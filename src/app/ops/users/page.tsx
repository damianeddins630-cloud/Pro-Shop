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
  const { user: me } = useEditMode();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [actorRank, setActorRank] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [uRes, rRes] = await Promise.all([
      fetch("/api/users", { cache: "no-store" }),
      fetch("/api/roles", { cache: "no-store" }),
    ]);
    const uData = await uRes.json();
    const rData = await rRes.json();
    if (!uRes.ok) {
      setError(uData.error || "Could not load users");
      setLoading(false);
      return;
    }
    setUsers(uData.users || []);
    setRoles(rData.roles || []);
    setActorRank(Number(uData.actorRank ?? rData.actorRank) || 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assignableRoles = useMemo(
    () => roles.filter((r) => canAssignRole(actorRank, r)),
    [roles, actorRank]
  );

  async function assignRole(userId: string, roleId: string) {
    setError("");
    setMessage("");
    const res = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, roleId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not update role");
      return;
    }
    setMessage("User role updated");
    load();
  }

  if (loading) return <p className="text-mist">Loading users...</p>;

  return (
    <div>
      <h2 className="display text-4xl">Users & accounts</h2>
      <p className="mt-1 text-sm text-mist">
        Every account: when it was made, name, email, role, and whether they ordered.
        You can only assign roles below your rank ({actorRank}). The Website Owner
        account cannot be demoted.
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
                        onChange={(e) => assignRole(u.id, e.target.value)}
                      >
                        {/* Keep current option visible even if not assignable list */}
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
                        {/* Never offer Website Owner unless already owner */}
                        {u.roleId === OWNER_ROLE_ID && (
                          <option value={OWNER_ROLE_ID}>Website Owner</option>
                        )}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
