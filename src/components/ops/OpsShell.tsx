"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BrandedPageBackdrop } from "@/components/BrandedPageBackdrop";
import { OpsLogo } from "@/components/ops/OpsLogo";
import { useEditMode } from "@/lib/edit-mode";
import type { Permission } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  perms: Permission[];
  group: "shop" | "sales" | "system";
};

const nav: NavItem[] = [
  { href: "/ops", label: "Home", perms: [], group: "shop" },
  {
    href: "/ops/inventory",
    label: "Inventory",
    perms: ["manage_inventory", "edit_pages"],
    group: "shop",
  },
  {
    href: "/ops/deals",
    label: "Deals",
    perms: ["manage_deals", "edit_pages"],
    group: "shop",
  },
  {
    href: "/ops/coupons",
    label: "Coupons",
    perms: ["manage_deals", "manage_inventory", "edit_pages"],
    group: "shop",
  },
  {
    href: "/ops/sponsors",
    label: "Sponsors",
    perms: ["manage_sponsors", "edit_pages"],
    group: "shop",
  },
  {
    href: "/ops/orders",
    label: "Orders",
    perms: ["view_orders", "manage_orders"],
    group: "sales",
  },
  {
    href: "/ops/subscribers",
    label: "Subscribers",
    perms: ["manage_subscribers", "edit_pages", "manage_users"],
    group: "sales",
  },
  {
    href: "/ops/shopify",
    label: "Shopify",
    perms: ["manage_inventory", "manage_orders", "manage_roles", "manage_users"],
    group: "system",
  },
  { href: "/ops/roles", label: "Roles", perms: ["manage_roles"], group: "system" },
  {
    href: "/ops/users",
    label: "Users",
    perms: ["manage_users", "manage_roles"],
    group: "system",
  },
];

const groupLabel = {
  shop: "Shop",
  sales: "Sales",
  system: "System",
} as const;

function canSee(userPerms: Permission[] | undefined, needed: Permission[]) {
  if (!needed.length) return true;
  if (!userPerms?.length) return false;
  return needed.some((p) => userPerms.includes(p));
}

type HealthSnap = {
  warning: string | null;
  shopifyReady: boolean;
  durableOk: boolean;
  productCount: number | null;
};

export function OpsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, can } = useEditMode();
  const [health, setHealth] = useState<HealthSnap | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");

  const allowed =
    can("manage_inventory") ||
    can("manage_deals") ||
    can("manage_sponsors") ||
    can("manage_subscribers") ||
    can("manage_roles") ||
    can("manage_users") ||
    can("view_orders") ||
    can("manage_orders") ||
    can("edit_pages");

  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const d = await res.json();
      setHealth({
        warning: typeof d.warning === "string" ? d.warning : null,
        shopifyReady: Boolean(d.shopify?.checkoutReady ?? d.shopify?.configured),
        durableOk: Boolean(d.persist?.lastPersistOk ?? d.persist?.durableWriteConfigured),
        productCount:
          typeof d.productCount === "number" ? d.productCount : null,
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user || !allowed) return;
    void refreshHealth();
  }, [user, allowed, refreshHealth]);

  async function runSelfTest() {
    setTesting(true);
    setTestMsg("");
    try {
      const res = await fetch("/api/persist/self-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const d = await res.json();
      setTestMsg(
        d.ok
          ? d.help || "Save/load OK — catalog sticks for every shopper."
          : d.help || d.detail || "Save/load failed — check Vercel Blob env."
      );
      await refreshHealth();
    } catch {
      setTestMsg("Could not reach save/load self-test.");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <BrandedPageBackdrop tone="ops">
        <div className="flex items-center gap-4">
          <OpsLogo size="sm" />
          <p className="text-mist">Loading Operations…</p>
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
            Operations
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
  const groups = (["shop", "sales", "system"] as const).filter((g) =>
    items.some((i) => i.group === g)
  );

  return (
    <BrandedPageBackdrop tone="ops">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex min-w-0 items-center gap-4">
          <OpsLogo size="md" />
          <div className="min-w-0">
            <p className="text-xs tracking-[0.22em] text-red uppercase">
              Ballard&apos;s Bowling Academy
            </p>
            <h1 className="display truncate text-4xl md:text-5xl">Operations</h1>
            <p className="mt-1 text-sm text-mist">
              {user.username} · {user.roleName}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {health && (
            <>
              <span
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  health.durableOk
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                    : "border-amber-400/40 bg-amber-400/10 text-amber-200"
                }`}
              >
                {health.durableOk ? "Saves OK" : "Saves need fix"}
              </span>
              <span
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  health.shopifyReady
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                    : "border-amber-400/40 bg-amber-400/10 text-amber-200"
                }`}
              >
                {health.shopifyReady ? "Checkout ready" : "Shopify setup"}
              </span>
              {health.productCount != null && (
                <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-mist">
                  {health.productCount} products
                </span>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => void runSelfTest()}
            disabled={testing}
            className="btn btn-ghost !px-3 !py-2 text-xs"
          >
            {testing ? "Testing…" : "Test save/load"}
          </button>
          <Link href="/shop" className="btn btn-ghost !px-3 !py-2 text-xs">
            View shop
          </Link>
        </div>
      </header>

      {(health?.warning || testMsg) && (
        <div className="mb-5 space-y-2">
          {health?.warning && (
            <p className="rounded-2xl border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {health.warning}
            </p>
          )}
          {testMsg && (
            <p
              className={`rounded-2xl border px-4 py-3 text-sm ${
                testMsg.toLowerCase().includes("fail") ||
                testMsg.toLowerCase().includes("not")
                  ? "border-amber-400/35 bg-amber-400/10 text-amber-100"
                  : "border-emerald-400/35 bg-emerald-400/10 text-emerald-100"
              }`}
            >
              {testMsg}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <aside className="h-fit rounded-2xl border border-white/12 bg-black/50 p-3">
          <nav className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group}>
                <p className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.18em] text-steel uppercase">
                  {groupLabel[group]}
                </p>
                <div className="flex flex-col gap-0.5">
                  {items
                    .filter((i) => i.group === group)
                    .map((item) => {
                      const active =
                        item.href === "/ops"
                          ? pathname === "/ops"
                          : pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`rounded-lg px-3 py-2 text-sm transition ${
                            active
                              ? "bg-red font-semibold text-white"
                              : "text-mist hover:bg-white/5 hover:text-chalk"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 rounded-2xl border border-white/12 bg-black/40 p-5 md:p-6">
          {children}
        </div>
      </div>
    </BrandedPageBackdrop>
  );
}
