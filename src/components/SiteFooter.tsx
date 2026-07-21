import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-white/10 bg-black/25">
      <div className="site-shell section-pad grid gap-8 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <BrandMark mode="logo" size={56} />
            <div>
              <div className="display text-2xl">Ballard&apos;s Bowling Academy</div>
              <p className="text-sm text-mist">Elite coaching. Family. Passion.</p>
            </div>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-mist">
            World-class coaching and pro shop support for bowlers at every level —
            on and off the lanes.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold tracking-[0.16em] text-amber uppercase">
            Explore
          </h3>
          <div className="flex flex-col gap-2 text-sm text-mist">
            <Link href="/coaching">Coaching Clinics</Link>
            <Link href="/shop">Pro Shop</Link>
            <Link href="/deals">Deal of the Month</Link>
            <Link href="/bvbc">Ballard vs. The Big C</Link>
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold tracking-[0.16em] text-amber uppercase">
            Contact
          </h3>
          <p className="text-sm text-mist">
            Coaching inquiries:{" "}
            <a
              className="text-chalk underline decoration-amber/50"
              href="mailto:Contactus@ballardsbowlingacdemy.com"
            >
              Contactus@ballardsbowlingacdemy.com
            </a>
          </p>
          <Link href="/subscribe" className="btn btn-ghost mt-4 !px-4 !py-2 text-sm">
            Subscribe for updates
          </Link>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-mist/80">
        © {new Date().getFullYear()} Ballard&apos;s Bowling Academy Pro Shop
      </div>
    </footer>
  );
}
