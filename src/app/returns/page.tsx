import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Returns & Pickup",
  description:
    "Pickup-only policy and return information for Ballard's Bowling Academy Pro Shop.",
};

export default function ReturnsPage() {
  return (
    <section className="site-shell section-pad pt-24">
      <p className="text-sm tracking-[0.22em] text-red uppercase">Policies</p>
      <h1 className="display mt-2 text-5xl md:text-6xl">Returns & Pickup</h1>
      <p className="mt-4 max-w-3xl text-sm text-amber-100/90">
        Draft for owner review — confirm final return rules with Ballard&apos;s
        before launch.
      </p>
      <div className="mt-8 max-w-3xl space-y-5 text-sm leading-relaxed text-mist">
        <p>
          <strong className="text-chalk">Pickup only.</strong> We do not ship.
          After you order online, come to Ballard&apos;s Bowling Academy Pro Shop
          for drilling (when needed) and pickup.
        </p>
        <p>
          Balls that have been drilled generally cannot be returned. Unused,
          undrilled items may be eligible for exchange or return at the pro
          shop&apos;s discretion — email us before you visit.
        </p>
        <p>
          Contact:{" "}
          <a
            className="text-chalk underline"
            href="mailto:Contactus@ballardsbowlingacademy.com?subject=Returns%20or%20Pickup"
          >
            Contactus@ballardsbowlingacademy.com
          </a>
        </p>
      </div>
      <Link href="/shop" className="btn btn-primary mt-10">
        Shop gear
      </Link>
    </section>
  );
}
