import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of service for shopping and using Ballard's Bowling Academy Pro Shop online.",
};

export default function TermsPage() {
  return (
    <section className="site-shell section-pad pt-24">
      <p className="text-sm tracking-[0.22em] text-red uppercase">Legal</p>
      <h1 className="display mt-2 text-5xl md:text-6xl">Terms of Service</h1>
      <p className="mt-4 max-w-3xl text-sm text-amber-100/90">
        Draft for owner review — not legal advice. Confirm with your counsel before
        launch.
      </p>
      <div className="mt-8 max-w-3xl space-y-5 text-sm leading-relaxed text-mist">
        <p>
          By using this website you agree to these terms. Products, prices, and
          availability may change. Orders for bowling balls and related services are
          fulfilled for in-store pickup and drilling — we do not offer standard
          shipping.
        </p>
        <p>
          An account may be required to complete checkout. You are responsible for
          keeping your login information secure.
        </p>
        <p>
          Payment is processed through Shopify&apos;s secure checkout. Title and
          risk for purchased goods transfer according to our in-store pickup
          process.
        </p>
        <p>
          Questions:{" "}
          <a
            className="text-chalk underline"
            href="mailto:Contactus@ballardsbowlingacademy.com"
          >
            Contactus@ballardsbowlingacademy.com
          </a>
          .
        </p>
      </div>
      <Link href="/" className="btn btn-ghost mt-10">
        Back home
      </Link>
    </section>
  );
}
