"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";
import { useCart } from "@/lib/cart";
import type { PublicUser } from "@/lib/types";

const links = [
  { href: "/", label: "Home" },
  { href: "/coaching", label: "Coaching" },
  { href: "/shop", label: "Shop" },
  { href: "/deals", label: "Deals" },
  { href: "/bvbc", label: "BVBC" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/subscribe", label: "Subscribe" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { count } = useCart();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [open, setOpen] = useState(false);
  const shopMode = pathname.startsWith("/shop") || pathname.startsWith("/cart");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user || null))
      .catch(() => setUser(null));
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07121d]/80 backdrop-blur-xl">
      <div className="site-shell flex items-center justify-between gap-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <BrandMark mode={shopMode ? "cart" : "logo"} size={54} />
          <div className="leading-tight">
            <div className="display text-xl text-chalk md:text-2xl">
              Ballard&apos;s
            </div>
            <div className="text-xs tracking-[0.18em] text-amber uppercase">
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
                    ? "bg-amber/15 text-amber"
                    : "text-mist hover:bg-white/5 hover:text-chalk"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/cart"
            className="relative rounded-full border border-white/15 px-3 py-2 text-sm text-chalk hover:border-amber/50"
          >
            Cart
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber px-1 text-[11px] font-bold text-ink">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="hidden rounded-full bg-amber px-3 py-2 text-sm font-bold text-ink sm:inline-flex"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/profile"
                className="rounded-full border border-white/15 px-3 py-2 text-sm text-chalk hover:border-amber/50"
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
                className="rounded-lg px-3 py-2 text-mist hover:bg-white/5 hover:text-chalk"
              >
                {link.label}
              </Link>
            ))}
            {user?.role === "admin" && (
              <Link href="/admin" className="rounded-lg px-3 py-2 text-amber">
                Admin
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
