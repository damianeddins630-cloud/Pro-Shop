"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        username: form.get("username"),
        password: form.get("password"),
        phoneNumber: form.get("phoneNumber"),
        dateOfBirth: form.get("dateOfBirth"),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Registration failed");
      return;
    }
    router.push("/profile");
    router.refresh();
  }

  return (
    <section className="site-shell section-pad pt-24">
      <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <h1 className="display text-5xl">Create Account</h1>
        <p className="mt-2 text-sm text-mist">
          Accounts need email, username, password, phone number, and date of birth.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" required className="field" />
          </div>
          <div>
            <label className="label" htmlFor="username">
              Username
            </label>
            <input id="username" name="username" required minLength={3} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input id="password" name="password" type="password" required minLength={6} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="phoneNumber">
              Phone Number
            </label>
            <input id="phoneNumber" name="phoneNumber" required className="field" />
          </div>
          <div>
            <label className="label" htmlFor="dateOfBirth">
              Date of Birth
            </label>
            <input id="dateOfBirth" name="dateOfBirth" type="date" required className="field" />
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button disabled={loading} className="btn btn-primary w-full" type="submit">
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-sm text-mist">
          Already have an account?{" "}
          <Link href="/login" className="text-red underline">
            Login
          </Link>
        </p>
      </div>
    </section>
  );
}
