"use client";

import Link from "next/link";

export default function OpsCoachingPage() {
  return (
    <div>
      <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem", fontWeight: 750 }}>
        Coaching Management
      </h2>
      <div className="ops-stage-banner" role="status">
        Coming in a later stage. Private lessons, group lessons, packages,
        coach assignments, attendance, and payment status will live here. No
        coaching revenue is counted until payment is actually received.
      </div>
      <div className="ops-card" style={{ marginTop: "1rem" }}>
        <div className="ops-card-head">
          <h2>What this module will track</h2>
        </div>
        <ul className="ops-note" style={{ margin: 0, paddingLeft: "1.1rem" }}>
          <li>Private and group lessons</li>
          <li>Coaching packages and remaining sessions</li>
          <li>Coach assignments and customer bookings</li>
          <li>Lesson dates, times, and attendance</li>
          <li>Payment status (booked ≠ collected until paid)</li>
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
