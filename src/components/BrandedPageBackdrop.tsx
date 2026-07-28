import Image from "next/image";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** auth = login look, ops = Operations Home Base look */
  tone?: "auth" | "ops";
};

/**
 * Full-bleed photo + logo treatment for login / Operations.
 * Ops uses a custom Ballard's logo bowling ball for mark + background.
 */
export function BrandedPageBackdrop({ children, tone = "auth" }: Props) {
  return (
    <div className="relative min-h-[100svh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        {tone === "ops" ? (
          <>
            <div className="ops-ball-bg absolute inset-[-4%]">
              <Image
                src="/images/ops-ball-bg.jpg"
                alt=""
                fill
                priority
                className="object-cover object-center"
                sizes="100vw"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/82 via-black/52 to-black/38" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-transparent to-black/52" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(225,6,0,0.24),transparent_58%)]" />
            <div className="ops-ball-float absolute right-3 top-16 opacity-85 md:right-8 md:top-24">
              <Image
                src="/images/ops-logo.png"
                alt=""
                width={280}
                height={280}
                className="h-auto w-[130px] object-contain drop-shadow-[0_0_30px_rgba(225,6,0,0.5)] md:w-[210px]"
                priority
              />
            </div>
          </>
        ) : (
          <>
            <Image
              src="/images/hero/slide-3.jpg"
              alt=""
              fill
              priority
              className="object-cover object-center"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/35" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(225,6,0,0.18),transparent_55%)]" />
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
