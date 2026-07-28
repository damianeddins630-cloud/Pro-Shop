"use client";

import Image from "next/image";

type Props = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { box: "h-[92px] w-[92px] md:h-[112px] md:w-[112px]", px: 112 },
  md: { box: "h-[148px] w-[148px] md:h-[176px] md:w-[176px]", px: 176 },
  lg: { box: "h-[196px] w-[196px] md:h-[228px] md:w-[228px]", px: 228 },
};

/**
 * Ops mark: custom red/black ball with the real Ballard's logo on top.
 * Uses layered images so the official logo stays sharp and readable.
 */
export function OpsLogo({ size = "sm", className = "" }: Props) {
  const s = sizes[size];
  return (
    <div
      className={`ops-ball-mark relative shrink-0 overflow-hidden rounded-full border border-red/50 bg-black shadow-[0_0_34px_rgba(225,6,0,0.42)] ${s.box} ${className}`}
    >
      {/* Custom ball base */}
      <Image
        src="/images/ops-ball-mark.png"
        alt=""
        width={s.px}
        height={s.px}
        className="absolute inset-0 h-full w-full object-cover"
        priority
      />
      {/* Soft plate so the real logo pops */}
      <div className="pointer-events-none absolute inset-[14%] rounded-full bg-black/55" />
      {/* Exact academy logo */}
      <Image
        src="/images/logo.png"
        alt="Ballard's Bowling Academy"
        width={s.px}
        height={s.px}
        className="relative z-10 h-full w-full object-contain p-[13%] drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]"
        priority
      />
      <div className="pointer-events-none absolute inset-0 z-20 rounded-full ring-1 ring-white/15" />
      <div className="pointer-events-none absolute inset-0 z-20 rounded-full bg-[radial-gradient(circle_at_30%_22%,rgba(255,255,255,0.18),transparent_40%)]" />
    </div>
  );
}
