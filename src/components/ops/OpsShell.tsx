"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandedPageBackdrop } from "@/components/BrandedPageBackdrop";
import { OpsLogo } from "@/components/ops/OpsLogo";
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
    href: "/ops/coupons",
    label: "Coupons",
    perms: ["manage_deals", "manage_inventory", "edit_pages"],
  },
  {
    href: "/ops/sponsors",
    label: "Sponsors",
    perms: ["manage_sponsors", "edit_pages"],
  },
  { href: "/ops/orders", label: "Orders", perms: ["view_orders", "manage_orders"] },
  { href: "/ops/roles", label: "Roles", perms: ["manage_roles"] },
  {
    href: "/ops/users",
    label: "Users",
    perms: ["manage_users", "manage_roles"],
  },
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
      <BrandedPageBackdrop tone="ops">
        <div className="flex items-center gap-4">
          <OpsLogo size="sm" />
          <p className="text-mist">Loading Operations Home Base...</p>
        </div>
      </BrandedPageBackdrop>
    );
  }

  if (!user || !allowed) {
    return (
      <BrandedPageBackdrop tone="ops">
        <div className="mx-auto max-w-lg py-10 text-center">
          <OpsLogo size="lg" className="mx-auto" />
          <p className="mt-6 text-sm tracking-[0.2em] text-red uppercase">
            Operations Home Base
          </p>
          <h1 className="display mt-2 text-5xl">Access required</h1>
          <p className="mt-4 text-mist">
            Log in with an operations account to continue.
          </p>
          <Link href="/login?next=/ops" className="btn btn-primary mt-6">
            Login
          </Link>
        </div>
      </BrandedPageBackdrop>
    );
  }

  const items = nav.filter((item) => canSee(user.permissions, item.perms));

  return (
    <BrandedPageBackdrop tone="ops">
      <div className="mb-8 flex flex-wrap items-center gap-5">
        <OpsLogo size="md" />
        <div>
          <p className="text-sm tracking-[0.2em] text-red uppercase">
            Ballard&apos;s Bowling Academy
          </p>
          <h1 className="display mt-1 text-5xl md:text-6xl">Operations Home Base</h1>
          <p className="mt-2 text-mist">
            Signed in as <span className="text-red">{user.username}</span> · {user.roleName}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-3xl border border-white/20 bg-black/40 p-3 backdrop-blur-md">
          <div className="mb-3 flex justify-center border-b border-white/10 pb-3">
            <OpsLogo size="sm" />
          </div>
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
        <div className="min-w-0 rounded-3xl border border-white/15 bg-black/35 p-5 backdrop-blur-md md:p-7">
          {children}
        </div>
      </div>
    </BrandedPageBackdrop>
  );
}
