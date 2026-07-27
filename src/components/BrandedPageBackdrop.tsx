import Image from "next/image";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Optional eyebrow above the content */
  tone?: "auth" | "ops";
};

/**
 * Full-bleed venue + logo treatment used on login / Operations pages.
 * Matches the branded hero feel of the rest of the site (still image, no motion).
 */
export function BrandedPageBackdrop({ children, tone = "auth" }: Props) {
  const accent =
    tone === "ops"
      ? "from-red/25 via-black/80 to-black"
      : "from-black/70 via-black/85 to-black";

  return (
    <div className="relative min-h-[100svh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/images/venue-still.jpg"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className={`absolute inset-0 bg-gradient-to-b ${accent}`} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(225,6,0,0.22),transparent_55%)]" />

        {/* Large watermark logos — brand first, like the other pages */}
        <div className="absolute -right-8 top-16 opacity-[0.12] md:right-8 md:top-24">
          <Image
            src="/images/logo-light.png"
            alt=""
            width={420}
            height={280}
            className="h-auto w-[240px] rotate-[-8deg] object-contain md:w-[380px]"
            priority
          />
        </div>
        <div className="absolute -left-10 bottom-10 opacity-[0.08] md:left-6">
          <Image
            src="/images/logo.png"
            alt=""
            width={360}
            height={240}
            className="h-auto w-[200px] rotate-[10deg] object-contain md:w-[300px]"
          />
        </div>
      </div>

      <div className="site-shell relative z-10 pt-24 pb-16">{children}</div>
    </div>
  );
}
