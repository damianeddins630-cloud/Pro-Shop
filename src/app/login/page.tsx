"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        login: form.get("login"),
        password: form.get("password"),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }
    router.push(data.user?.role === "admin" ? "/admin" : "/profile");
    router.refresh();
  }

  return (
    <section className="site-shell section-pad pt-24">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <h1 className="display text-5xl">Login</h1>
        <p className="mt-2 text-sm text-mist">Use your username or email + password.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="label" htmlFor="login">
              Username or Email
            </label>
            <input id="login" name="login" required className="field" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input id="password" name="password" type="password" required className="field" />
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button disabled={loading} className="btn btn-primary w-full" type="submit">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-sm text-mist">
          Need an account?{" "}
          <Link href="/register" className="text-red underline">
            Register
          </Link>
        </p>
      </div>
    </section>
  );
}
