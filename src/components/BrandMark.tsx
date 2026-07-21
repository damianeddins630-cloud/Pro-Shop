import Image from "next/image";

type BrandMarkProps = {
  mode?: "logo" | "cart";
  size?: number;
  className?: string;
};

export function BrandMark({ mode = "logo", size = 52, className = "" }: BrandMarkProps) {
  return (
    <div
      className={`circle-mark pulse-glow ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {mode === "logo" ? (
        <Image src="/images/logo.png" alt="" width={size} height={size} priority />
      ) : (
        <svg
          viewBox="0 0 24 24"
          width={size * 0.48}
          height={size * 0.48}
          fill="none"
          stroke="#f0b429"
          strokeWidth="1.8"
        >
          <path d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L21 8H7" />
          <circle cx="10" cy="20" r="1.4" fill="#f0b429" stroke="none" />
          <circle cx="17" cy="20" r="1.4" fill="#f0b429" stroke="none" />
        </svg>
      )}
    </div>
  );
}
