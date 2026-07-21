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
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
      </div>

      <div className="site-shell relative z-10 flex min-h-[100svh] flex-col justify-end pb-16 pt-28 md:justify-center md:pb-24">
        <div className="fade-up mb-6 flex items-center gap-4">
          <div className="circle-mark pulse-glow" style={{ width: 88, height: 88 }}>
            <Image src="/images/logo.png" alt="Ballard's Bowling Academy" width={70} height={70} priority />
          </div>
          <div>
            <p className="text-sm tracking-[0.28em] text-red uppercase">Ballard&apos;s Bowling Academy</p>
            <p className="text-xs tracking-[0.18em] text-mist uppercase">Pro Shop · Elite Coaching</p>
          </div>
        </div>

        <h1 className="display fade-up max-w-3xl text-5xl text-white md:text-7xl lg:text-8xl">
          Perfect Your Game
        </h1>
        <p className="fade-up-delay mt-5 max-w-xl text-base text-mist md:text-lg">
          Hall of Fame coaching and a state-of-the-art pro shop — black, white, and racing red.
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
