"use client";

import {
  CUSTOMER_JOURNEY,
  IN_STORE_POLICY,
  STORE_NAME,
} from "@/lib/in-store";

export function InStoreVisitCard({
  compact = false,
}: {
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-mist">
        <span className="font-medium text-chalk">In-store only:</span>{" "}
        {IN_STORE_POLICY}
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] via-black/40 to-red/10 p-5 md:p-6">
      <p className="text-xs tracking-[0.22em] text-red uppercase">
        How it works
      </p>
      <h3 className="display mt-1 text-3xl md:text-4xl">{STORE_NAME}</h3>
      <p className="mt-2 max-w-2xl text-sm text-mist">{IN_STORE_POLICY}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CUSTOMER_JOURNEY.map((step) => (
          <div
            key={step.n}
            className="rounded-2xl border border-white/10 bg-black/35 p-4"
          >
            <p className="text-xs tracking-[0.2em] text-red">{step.n}</p>
            <p className="mt-1 font-semibold text-chalk">{step.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-mist">{step.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
