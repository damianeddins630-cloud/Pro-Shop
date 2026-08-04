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
    text: "Add, remove, change prices, discounts, and stock. Connected live to the shop.",
    perms: ["manage_inventory", "edit_pages"],
  },
  {
    href: "/ops/deals",
    title: "Deals",
    text: "Add, remove, or update current deals and specials.",
    perms: ["manage_deals", "edit_pages"],
  },
  {
    href: "/ops/coupons",
    title: "Coupons",
    text: "Add, edit, or remove any redeem code and set how many times each can be used.",
    perms: ["manage_deals", "manage_inventory", "edit_pages"],
  },
  {
    href: "/ops/sponsors",
    title: "Sponsors",
    text: "Add, remove, or update sponsor names and logos.",
    perms: ["manage_sponsors", "edit_pages"],
  },
  {
    href: "/ops/orders",
    title: "Orders",
    text: "Plain order list from every shop purchase.",
    perms: ["view_orders", "manage_orders"],
  },
  {
    href: "/ops/shopify",
    title: "Shopify",
    text: "Connect Shopify payment checkout. Status + step-by-step setup.",
    perms: ["manage_inventory", "manage_orders", "manage_roles", "manage_users"],
  },
  {
    href: "/ops/roles",
    title: "Roles",
    text: "Create, edit, and remove roles and permissions.",
    perms: ["manage_roles"],
  },
  {
    href: "/ops/users",
    title: "Users",
    text: "See every account, when it was made, email, and if they ordered.",
    perms: ["manage_users", "manage_roles"],
  },
];

export default function OpsHomePage() {
  const { user, can } = useEditMode();
  const [persistWarning, setPersistWarning] = useState("");
  const [shopifyWarning, setShopifyWarning] = useState("");

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.warning === "string" && d.warning) setPersistWarning(d.warning);
        if (d.shopify && !d.shopify.configured) {
          setShopifyWarning(
            "Shopify is not connected yet. Open Ops → Shopify and follow the 4 steps (add keys in Vercel pro-shop-lemon, then redeploy)."
          );
        } else if (d.shopify?.configured && !d.shopify?.webhookConfigured) {
          setShopifyWarning(
            "Shopify checkout is ready, but SHOPIFY_WEBHOOK_SECRET is missing — open Ops → Shopify to finish webhook setup."
          );
        }
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
      <h2 className="display text-4xl">Welcome{user ? `, ${user.username}` : ""}</h2>
      <p className="mt-2 max-w-2xl text-mist">
        This is Operations Home Base. Pick a section to manage the pro shop.
      </p>
      {persistWarning && (
        <p className="mt-4 max-w-3xl rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {persistWarning}
        </p>
      )}
      {shopifyWarning && (
        <p className="mt-4 max-w-3xl rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {shopifyWarning}{" "}
          <Link href="/ops/shopify" className="underline text-amber-50">
            Open Shopify setup
          </Link>
        </p>
      )}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-red/50 hover:bg-white/[0.05]"
          >
            <h3 className="display text-3xl text-chalk">{card.title}</h3>
            <p className="mt-3 text-sm text-mist">{card.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
