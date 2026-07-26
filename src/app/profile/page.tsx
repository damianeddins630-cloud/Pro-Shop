"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useEditMode } from "@/lib/edit-mode";
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
              if (oRes.ok) setOrders(o.orders || []);
              else setOrdersError(o.error || "Could not load orders");
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
          {(["account", "orders"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-2 text-sm capitalize ${
                tab === t ? "bg-red text-white font-bold" : "border border-white/15 text-mist"
              }`}
            >
              {t === "orders" ? "Previous orders" : "Account"}
            </button>
          ))}
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
              <Link href="/admin" className="btn btn-primary">
                Open admin
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
          {ordersError && <p className="text-sm text-red-300">{ordersError}</p>}
          {orders.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
              <p className="text-mist">No previous orders yet.</p>
              <Link href="/shop" className="btn btn-primary mt-6">
                Browse the shop
              </Link>
            </div>
          ) : (
            orders.map((order) => (
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
                  </div>
                  <span className="rounded-full border border-red/40 px-3 py-1 text-xs capitalize text-red">
                    {order.status.replace(/_/g, " ")}
                    {order.paymentProvider === "shopify" ? " · Shopify" : ""}
                  </span>
                </div>
                <ul className="mt-5 space-y-3">
                  {order.items.map((item) => (
                    <li key={`${order.id}-${item.productId}`} className="flex gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/40">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-contain p-1"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="text-sm text-mist">
                          Qty {item.quantity} · ${item.price.toFixed(2)} each
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </div>
      )}
    </section>
  );
}
