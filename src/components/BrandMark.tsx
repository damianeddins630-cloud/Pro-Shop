"use client";

import Image from "next/image";

type BrandMarkProps = {
  mode?: "logo" | "cart";
  size?: number;
  className?: string;
};

export function BrandMark({ mode = "logo", size = 52, className = "" }: BrandMarkProps) {
  if (mode === "cart") {
    return (
      <div
        className={`grid place-items-center ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          width={size * 0.72}
          height={size * 0.72}
          fill="none"
          stroke="#e10600"
          strokeWidth="1.8"
        >
          <path d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L21 8H7" />
          <circle cx="10" cy="20" r="1.4" fill="#e10600" stroke="none" />
          <circle cx="17" cy="20" r="1.4" fill="#e10600" stroke="none" />
        </svg>
      </div>
    );
  }

  return (
    <span
      className={`logo-box inline-flex items-center justify-center !p-1.5 ${className}`}
      style={{ width: size + 12, height: size + 12 }}
    >
      <Image
        src="/images/logo.png"
        alt="Ballard's Bowling Academy"
        width={size}
        height={size}
        className="img-clean h-auto w-full"
        style={{ width: size, height: "auto" }}
        priority
      />
    </span>
  );
}
