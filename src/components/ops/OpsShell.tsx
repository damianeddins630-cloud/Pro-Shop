"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEditMode } from "@/lib/edit-mode";
import type { Permission } from "@/lib/types";

const nav: { href: string; label: string; perms: Permission[] }[] = [
  { href: "/ops", label: "Home", perms: [] },
  {
    href: "/ops/inventory",
    label: "Inventory",
    perms: ["manage_inventory", "edit_pages"],
  },
  { href: "/ops/deals", label: "Deals", perms: ["manage_deals", "edit_pages"] },
  {
    href: "/ops/sponsors",
    label: "Sponsors",
    perms: ["manage_sponsors", "edit_pages"],
  },
  { href: "/ops/orders", label: "Orders", perms: ["view_orders", "manage_orders"] },
  { href: "/ops/roles", label: "Roles", perms: ["manage_roles"] },
  { href: "/ops/users", label: "Users", perms: ["manage_users"] },
];

function canSee(
  userPerms: Permission[] | undefined,
  needed: Permission[]
) {
  if (!needed.length) return true;
  if (!userPerms?.length) return false;
  return needed.some((p) => userPerms.includes(p));
}

export function OpsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, can } = useEditMode();
  const allowed =
    can("manage_inventory") ||
    can("manage_deals") ||
    can("manage_sponsors") ||
    can("manage_roles") ||
    can("manage_users") ||
    can("view_orders") ||
    can("manage_orders") ||
    can("edit_pages");

  if (loading) {
    return (
      <section className="site-shell section-pad pt-24">
        <p className="text-mist">Loading Operations Home Base...</p>
      </section>
    );
  }

  if (!user || !allowed) {
    return (
      <section className="site-shell section-pad pt-24">
        <p className="text-sm tracking-[0.2em] text-red uppercase">
          Operations Home Base
        </p>
        <h1 className="display mt-2 text-5xl">Access required</h1>
        <p className="mt-4 text-mist">Log in with an operations account to continue.</p>
        <Link href="/login?next=/ops" className="btn btn-primary mt-6">
          Login
        </Link>
      </section>
    );
  }

  const items = nav.filter((item) => canSee(user.permissions, item.perms));

  return (
    <section className="site-shell section-pad pt-24">
      <div className="mb-8">
        <p className="text-sm tracking-[0.2em] text-red uppercase">
          Ballard&apos;s Bowling Academy
        </p>
        <h1 className="display mt-2 text-5xl md:text-6xl">Operations Home Base</h1>
        <p className="mt-2 text-mist">
          Signed in as <span className="text-red">{user.username}</span> · {user.roleName}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-3xl border border-white/10 bg-black/50 p-3">
          <nav className="flex flex-col gap-1">
            {items.map((item) => {
              const active =
                item.href === "/ops"
                  ? pathname === "/ops"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-red font-bold text-white"
                      : "text-mist hover:bg-white/5 hover:text-chalk"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/shop"
              className="mt-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-mist hover:border-red/50 hover:text-chalk"
            >
              View shop →
            </Link>
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
