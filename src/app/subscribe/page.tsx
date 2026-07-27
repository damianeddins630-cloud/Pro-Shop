"use client";

import { FormEvent, useEffect, useState } from "react";
import { EditablePageTitle } from "@/components/EditablePageTitle";

export default function SubscribePage() {
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [eyebrow, setEyebrow] = useState("Stay connected");
  const [title, setTitle] = useState("Subscribe for Email Updates");
  const [intro, setIntro] = useState(
    "We will email you periodically with news, updates and offers. We will never sell, rent or give away your contact information."
  );

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/texts?page=subscribe", { cache: "no-store" });
        const data = await res.json();
        const texts = (data.texts || []) as { slot: string; text: string }[];
        const map = Object.fromEntries(texts.map((t) => [t.slot, t.text]));
        if (map.eyebrow) setEyebrow(map.eyebrow);
        if (map.title) setTitle(map.title);
        if (map.intro) setIntro(map.intro);
      } catch {
        // keep defaults
      }
    })();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("idle");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email"),
        city: form.get("city"),
        state: form.get("state"),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus("error");
      setMessage(data.error || "Something went wrong");
      return;
    }
    setStatus("ok");
    setMessage("You're subscribed — thanks for joining Ballard's updates.");
    e.currentTarget.reset();
  }

  return (
    <section className="site-shell section-pad pt-24">
      <EditablePageTitle
        page="subscribe"
        slot="eyebrow"
        initial={eyebrow}
        as="p"
        className="text-sm tracking-[0.22em] text-red uppercase"
      />
      <EditablePageTitle
        page="subscribe"
        slot="title"
        initial={title}
        as="h1"
        className="display mt-2 text-5xl md:text-7xl"
      />
      <EditablePageTitle
        page="subscribe"
        slot="intro"
        initial={intro}
        as="p"
        multiline
        rows={3}
        className="mt-4 max-w-2xl text-mist"
      />

      <form
        onSubmit={onSubmit}
        className="mt-10 max-w-xl space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="firstName">
              First Name
            </label>
            <input id="firstName" name="firstName" required className="field" placeholder="Type your first name" />
          </div>
          <div>
            <label className="label" htmlFor="lastName">
              Last Name
            </label>
            <input id="lastName" name="lastName" required className="field" placeholder="Type your last name" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email*
          </label>
          <input id="email" name="email" type="email" required className="field" placeholder="Type your email" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="city">
              City*
            </label>
            <input id="city" name="city" required className="field" />
          </div>
          <div>
            <label className="label" htmlFor="state">
              State*
            </label>
            <input id="state" name="state" required className="field" />
          </div>
        </div>
        <button type="submit" className="btn btn-primary">
          Subscribe
        </button>
        {status !== "idle" && (
          <p className={`text-sm ${status === "ok" ? "text-emerald-300" : "text-red-300"}`}>
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
