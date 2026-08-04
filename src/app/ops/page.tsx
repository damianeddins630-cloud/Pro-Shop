"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useEditMode } from "@/lib/edit-mode";

const cards = [
  {
    href: "/ops/inventory",
    title: "Inventory",
    text: "Add, remove, change prices, discounts, and stock. Connected live to the shop.",
  },
  {
    href: "/ops/deals",
    title: "Deals",
    text: "Add, remove, or update current deals and specials.",
  },
  {
    href: "/ops/coupons",
    title: "Coupons",
    text: "Add, edit, or remove any redeem code and set how many times each can be used.",
  },
  {
    href: "/ops/sponsors",
    title: "Sponsors",
    text: "Add, remove, or update sponsor names and logos.",
  },
  {
    href: "/ops/orders",
    title: "Orders",
    text: "Plain order list from every shop purchase.",
  },
  {
    href: "/ops/roles",
    title: "Roles",
    text: "Create, edit, and remove roles and permissions.",
  },
  {
    href: "/ops/users",
    title: "Users",
    text: "See every account, when it was made, email, and if they ordered.",
  },
];

export default function OpsHomePage() {
  const { user } = useEditMode();
  const [persistWarning, setPersistWarning] = useState("");

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.warning === "string" && d.warning) setPersistWarning(d.warning);
      })
      .catch(() => {});
  }, []);

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
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
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
