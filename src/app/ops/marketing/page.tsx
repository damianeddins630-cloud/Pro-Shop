"use client";

import Link from "next/link";
import { OpsPageHeader } from "@/components/ops/OpsUi";

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
    <div className="ops-dash-grid">
      <OpsPageHeader
        title="Marketing"
        description="Promotions and audience tools. Deals, Coupons, Sponsors, and Subscribers stay available from this hub."
      />
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
