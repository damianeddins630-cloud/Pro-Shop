"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useEditMode } from "@/lib/edit-mode";
import type { Permission } from "@/lib/types";

const cards: {
  href: string;
  title: string;
  text: string;
  perms: Permission[];
}[] = [
  {
    href: "/ops/inventory",
    title: "Inventory",
    text: "SPI catalog, prices, SKU/UPC, ball weights, and stock that powers the shop.",
    perms: ["manage_inventory", "edit_pages"],
  },
  {
    href: "/ops/orders",
    title: "Orders",
    text: "Paid orders, drill notes, and in-store pickup pipeline.",
    perms: ["view_orders", "manage_orders"],
  },
  {
    href: "/ops/shopify",
    title: "Shopify",
    text: "Payment checkout connect + status. Website still owns prices.",
    perms: ["manage_inventory", "manage_orders", "manage_roles", "manage_users"],
  },
  {
    href: "/ops/deals",
    title: "Deals",
    text: "Featured deals and specials on the site.",
    perms: ["manage_deals", "edit_pages"],
  },
  {
    href: "/ops/coupons",
    title: "Coupons",
    text: "Discount codes and usage limits.",
    perms: ["manage_deals", "manage_inventory", "edit_pages"],
  },
  {
    href: "/ops/sponsors",
    title: "Sponsors",
    text: "Sponsor logos and links.",
    perms: ["manage_sponsors", "edit_pages"],
  },
  {
    href: "/ops/subscribers",
    title: "Subscribers",
    text: "Email list and announcements.",
    perms: ["manage_subscribers", "edit_pages", "manage_users"],
  },
  {
    href: "/ops/users",
    title: "Users",
    text: "Accounts and roles for staff and customers.",
    perms: ["manage_users", "manage_roles"],
  },
  {
    href: "/ops/roles",
    title: "Roles",
    text: "Permissions for Operations staff.",
    perms: ["manage_roles"],
  },
];

export default function OpsHomePage() {
  const { user, can } = useEditMode();
  const [stats, setStats] = useState<{
    products: number | null;
    warning: string;
    shopify: string;
  }>({ products: null, warning: "", shopify: "" });

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setStats({
          products: typeof d.productCount === "number" ? d.productCount : null,
          warning: typeof d.warning === "string" ? d.warning : "",
          shopify: d.shopify?.checkoutReady
            ? "Checkout ready"
            : d.shopify?.configured
              ? "Connected — finish webhook if needed"
              : "Not connected",
        });
      })
      .catch(() => {});
  }, []);

  const visibleCards = useMemo(
    () =>
      cards.filter(
        (card) => !card.perms.length || card.perms.some((p) => can(p))
      ),
    [can]
  );

  return (
    <div>
      <h2 className="display text-4xl">
        Welcome{user ? `, ${user.username}` : ""}
      </h2>
      <p className="mt-2 max-w-2xl text-mist">
        Operations home — inventory, payments, and orders in one place. Keep it
        simple: set price → save → shoppers check out.
      </p>

      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        {stats.products != null && (
          <span className="rounded-full border border-white/15 px-3 py-1.5 text-mist">
            {stats.products} products loaded
          </span>
        )}
        <span className="rounded-full border border-white/15 px-3 py-1.5 text-mist">
          Shopify: {stats.shopify || "…"}
        </span>
        <Link
          href="/ops/inventory"
          className="rounded-full border border-red/40 bg-red/10 px-3 py-1.5 text-red"
        >
          Open inventory →
        </Link>
      </div>

      {stats.warning && (
        <p className="mt-4 max-w-3xl rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {stats.warning}
        </p>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 transition hover:border-red/45 hover:bg-white/[0.05]"
          >
            <h3 className="display text-2xl">{card.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-mist">{card.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
