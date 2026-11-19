"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";
import { EditablePageTitle } from "@/components/EditablePageTitle";

const CONTACT_EMAIL = "Contactus@ballardsbowlingacademy.com";

const defaults = {
  brand: "Ballard's Bowling Academy",
  tagline: "Elite coaching. Family. Passion.",
  blurb:
    "World-class coaching and a full-service pro shop — built for champions at every level, on and off the lanes.",
  explore: "Explore",
  contact: "Contact",
  contact_lead: "Email:",
  pickup:
    "In-store pickup only — we do not ship. Buy online, then visit Ballard's for drilling and pickup.",
  subscribe_cta: "Subscribe for updates",
  copyright: `© ${new Date().getFullYear()} Ballard's Bowling Academy Pro Shop`,
};

export function SiteFooter() {
  const [t, setT] = useState(defaults);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/texts?page=footer", { cache: "no-store" });
        const data = await res.json();
        const texts = (data.texts || []) as { slot: string; text: string }[];
        const map = Object.fromEntries(texts.map((x) => [x.slot, x.text]));
        setT((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.keys(prev).map((k) => [k, map[k] || prev[k as keyof typeof prev]])
          ),
        }));
      } catch {
        // keep defaults
      }
    })();
  }, []);

  return (
    <footer className="site-footer mt-12 border-t border-white/10 bg-gradient-to-b from-black to-[#070707]">
      <div className="site-shell section-pad grid gap-10 md:grid-cols-[1.35fr_1fr_1fr]">
        <div>
          <div className="mb-5 flex items-center gap-3">
            <BrandMark mode="logo" size={56} />
            <div>
              <EditablePageTitle
                page="footer"
                slot="brand"
                initial={t.brand}
                as="h2"
                className="display text-2xl md:text-3xl"
              />
              <EditablePageTitle
                page="footer"
                slot="tagline"
                initial={t.tagline}
                as="p"
                className="mt-1 text-sm tracking-wide text-mist"
              />
            </div>
          </div>
          <EditablePageTitle
            page="footer"
            slot="blurb"
            initial={t.blurb}
            as="p"
            multiline
            rows={3}
            className="max-w-md text-sm leading-relaxed text-mist"
          />
          <EditablePageTitle
            page="footer"
            slot="pickup"
            initial={t.pickup}
            as="p"
            multiline
            rows={3}
            className="mt-4 max-w-md text-sm leading-relaxed text-chalk"
          />
        </div>
        <div>
          <EditablePageTitle
            page="footer"
            slot="explore"
            initial={t.explore}
            as="h3"
            className="mb-3 text-sm font-semibold tracking-[0.16em] text-red uppercase"
          />
          <div className="flex flex-col gap-2 text-sm text-mist">
            <Link href="/coaching">Coaching Clinics</Link>
            <Link href="/shop">Pro Shop</Link>
            <Link href="/deals">Deal of the Month</Link>
            <Link href="/bvbc">Ballard vs. The Big C</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/returns">Returns & Pickup</Link>
          </div>
        </div>
        <div>
          <EditablePageTitle
            page="footer"
            slot="contact"
            initial={t.contact}
            as="h3"
            className="mb-3 text-sm font-semibold tracking-[0.16em] text-red uppercase"
          />
          <p className="text-sm text-mist">
            <EditablePageTitle
              page="footer"
              slot="contact_lead"
              initial={t.contact_lead}
              as="span"
              className="inline"
            />{" "}
            <a
              className="break-all text-chalk underline decoration-red/50"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="mt-3 text-sm text-mist">
            Phone and store hours: contact us by email — we will confirm the best
            location and time for pickup or lessons.
          </p>
          <Link href="/subscribe" className="btn btn-ghost mt-4 !px-4 !py-2 text-sm">
            <EditablePageTitle
              page="footer"
              slot="subscribe_cta"
              initial={t.subscribe_cta}
              as="span"
              className="inline"
            />
          </Link>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-mist/80">
        <EditablePageTitle
          page="footer"
          slot="copyright"
          initial={t.copyright}
          as="p"
          className="text-xs text-mist/80"
        />
      </div>
    </footer>
  );
}
