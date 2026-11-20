"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  IconAdmin,
  IconBackups,
  IconBell,
  IconChevron,
  IconCoaching,
  IconCustomers,
  IconDashboard,
  IconFinances,
  IconIntegrations,
  IconInventory,
  IconMarketing,
  IconMemberships,
  IconMenu,
  IconOrders,
  IconReports,
  IconSearch,
} from "@/components/ops/OpsIcons";
import { useEditMode } from "@/lib/edit-mode";
import type { Permission } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
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
    label: "Main",
    items: [
      {
        href: "/ops",
        label: "Dashboard",
        icon: <IconDashboard />,
        perms: [],
        match: (p) => p === "/ops" || p === "/ops/",
      },
    ],
  },
  {
    id: "sales",
    label: "Commerce",
    items: [
      {
        href: "/ops/orders",
        label: "Sales & Orders",
        icon: <IconOrders />,
        perms: ["view_orders", "manage_orders"],
        match: (p) => p.startsWith("/ops/orders"),
      },
      {
        href: "/ops/inventory",
        label: "Inventory",
        icon: <IconInventory />,
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
        icon: <IconCoaching />,
        perms: ["manage_coaches", "view_dashboard"],
        match: (p) => p.startsWith("/ops/coaching"),
      },
      {
        href: "/ops/memberships",
        label: "Memberships",
        icon: <IconMemberships />,
        perms: ["manage_memberships", "manage_users", "view_dashboard"],
        match: (p) => p.startsWith("/ops/memberships"),
      },
      {
        href: "/ops/customers",
        label: "Customers",
        icon: <IconCustomers />,
        perms: [
          "manage_customers",
          "manage_users",
          "view_orders",
          "manage_orders",
        ],
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
        icon: <IconFinances />,
        perms: [
          "view_finances",
          "manage_finances",
          "view_orders",
          "manage_orders",
        ],
        match: (p) => p.startsWith("/ops/finances"),
      },
      {
        href: "/ops/reports",
        label: "Reports",
        icon: <IconReports />,
        perms: ["view_orders", "manage_orders", "manage_inventory"],
        match: (p) => p.startsWith("/ops/reports"),
      },
      {
        href: "/ops/marketing",
        label: "Marketing",
        icon: <IconMarketing />,
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
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        href: "/ops/backups",
        label: "Backups",
        icon: <IconBackups />,
        perms: [
          "manage_backups",
          "manage_roles",
          "manage_users",
          "manage_inventory",
          "manage_settings",
        ],
        match: (p) => p.startsWith("/ops/backups"),
      },
      {
        href: "/ops/integrations",
        label: "Integrations",
        icon: <IconIntegrations />,
        perms: [
          "manage_settings",
          "manage_roles",
          "manage_inventory",
          "manage_orders",
        ],
        match: (p) =>
          p.startsWith("/ops/integrations") || p.startsWith("/ops/shopify"),
      },
      {
        href: "/ops/admin",
        label: "Administration",
        icon: <IconAdmin />,
        perms: ["manage_roles", "manage_users", "manage_settings"],
        match: (p) =>
          p.startsWith("/ops/admin") ||
          p.startsWith("/ops/users") ||
          p.startsWith("/ops/roles"),
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
  const router = useRouter();
  const { user, loading, can } = useEditMode();
  const [health, setHealth] = useState<HealthSnap | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    overview: true,
    sales: true,
    people: true,
    business: true,
    system: true,
  });

  const allowed =
    can("view_dashboard") ||
    can("manage_inventory") ||
    can("manage_deals") ||
    can("manage_sponsors") ||
    can("manage_subscribers") ||
    can("manage_roles") ||
    can("manage_users") ||
    can("view_orders") ||
    can("manage_orders") ||
    can("edit_pages") ||
    can("manage_coaches") ||
    can("manage_memberships") ||
    can("view_finances") ||
    can("manage_backups");

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
    setNotifyOpen(false);
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

  const notifications = useMemo(() => {
    const items: { id: string; title: string; detail: string; href: string }[] =
      [];
    if (health?.warning) {
      items.push({
        id: "durable",
        title: "Durable storage",
        detail: health.warning,
        href: "/ops/backups",
      });
    }
    if (!health?.shopifyReady) {
      items.push({
        id: "shopify",
        title: "Shopify checkout",
        detail: "Connect Shopify under Integrations to take live payments.",
        href: "/ops/integrations",
      });
    }
    if (!health?.durableOk) {
      items.push({
        id: "persist",
        title: "System health",
        detail: "Primary storage is not fully online yet.",
        href: "/ops/backups",
      });
    }
    return items;
  }, [health]);

  if (loading) {
    return (
      <div className="ops-gate">
        <div className="ops-gate-card">
          <div className="ops-gate-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/ops-logo.png" alt="" width={48} height={48} />
          </div>
          <p>Loading Operations Center…</p>
        </div>
      </div>
    );
  }

  if (!user || !allowed) {
    return (
      <div className="ops-gate">
        <div className="ops-gate-card">
          <div className="ops-gate-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/ops-logo.png"
              alt="Ballard's Bowling Academy"
              width={56}
              height={56}
            />
          </div>
          <p className="ops-gate-kicker">Operations Center</p>
          <h1>Access required</h1>
          <p className="ops-gate-copy">
            Sign in with an operations account to manage Ballard&apos;s business
            systems.
          </p>
          <Link href="/login?next=/ops" className="ops-primary-btn">
            Login
          </Link>
        </div>
      </div>
    );
  }

  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canSee(user.permissions, item.perms)),
  })).filter((group) => group.items.length > 0);

  const activeItem =
    visibleGroups
      .flatMap((g) => g.items)
      .find((item) =>
        item.match ? item.match(pathname) : pathname.startsWith(item.href)
      ) || null;
  const activeLabel = activeItem?.label || "Operations";

  const searchHits = search.trim()
    ? visibleGroups
        .flatMap((g) => g.items)
        .filter((item) =>
          item.label.toLowerCase().includes(search.trim().toLowerCase())
        )
        .slice(0, 6)
    : [];

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    if (searchHits[0]) {
      router.push(searchHits[0].href);
      setSearch("");
      return;
    }
    router.push(`/ops/customers`);
    setSearch("");
  }

  return (
    <div className="ops-shell">
      <aside className={`ops-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="ops-brand">
          <Link href="/ops" className="ops-brand-mark" aria-label="Dashboard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/ops-logo.png" alt="" width={40} height={40} />
          </Link>
          <div>
            <p className="ops-brand-kicker">Ballard&apos;s Academy</p>
            <p className="ops-brand-title">Operations</p>
          </div>
        </div>

        <nav className="ops-nav" aria-label="Operations">
          {visibleGroups.map((group) => {
            const open = openGroups[group.id] !== false;
            return (
              <div key={group.id} className="ops-nav-group">
                <button
                  type="button"
                  className="ops-nav-group-toggle"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={open}
                >
                  <span>{group.label}</span>
                  <IconChevron
                    className={`ops-nav-chevron ${open ? "open" : ""}`}
                  />
                </button>
                {open ? (
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
                            <span>{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="ops-sidebar-foot">
          <Link href="/ops/orders" className="ops-sidebar-cta">
            + New sale
          </Link>
          <div className="ops-user-chip">
            <div className="ops-user-avatar" aria-hidden>
              {(user.username || "A").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{user.username}</strong>
              <span>{user.roleName || "Staff"}</span>
            </div>
          </div>
          <div className="ops-sidebar-actions">
            <Link href="/">Storefront</Link>
            <button
              type="button"
              onClick={() => void runSelfTest()}
              disabled={testing}
            >
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
            <IconMenu />
          </button>

          <div className="ops-topbar-title">
            <p className="ops-crumb">
              Operations <span>/</span> {activeLabel}
            </p>
            <h1>{activeLabel}</h1>
          </div>

          <form className="ops-search" onSubmit={onSearchSubmit} role="search">
            <IconSearch aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pages… (Enter)"
              aria-label="Search operations"
            />
            {searchHits.length > 0 ? (
              <div className="ops-search-menu">
                {searchHits.map((hit) => (
                  <button
                    key={hit.href}
                    type="button"
                    onClick={() => {
                      router.push(hit.href);
                      setSearch("");
                    }}
                  >
                    {hit.label}
                  </button>
                ))}
              </div>
            ) : null}
          </form>

          <div className="ops-topbar-actions">
            <div className="ops-notify-wrap">
              <button
                type="button"
                className="ops-icon-btn"
                aria-label="Notifications"
                onClick={() => setNotifyOpen((v) => !v)}
              >
                <IconBell />
                {notifications.length > 0 ? (
                  <span className="ops-notify-dot">{notifications.length}</span>
                ) : null}
              </button>
              {notifyOpen ? (
                <div className="ops-notify-menu">
                  <p className="ops-notify-title">Alerts</p>
                  {notifications.length === 0 ? (
                    <p className="ops-empty">No system alerts.</p>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.href}
                        className="ops-notify-item"
                        onClick={() => setNotifyOpen(false)}
                      >
                        <strong>{n.title}</strong>
                        <span>{n.detail}</span>
                      </Link>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="ops-top-user">
              <div className="ops-user-avatar" aria-hidden>
                {(user.username || "A").slice(0, 1).toUpperCase()}
              </div>
              <div className="ops-top-user-copy">
                <strong>{user.username}</strong>
                <span>{user.roleName || "Staff"}</span>
              </div>
            </div>

            <Link href="/ops/orders" className="ops-primary-btn">
              + Quick action
            </Link>
          </div>
        </header>

        {(health?.warning || testMsg) && (
          <div className="ops-banner-stack">
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
