import Image from "next/image";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** auth = login look, ops = Operations Home Base look */
  tone?: "auth" | "ops";
};

/**
 * Full-bleed photo + logo treatment for login / Operations.
 * Same vibe as the home hero, but a different photo and overlay each time.
 */
export function BrandedPageBackdrop({ children, tone = "auth" }: Props) {
  // Home uses venue-still.jpg — these pages use different stills
  const image =
    tone === "ops" ? "/images/hero/slide-2.jpg" : "/images/hero/slide-3.jpg";

  return (
    <div className="relative min-h-[100svh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src={image}
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />

        {/* Readable but photo still clearly visible — like home, not solid black */}
        {tone === "ops" ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/25" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/40" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(225,6,0,0.28),transparent_50%)]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/35" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(225,6,0,0.18),transparent_55%)]" />
          </>
        )}

        {/* Soft logo watermarks — Ops uses the custom animated mark */}
        {tone === "ops" ? (
          <>
            <div className="absolute -right-4 top-16 opacity-30 md:right-8 md:top-24">
              <Image
                src="/images/ops-logo.gif"
                alt=""
                width={360}
                height={360}
                className="h-auto w-[200px] object-contain md:w-[300px]"
                unoptimized
                priority
              />
            </div>
            <div className="absolute -left-6 bottom-8 opacity-20 md:left-6">
              <Image
                src="/images/ops-logo.gif"
                alt=""
                width={280}
                height={280}
                className="h-auto w-[160px] rotate-[8deg] object-contain md:w-[220px]"
                unoptimized
              />
            </div>
          </>
        ) : (
          <>
            <div className="absolute -right-6 top-20 opacity-20 md:right-10 md:top-28">
              <Image
                src="/images/logo-light.png"
                alt=""
                width={420}
                height={280}
                className="h-auto w-[220px] rotate-[-8deg] object-contain md:w-[340px]"
                priority
              />
            </div>
            <div className="absolute -left-8 bottom-8 opacity-15 md:left-8">
              <Image
                src="/images/logo.png"
                alt=""
                width={320}
                height={220}
                className="h-auto w-[180px] rotate-[8deg] object-contain md:w-[260px]"
              />
            </div>
          </>
        )}
      </div>

      <div className="site-shell relative z-10 pt-24 pb-16">{children}</div>
    </div>
  );
}
