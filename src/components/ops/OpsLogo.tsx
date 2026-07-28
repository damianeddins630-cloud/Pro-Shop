"use client";

import Image from "next/image";

type Props = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { box: "h-[88px] w-[88px] md:h-[110px] md:w-[110px]", px: 110 },
  md: { box: "h-[140px] w-[140px] md:h-[170px] md:w-[170px]", px: 170 },
  lg: { box: "h-[180px] w-[180px] md:h-[220px] md:w-[220px]", px: 220 },
};

/** Custom Ballard's logo bowling ball mark for Operations Home Base */
export function OpsLogo({ size = "sm", className = "" }: Props) {
  const s = sizes[size];
  return (
    <div
      className={`ops-ball-mark relative shrink-0 overflow-hidden rounded-full border border-red/45 bg-black shadow-[0_0_36px_rgba(225,6,0,0.4)] ${s.box} ${className}`}
    >
      <Image
        src="/images/ops-logo.gif"
        alt="Ballard's Bowling Academy Operations"
        width={s.px}
        height={s.px}
        className="h-full w-full object-cover"
        unoptimized
        priority
      />
      <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/15" />
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.16),transparent_42%)]" />
    </div>
  );
}
