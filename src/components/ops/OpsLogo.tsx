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

/** Custom animated Operations Home Base logo mark */
export function OpsLogo({ size = "sm", className = "" }: Props) {
  const s = sizes[size];
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border border-red/40 bg-black/50 shadow-[0_0_40px_rgba(225,6,0,0.35)] ${s.box} ${className}`}
    >
      <Image
        src="/images/ops-logo.gif"
        alt="Operations Home Base"
        width={s.px}
        height={s.px}
        className="h-full w-full object-cover"
        unoptimized
        priority
      />
      <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/10" />
    </div>
  );
}
