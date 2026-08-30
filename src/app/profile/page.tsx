"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useEditMode } from "@/lib/edit-mode";
import { memberOrderStatus, statusToneClass } from "@/lib/order-status";
import type { Order, PublicUser } from "@/lib/types";

type Tab = "account" | "orders";

export default function ProfilePage() {
  const router = useRouter();
  const { user: ctxUser, refreshUser } = useEditMode();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>("account");
  const [loading, setLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        const me = await meRes.json();
        if (cancelled) return;
        const nextUser = (me.user as PublicUser | null) || ctxUser || null;
        setUser(nextUser);

        if (nextUser) {
          try {
            const oRes = await fetch("/api/orders", { cache: "no-store" });
            const o = await oRes.json();
            if (!cancelled) {
              if (oRes.ok) {
                const list = (o.orders || []) as Order[];
                setOrders(list);
                // Stay on account if they have no real purchases.
                if (!list.length) setTab("account");
              } else setOrdersError(o.error || "Could not load orders");
            }
          } catch {
            if (!cancelled) setOrdersError("Could not load orders");
          }
        }
      } catch {
        if (!cancelled) setUser(ctxUser || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctxUser]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await refreshUser();
    router.push("/");
    router.refresh();
  }

  if (loading && !user && !ctxUser) {
    return (
      <section className="site-shell section-pad pt-24">
        <p className="text-mist">Loading profile...</p>
      </section>
    );
  }

  const view = user || ctxUser;

  if (!view) {
    return (
      <section className="site-shell section-pad pt-24">
        <h1 className="display text-5xl">Profile</h1>
        <p className="mt-4 text-mist">Please log in to view your account.</p>
        <Link href="/login" className="btn btn-primary mt-6">
          Login
        </Link>
      </section>
    );
  }

  const canAdmin =
    view.permissions?.some((p) =>
      [
        "manage_inventory",
        "manage_roles",
        "manage_users",
        "manage_deals",
        "manage_sponsors",
        "manage_subscribers",
        "view_orders",
        "edit_pages",
      ].includes(p)
    ) ?? false;

  return (
    <section className="site-shell section-pad pt-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm tracking-[0.2em] text-red uppercase">Your account</p>
          <h1 className="display text-5xl">{view.username}</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("account")}
            className={`rounded-full px-4 py-2 text-sm capitalize ${
              tab === "account"
                ? "bg-red text-white font-bold"
                : "border border-white/15 text-mist"
            }`}
          >
            Account
          </button>
          {orders.length > 0 ? (
            <button
              type="button"
              onClick={() => setTab("orders")}
              className={`rounded-full px-4 py-2 text-sm capitalize ${
                tab === "orders"
                  ? "bg-red text-white font-bold"
                  : "border border-white/15 text-mist"
              }`}
            >
              Previous orders ({orders.length})
            </button>
          ) : null}
        </div>
      </div>

      {tab === "account" && (
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-white/10 py-2">
              <dt className="text-mist">Email</dt>
              <dd>{view.email}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/10 py-2">
              <dt className="text-mist">Phone</dt>
              <dd>{view.phoneNumber || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/10 py-2">
              <dt className="text-mist">Date of birth</dt>
              <dd>{view.dateOfBirth || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/10 py-2">
              <dt className="text-mist">Role</dt>
              <dd className="text-red">{view.roleName || "Member"}</dd>
            </div>
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            {canAdmin && (
              <Link href="/ops" className="btn btn-primary">
                Operations Home Base
              </Link>
            )}
            <Link href="/shop" className="btn btn-ghost">
              Shop
            </Link>
            <button type="button" onClick={logout} className="btn btn-ghost">
              Log out
            </button>
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-mist">
            <p className="font-medium text-chalk">In-store only — no shipping</p>
            <ul className="mt-2 space-y-1">
              <li>
                <span className="text-amber-300">Pending payment</span> — not paid yet
              </li>
              <li>
                <span className="text-sky-300">Balls in</span> — your balls are at Ballard&apos;s
              </li>
              <li>
                <span className="text-teal-300">Come do drilling</span> — come in and get drilled
              </li>
              <li>
                <span className="text-emerald-300">Order complete</span> — drilled and picked up
              </li>
            </ul>
          </div>
          {ordersError && <p className="text-sm text-red-300">{ordersError}</p>}
          {orders.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
              <p className="text-mist">
                Orders show here only after you buy. Unpaid checkouts are not
                saved in your history.
              </p>
              <Link href="/shop" className="btn btn-primary mt-6">
                Browse the shop
              </Link>
            </div>
          ) : (
            orders.map((order) => {
              const status = memberOrderStatus(order.status);
              return (
                <article
                  key={order.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs tracking-[0.16em] text-mist uppercase">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                      <h2 className="display mt-1 text-3xl">
                        ${order.total.toFixed(2)}
                      </h2>
                      {order.couponCode && (
                        <p className="mt-1 text-xs text-emerald-300">
                          Coupon {order.couponCode}
                          {order.discountAmount
                            ? ` (−$${order.discountAmount.toFixed(2)})`
                            : ""}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusToneClass(status.tone)}`}
                      >
                        {status.label}
                      </span>
                      <p className="mt-2 max-w-[220px] text-xs text-mist">{status.detail}</p>
                    </div>
                  </div>
                  <ul className="mt-5 space-y-3">
                    {order.items.map((item) => (
                      <li key={`${order.id}-${item.productId}-${item.weight ?? "na"}-${item.name}`} className="flex gap-3">
                        <div className="logo-box relative h-14 w-14 shrink-0 overflow-hidden !rounded-lg">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="img-clean p-1"
                            unoptimized
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{item.name}</p>
                          <p className="text-sm text-mist">
                            Qty {item.quantity}
                            {item.weight != null ? ` · ${item.weight} lb` : ""} · $
                            {item.price.toFixed(2)} each
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/order/${order.id}`}
                    className="btn btn-ghost mt-5 !py-2 text-sm"
                  >
                    View progress →
                  </Link>
                </article>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
