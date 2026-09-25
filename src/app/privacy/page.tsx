import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy policy for Ballard's Bowling Academy Pro Shop website and customer accounts.",
};

export default function PrivacyPage() {
  return (
    <section className="site-shell section-pad pt-24">
      <p className="text-sm tracking-[0.22em] text-red uppercase">Legal</p>
      <h1 className="display mt-2 text-5xl md:text-6xl">Privacy Policy</h1>
      <p className="mt-4 max-w-3xl text-sm text-amber-100/90">
        Draft for owner review — not legal advice. Confirm with your counsel before
        launch.
      </p>
      <div className="mt-8 max-w-3xl space-y-5 text-sm leading-relaxed text-mist">
        <p>
          Ballard&apos;s Bowling Academy (&quot;we&quot;) operates this website and
          pro shop experience. We collect information you provide when you create an
          account, subscribe, request coaching, or place an order (such as name,
          email, phone, and mailing city/state).
        </p>
        <p>
          Payment card details are processed by Shopify (or another payment
          processor). We do not store full card numbers on this website.
        </p>
        <p>
          We use your information to fulfill orders, communicate about pickup and
          drilling, send updates you request, and improve the site. We do not sell
          your contact information.
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
