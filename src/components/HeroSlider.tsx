"use client";

import Image from "next/image";
import Link from "next/link";

export function HeroSlider() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/images/site-bg.jpg"
          alt="Ballard's Bowling Academy"
          fill
          priority
          className="object-cover kenburns"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/35" />
      </div>

      <div className="site-shell relative z-10 flex min-h-[100svh] flex-col justify-end pb-16 pt-28 md:justify-center md:pb-24">
        <div className="fade-up mb-6">
          <Image
            src="/images/logo.png"
            alt="Ballard's Bowling Academy"
            width={220}
            height={150}
            className="h-auto w-[160px] md:w-[220px] object-contain"
            priority
          />
        </div>

        <h1 className="display fade-up max-w-3xl text-5xl text-white md:text-7xl lg:text-8xl">
          Perfect Your Game
        </h1>
        <p className="fade-up-delay mt-5 max-w-xl text-base text-mist md:text-lg">
          Hall of Fame coaching and a state-of-the-art pro shop.
        </p>
        <div className="fade-up-delay mt-8 flex flex-wrap gap-3">
          <Link href="/coaching" className="btn btn-primary">
            Book a Lesson →
          </Link>
          <Link href="/shop" className="btn btn-ghost">
            Shop gear →
          </Link>
        </div>
      </div>
    </section>
  );
}
