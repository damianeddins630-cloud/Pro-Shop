"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const slides = [
  {
    image: "/images/hero/slide-1.jpg",
    title: "Perfect Your Game",
    copy: "Hall of Fame coaching built around your goals on and off the lanes.",
  },
  {
    image: "/images/hero/slide-2.jpg",
    title: "Hall of Fame Instruction",
    copy: "Train with Del & Carolyn Ballard — champions who teach champions.",
  },
  {
    image: "/images/hero/slide-3.jpg",
    title: "State of the Art Pro Shop",
    copy: "Storm, Roto Grip, 900 Global and tour-ready accessories in stock.",
  },
];

export function HeroSlider() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, []);

  const slide = slides[index];

  return (
    <section className="relative min-h-[100svh] overflow-hidden">
      {slides.map((s, i) => (
        <div
          key={s.image}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={s.image}
            alt=""
            fill
            priority={i === 0}
            className={`object-cover ${i === index ? "kenburns" : ""}`}
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07121d]/90 via-[#07121d]/65 to-[#07121d]/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07121d] via-transparent to-[#07121d]/35" />
        </div>
      ))}

      <div className="site-shell relative z-10 flex min-h-[100svh] flex-col justify-end pb-16 pt-28 md:justify-center md:pb-24">
        <p className="fade-up mb-3 text-sm tracking-[0.28em] text-amber uppercase">
          Ballard&apos;s Bowling Academy
        </p>
        <h1 className="display fade-up max-w-3xl text-5xl text-chalk md:text-7xl lg:text-8xl">
          {slide.title}
        </h1>
        <p className="fade-up-delay mt-5 max-w-xl text-base text-mist md:text-lg">
          {slide.copy}
        </p>
        <div className="fade-up-delay mt-8 flex flex-wrap gap-3">
          <Link href="/coaching" className="btn btn-primary">
            Book a Lesson →
          </Link>
          <Link href="/shop" className="btn btn-ghost">
            View all products →
          </Link>
        </div>

        <div className="mt-10 flex items-center gap-4 text-sm text-mist">
          <span>
            {index + 1}/{slides.length}
          </span>
          <button
            type="button"
            className="underline decoration-amber/50 underline-offset-4"
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
          >
            Previous
          </button>
          <button
            type="button"
            className="underline decoration-amber/50 underline-offset-4"
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
