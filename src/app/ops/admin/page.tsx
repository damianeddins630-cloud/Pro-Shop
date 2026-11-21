"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OpsPageHeader } from "@/components/ops/OpsUi";

type Entry = {
  id: string;
  at: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  detail?: string;
};

export default function OpsAdminHubPage() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/ops/activity?limit=40", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setEntries(data.entries || []);
    })();
  }, []);

  const links = [
    {
      href: "/ops/users",
      title: "Users",
      text: "Staff and customer accounts.",
    },
    {
      href: "/ops/roles",
      title: "Roles & permissions",
      text: "Configurable access — owner rank stays locked.",
    },
    {
      href: "/ops/integrations",
      title: "System settings / Integrations",
      text: "Shopify, Sheets, and durable storage connections.",
    },
    {
      href: "/ops/backups",
      title: "Backups & System",
      text: "Health checks, backup history, Sheets config.",
    },
  ];

  return (
    <div className="ops-dash-grid">
      <OpsPageHeader
        title="Administration"
        description="Control who can access the business system. Do not give every staff member website-owner permissions."
      />

      <div className="ops-hub-grid">
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="ops-hub-card">
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </Link>
        ))}
      </div>

      <article className="ops-card">
        <div className="ops-card-head">
          <h2>Activity log</h2>
          <span className="ops-badge ops-badge-gray">Recent</span>
        </div>
        {!entries.length ? (
          <p className="ops-note">
            No logged changes yet. Coaching, membership, expense, and backup
            actions appear here.
          </p>
        ) : (
          <ul className="ops-activity">
            {entries.map((e) => (
              <li key={e.id}>
                <div>
                  <strong>
                    {e.action} · {e.entityType}
                  </strong>
                  <div style={{ color: "var(--ops-muted)", fontSize: "0.8rem" }}>
                    {e.actorName || "system"} · {e.detail || e.entityId || ""} ·{" "}
                    {new Date(e.at).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}
