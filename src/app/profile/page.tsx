"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PublicUser } from "@/lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user || null);
        setLoading(false);
      });
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <section className="site-shell section-pad pt-24">
        <p className="text-mist">Loading profile...</p>
      </section>
    );
  }

  if (!user) {
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

  return (
    <section className="site-shell section-pad pt-24">
      <div className="max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <p className="text-sm tracking-[0.2em] text-amber uppercase">Your account</p>
        <h1 className="display mt-2 text-5xl">{user.username}</h1>
        <dl className="mt-8 space-y-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-white/10 py-2">
            <dt className="text-mist">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-white/10 py-2">
            <dt className="text-mist">Phone</dt>
            <dd>{user.phoneNumber || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-white/10 py-2">
            <dt className="text-mist">Date of birth</dt>
            <dd>{user.dateOfBirth}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-white/10 py-2">
            <dt className="text-mist">Role</dt>
            <dd className="capitalize text-amber">{user.role}</dd>
          </div>
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          {user.role === "admin" && (
            <Link href="/admin" className="btn btn-primary">
              Open admin
            </Link>
          )}
          <Link href="/shop" className="btn btn-ghost">
            Shop
          </Link>
          <Link href="/subscribe" className="btn btn-ghost">
            Subscribe
          </Link>
          <button type="button" onClick={logout} className="btn btn-ghost">
            Log out
          </button>
        </div>
      </div>
    </section>
  );
}
