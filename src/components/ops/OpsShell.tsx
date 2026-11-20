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
  icon: string;
  perms: Permission[];
  match?: (path: string) => boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        href: "/ops",
        label: "Dashboard",
        icon: "▣",
        perms: [],
        match: (p) => p === "/ops" || p === "/ops/",
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      {
        href: "/ops/orders",
        label: "Sales & Orders",
        icon: "◎",
        perms: ["view_orders", "manage_orders"],
        match: (p) => p.startsWith("/ops/orders"),
      },
      {
        href: "/ops/inventory",
        label: "Inventory",
        icon: "▤",
        perms: ["manage_inventory", "edit_pages"],
        match: (p) => p.startsWith("/ops/inventory"),
      },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      {
        href: "/ops/coaching",
        label: "Coaching",
        icon: "◈",
        perms: [],
        match: (p) => p.startsWith("/ops/coaching"),
      },
      {
        href: "/ops/memberships",
        label: "Memberships",
        icon: "◇",
        perms: [],
        match: (p) => p.startsWith("/ops/memberships"),
      },
      {
        href: "/ops/customers",
        label: "Customers",
        icon: "◉",
        perms: ["manage_users", "view_orders", "manage_orders"],
        match: (p) => p.startsWith("/ops/customers"),
      },
    ],
  },
  {
    id: "business",
    label: "Business",
    items: [
      {
        href: "/ops/finances",
        label: "Finances",
        icon: "⬡",
        perms: ["view_orders", "manage_orders", "manage_inventory"],
        match: (p) => p.startsWith("/ops/finances"),
      },
      {
        href: "/ops/marketing",
        label: "Marketing",
        icon: "✦",
        perms: [
          "manage_deals",
          "manage_sponsors",
          "manage_subscribers",
          "edit_pages",
        ],
        match: (p) =>
          p.startsWith("/ops/marketing") ||
          p.startsWith("/ops/deals") ||
          p.startsWith("/ops/coupons") ||
          p.startsWith("/ops/sponsors") ||
          p.startsWith("/ops/subscribers"),
      },
      {
        href: "/ops/reports",
        label: "Reports & Analytics",
        icon: "▦",
        perms: ["view_orders", "manage_orders", "manage_inventory"],
        match: (p) => p.startsWith("/ops/reports"),
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        href: "/ops/backups",
        label: "Backups & System",
        icon: "↻",
        perms: ["manage_roles", "manage_users", "manage_inventory"],
        match: (p) => p.startsWith("/ops/backups"),
      },
      {
        href: "/ops/admin",
        label: "Administration",
        icon: "⚙",
        perms: ["manage_roles", "manage_users"],
        match: (p) =>
          p.startsWith("/ops/admin") ||
          p.startsWith("/ops/users") ||
          p.startsWith("/ops/roles") ||
          p.startsWith("/ops/shopify"),
      },
    ],
  },
];

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
  const [mobileOpen, setMobileOpen] = useState(false);

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
        shopifyReady: Boolean(
          d.shopify?.checkoutReady ?? d.shopify?.configured
        ),
        durableOk: Boolean(
          d.persist?.lastPersistOk ?? d.persist?.durableWriteConfigured
        ),
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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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

  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canSee(user.permissions, item.perms)),
  })).filter((group) => group.items.length > 0);

  const activeLabel =
    visibleGroups
      .flatMap((g) => g.items)
      .find((item) =>
        item.match ? item.match(pathname) : pathname.startsWith(item.href)
      )?.label || "Operations";

  return (
    <div className="ops-shell">
      <aside className={`ops-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="ops-brand">
          <Link href="/" className="ops-brand-mark" aria-label="Ballard's home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/ops-logo.png" alt="" width={44} height={44} />
          </Link>
          <div>
            <p className="ops-brand-kicker">Ballard&apos;s Bowling Academy</p>
            <p className="ops-brand-title">Operations Center</p>
          </div>
        </div>

        <nav className="ops-nav" aria-label="Operations">
          {visibleGroups.map((group) => (
            <div key={group.id} className="ops-nav-group">
              <p className="ops-nav-group-label">{group.label}</p>
              <ul>
                {group.items.map((item) => {
                  const active = item.match
                    ? item.match(pathname)
                    : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`ops-nav-link ${active ? "active" : ""}`}
                      >
                        <span className="ops-nav-icon" aria-hidden>
                          {item.icon}
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="ops-sidebar-foot">
          <div className="ops-status-chip">
            <span
              className="ops-status-dot"
              style={{
                background: health?.durableOk ? "#22c55e" : "#eab308",
                boxShadow: health?.durableOk
                  ? "0 0 0 4px rgba(34, 197, 94, 0.15)"
                  : "0 0 0 4px rgba(234, 179, 8, 0.15)",
              }}
              aria-hidden
            />
            <div>
              <strong>
                {health?.durableOk ? "Systems online" : "Setup needed"}
              </strong>
              <span>
                {health?.productCount != null
                  ? `${health.productCount} products`
                  : "Checking store…"}
                {health?.shopifyReady ? " · Checkout ready" : " · Shopify setup"}
              </span>
            </div>
          </div>
          <div className="ops-user-chip">
            <div className="ops-user-avatar" aria-hidden>
              {(user.username || "A").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{user.username}</strong>
              <span>{user.roleName || "staff"}</span>
            </div>
          </div>
          <div className="ops-sidebar-actions">
            <Link href="/">← Storefront</Link>
            <button type="button" onClick={() => void runSelfTest()} disabled={testing}>
              {testing ? "Testing…" : "Test save"}
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="ops-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="ops-main">
        <header className="ops-topbar">
          <button
            type="button"
            className="ops-menu-btn"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            ☰
          </button>
          <div className="ops-topbar-copy">
            <p className="ops-crumb">Operations Center · {activeLabel}</p>
            <h1>OPERATIONS CENTER</h1>
            <p className="ops-subtitle">
              Ballard&apos;s Bowling Academy business command center — paid sales,
              inventory, and system health.
            </p>
          </div>
          <div className="ops-topbar-actions">
            <Link href="/shop" className="ops-ghost-btn">
              View shop
            </Link>
            <Link href="/ops/orders" className="ops-primary-btn">
              Sales & Orders
            </Link>
          </div>
        </header>

        {(health?.warning || testMsg) && (
          <div className="ops-content" style={{ paddingBottom: 0 }}>
            {health?.warning ? (
              <p className="ops-stage-banner" role="status">
                {health.warning}
              </p>
            ) : null}
            {testMsg ? (
              <p
                className="ops-stage-banner"
                role="status"
                style={{
                  borderColor: testMsg.toLowerCase().includes("fail")
                    ? "rgba(225, 6, 0, 0.35)"
                    : "rgba(34, 197, 94, 0.35)",
                  background: testMsg.toLowerCase().includes("fail")
                    ? "rgba(225, 6, 0, 0.08)"
                    : "rgba(34, 197, 94, 0.08)",
                }}
              >
                {testMsg}
              </p>
            ) : null}
          </div>
        )}

        <div className="ops-content">{children}</div>
      </div>
    </div>
  );
}
