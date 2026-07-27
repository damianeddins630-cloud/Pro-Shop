"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { BrandedPageBackdrop } from "@/components/BrandedPageBackdrop";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/profile";
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
    const dest = next.startsWith("/") ? next : "/profile";
    router.push(dest);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[70svh] max-w-md flex-col justify-center">
      <div className="mb-8 text-center">
        <Image
          src="/images/logo.png"
          alt="Ballard's Bowling Academy"
          width={180}
          height={120}
          className="mx-auto h-auto w-[140px] object-contain md:w-[170px]"
          priority
        />
        <p className="mt-4 text-sm tracking-[0.22em] text-red uppercase">
          Ballard&apos;s Bowling Academy
        </p>
        <h1 className="display mt-2 text-5xl md:text-6xl">Login</h1>
        <p className="mt-2 text-sm text-mist">
          Use your username or email + password. You must be logged in to buy.
        </p>
      </div>

      <div className="rounded-3xl border border-white/15 bg-black/55 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="login">
              Username or Email
            </label>
            <input id="login" name="login" required className="field" autoComplete="username" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="field"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button disabled={loading} className="btn btn-primary w-full" type="submit">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-mist">
          Need an account?{" "}
          <Link
            href={`/register?next=${encodeURIComponent(next)}`}
            className="text-red underline"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <BrandedPageBackdrop tone="auth">
      <Suspense fallback={<p className="text-center text-mist">Loading login...</p>}>
        <LoginForm />
      </Suspense>
    </BrandedPageBackdrop>
  );
}
