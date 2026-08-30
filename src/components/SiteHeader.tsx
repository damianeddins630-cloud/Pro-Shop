"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "./BrandMark";
import { useCart } from "@/lib/cart";
import { useEditMode } from "@/lib/edit-mode";

const links = [
  { href: "/", label: "Home" },
  { href: "/coaching", label: "Coaching" },
  { href: "/shop", label: "Shop" },
  { href: "/deals", label: "Deals" },
  { href: "/bvbc", label: "BVBC" },
  { href: "/subscribe", label: "Subscribe" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { count } = useCart();
  const { user, canEdit, can, editMode, setEditMode } = useEditMode();
  const [open, setOpen] = useState(false);
  const shopMode = pathname.startsWith("/shop") || pathname.startsWith("/cart");
  const showAdmin =
    can("manage_inventory") ||
    can("manage_roles") ||
    can("manage_users") ||
    can("manage_deals") ||
    can("manage_sponsors") ||
    can("view_orders") ||
    can("manage_orders") ||
    can("edit_pages");

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/85 backdrop-blur-xl">
      <div className="site-shell flex items-center justify-between gap-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <BrandMark mode={shopMode ? "cart" : "logo"} size={shopMode ? 44 : 64} />
          <div className="leading-tight">
            <div className="display text-xl text-chalk md:text-2xl">
              Ballard&apos;s
            </div>
            <div className="text-xs tracking-[0.18em] text-red uppercase">
              Bowling Academy
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-2 text-sm transition ${
                  active
                    ? "bg-red/15 text-red"
                    : "text-mist hover:bg-white/5 hover:text-chalk"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              className={`rounded-full px-3 py-2 text-sm font-bold ${
                editMode
                  ? "bg-white text-black"
                  : "bg-red text-white hover:bg-red-deep"
              }`}
            >
              {editMode ? "Done editing" : "Edit all text"}
            </button>
          )}
          <Link
            href="/cart"
            className="relative rounded-full border border-white/15 px-3 py-2 text-sm text-chalk hover:border-red/60"
          >
            Cart
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red px-1 text-[11px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <>
              {showAdmin && (
                <Link
                  href="/ops"
                  className="hidden rounded-full bg-red px-3 py-2 text-sm font-bold text-white sm:inline-flex"
                >
                  Operations
                </Link>
              )}
              <Link
                href="/profile"
                className="rounded-full border border-white/15 px-3 py-2 text-sm text-chalk hover:border-red/60"
              >
                Profile
              </Link>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary !px-3 !py-2 text-sm">
              Login
            </Link>
          )}
          <button
            type="button"
            className="rounded-full border border-white/15 px-3 py-2 text-sm lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            Menu
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-ink/95 px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-mist hover:bg-white/5 hover:text-chalk"
              >
                {link.label}
              </Link>
            ))}
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setEditMode(!editMode);
                  setOpen(false);
                }}
                className="rounded-lg px-3 py-2 text-left text-red"
              >
                {editMode ? "Done editing" : "Edit all text"}
              </button>
            )}
            {showAdmin && (
              <Link
                href="/ops"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-red"
              >
                Operations
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
