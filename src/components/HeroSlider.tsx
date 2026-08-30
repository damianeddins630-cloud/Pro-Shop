"use client";

import Image from "next/image";
import Link from "next/link";
import { EditablePageTitle } from "@/components/EditablePageTitle";

export function HeroSlider({
  heroTitle = "Perfect Your Game",
  heroSub = "Hall of Fame coaching and a state-of-the-art pro shop.",
  ctaPrimary = "Book a Lesson →",
  ctaSecondary = "Shop gear →",
}: {
  heroTitle?: string;
  heroSub?: string;
  ctaPrimary?: string;
  ctaSecondary?: string;
}) {
  return (
    <section className="relative min-h-[100svh] overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/images/hero/slide-3.jpg"
          alt="Ballard's Bowling Academy Pro Shop"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        {/* Dark scrims so headline stays readable over the pro shop wall */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/65 to-black/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/50" />
      </div>

      <div className="site-shell relative z-10 flex min-h-[100svh] flex-col justify-end pb-16 pt-28 md:justify-center md:pb-24">
        <div className="hero-copy-panel fade-up max-w-3xl">
          <EditablePageTitle
            page="home"
            slot="hero"
            initial={heroTitle}
            as="h1"
            className="display hero-title-pop max-w-3xl text-5xl md:text-7xl lg:text-8xl"
          />
          <EditablePageTitle
            page="home"
            slot="hero_sub"
            initial={heroSub}
            as="p"
            multiline
            rows={2}
            className="hero-sub-pop mt-5 max-w-xl text-base md:text-lg"
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/coaching" className="btn btn-primary">
              <EditablePageTitle
                page="home"
                slot="hero_cta_primary"
                initial={ctaPrimary}
                as="span"
                className="inline"
              />
            </Link>
            <Link href="/shop" className="btn btn-ghost">
              <EditablePageTitle
                page="home"
                slot="hero_cta_secondary"
                initial={ctaSecondary}
                as="span"
                className="inline"
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
