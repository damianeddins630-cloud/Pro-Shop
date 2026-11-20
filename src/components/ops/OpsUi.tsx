"use client";

import type { ReactNode } from "react";

export function OpsPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="ops-page-header">
      <div className="ops-page-header-copy">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="ops-page-header-actions">{actions}</div> : null}
    </div>
  );
}

export function OpsStatCard({
  label,
  value,
  meta,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  tone?: "default" | "red" | "blue" | "purple" | "green" | "amber";
  icon?: ReactNode;
}) {
  return (
    <article className={`ops-stat-card ops-stat-${tone}`}>
      <div className="ops-stat-card-top">
        <p className="ops-kpi-label">{label}</p>
        {icon ? <span className="ops-stat-icon">{icon}</span> : null}
      </div>
      <p className="ops-kpi-value">{value}</p>
      {meta ? <p className="ops-kpi-meta">{meta}</p> : null}
    </article>
  );
}

export function OpsPanel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`ops-card ${className}`.trim()}>
      {title ? (
        <div className="ops-card-head">
          <h2>{title}</h2>
          {action || null}
        </div>
      ) : null}
      {children}
    </article>
  );
}

export function OpsEmpty({ children }: { children: ReactNode }) {
  return <p className="ops-empty">{children}</p>;
}
