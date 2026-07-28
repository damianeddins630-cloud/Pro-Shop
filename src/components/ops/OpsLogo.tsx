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

/** Ops mark: normal bowling ball with the Ballard's logo */
export function OpsLogo({ size = "sm", className = "" }: Props) {
  const s = sizes[size];
  return (
    <div
      className={`ops-ball-mark relative shrink-0 overflow-hidden rounded-full border border-white/15 bg-black shadow-[0_0_28px_rgba(225,6,0,0.28)] ${s.box} ${className}`}
    >
      <Image
        src="/images/ops-logo.png"
        alt="Ballard's Bowling Academy"
        width={s.px}
        height={s.px}
        className="h-full w-full object-cover"
        priority
      />
    </div>
  );
}
