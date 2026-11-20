"use client";

import Link from "next/link";

const links = [
  {
    href: "/ops/deals",
    title: "Deals",
    text: "Featured deals and specials shown on the storefront.",
  },
  {
    href: "/ops/coupons",
    title: "Coupons",
    text: "Discount codes, limits, and usage for checkout.",
  },
  {
    href: "/ops/sponsors",
    title: "Sponsors",
    text: "Sponsor logos and links on the site.",
  },
  {
    href: "/ops/subscribers",
    title: "Subscribers",
    text: "Email list and announcement recipients.",
  },
];

export default function OpsMarketingHubPage() {
  return (
    <div>
      <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", fontWeight: 750 }}>
        Marketing
      </h2>
      <p className="ops-note" style={{ marginTop: 0, marginBottom: "1rem" }}>
        Promotions and audience tools. Existing Deals, Coupons, Sponsors, and
        Subscribers pages stay intact — this hub organizes them.
      </p>
      <div className="ops-hub-grid">
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="ops-hub-card">
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
