"use client";

import Link from "next/link";

const links = [
  {
    href: "/ops/users",
    title: "Users",
    text: "Staff and customer accounts, roles assigned per person.",
  },
  {
    href: "/ops/roles",
    title: "Roles & permissions",
    text: "What each role can see and change in Operations.",
  },
  {
    href: "/ops/shopify",
    title: "Shopify / Integrations",
    text: "Payment checkout connect. Website still owns catalog prices.",
  },
  {
    href: "/ops/backups",
    title: "Backups & System",
    text: "Durable store health, self-test, and future Sheets backup.",
  },
];

export default function OpsAdminHubPage() {
  return (
    <div>
      <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", fontWeight: 750 }}>
        Administration
      </h2>
      <p className="ops-note" style={{ marginTop: 0, marginBottom: "1rem" }}>
        Control who can access the business system. Do not give every staff
        member website-owner permissions.
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
