"use client";

import Image from "next/image";
import { useEffect } from "react";

/** Simple click-to-open detail modal — description placeholder for now. */
export function ComingSoonModal({
  open,
  onClose,
  title,
  image,
  kind = "details",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  image?: string;
  kind?: "coach" | "deal" | "details";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const label =
    kind === "coach"
      ? "Coach bio"
      : kind === "deal"
        ? "Deal details"
        : "Details";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="fade-up w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-black/95 shadow-[0_30px_80px_rgba(0,0,0,0.65)]"
        onClick={(e) => e.stopPropagation()}
      >
        {image ? (
          <div className="logo-box relative mx-auto mt-6 h-48 w-full max-w-[220px]">
            <span className="relative block h-full w-full">
              <Image
                src={image}
                alt={title}
                fill
                className="img-clean"
                sizes="220px"
                unoptimized
              />
            </span>
          </div>
        ) : null}
        <div className="space-y-3 p-6 text-center md:p-8">
          <p className="text-xs tracking-[0.22em] text-red uppercase">{label}</p>
          <h3 className="display text-3xl text-white md:text-4xl">{title}</h3>
          <p className="text-lg font-semibold text-chalk">Coming soon</p>
          <p className="text-sm text-mist">
            Full description will be added here. Check back soon.
          </p>
          <button type="button" className="btn btn-primary mt-2" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
