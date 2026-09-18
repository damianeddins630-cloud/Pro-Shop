"use client";

import { useEffect, useState } from "react";
import { EditablePageTitle } from "@/components/EditablePageTitle";

/** Ballard's ActiveCampaign list signup (High Revs / client request). */
const ACTIVECAMPAIGN_FORM_URL =
  "https://ballardsbowlingacademy27000.activehosted.com/f/1";

export default function SubscribePage() {
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

  return (
    <section className="site-shell section-pad pt-24 pb-20">
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

      <div className="mt-10 max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <iframe
          title="Subscribe for email updates"
          src={ACTIVECAMPAIGN_FORM_URL}
          className="h-[720px] w-full border-0 bg-white"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <p className="mt-4 max-w-xl text-sm text-mist">
        Prefer a full page?{" "}
        <a
          href={ACTIVECAMPAIGN_FORM_URL}
          target="_blank"
          rel="noreferrer"
          className="text-red underline"
        >
          Open the ActiveCampaign signup form
        </a>
        .
      </p>
    </section>
  );
}
