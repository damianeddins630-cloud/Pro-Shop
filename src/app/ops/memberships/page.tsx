"use client";

import Link from "next/link";

export default function OpsMembershipsPage() {
  return (
    <div>
      <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", fontWeight: 750 }}>
        Membership Management
      </h2>
      <div className="ops-stage-banner" role="status">
        Coming in a later stage. Recurring memberships, renewals, and status
        (active / paused / cancelled / expired) will live here. Cancelled or
        unpaid memberships will never count as collected revenue.
      </div>
      <div className="ops-card" style={{ marginTop: "1rem" }}>
        <div className="ops-card-head">
          <h2>What this module will track</h2>
        </div>
        <ul className="ops-note" style={{ margin: 0, paddingLeft: "1.1rem" }}>
          <li>Customer membership type and pricing</li>
          <li>Start and renewal dates</li>
          <li>Payment status and history</li>
          <li>Active, paused, cancelled, or expired state</li>
        </ul>
        <div className="ops-actions-grid" style={{ marginTop: "1rem" }}>
          <Link className="ops-action" href="/ops">
            ← Dashboard
          </Link>
          <Link className="ops-action" href="/ops/customers">
            Customers
          </Link>
        </div>
      </div>
    </div>
  );
}
