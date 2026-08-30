"use client";

import Image from "next/image";
import { useEffect } from "react";

/** Click-to-open detail modal — large flyer mode for readable deals. */
export function ComingSoonModal({
  open,
  onClose,
  title,
  image,
  kind = "details",
  largeImage = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  image?: string;
  kind?: "coach" | "deal" | "details";
  /** Show flyer nearly full-screen so text/prices are readable */
  largeImage?: boolean;
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

  /* Large flyer lightbox — prioritize readable image */
  if (largeImage && image) {
    return (
      <div
        className="fixed inset-0 z-[120] flex flex-col bg-black/92 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={onClose}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/80 px-4 py-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.2em] text-red uppercase">{label}</p>
            <h3 className="truncate text-lg font-bold text-white md:text-xl">{title}</h3>
          </div>
          <button type="button" className="btn btn-secondary shrink-0" onClick={onClose}>
            Close
          </button>
        </div>
        <div
          className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-3 sm:p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="logo-box relative w-full max-w-6xl overflow-hidden rounded-xl shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={title}
              className="img-clean mx-auto block h-auto w-full"
            />
          </div>
        </div>
        <p className="shrink-0 px-4 py-3 text-center text-sm text-mist">
          Full description coming soon — scroll the flyer to read all details.
        </p>
      </div>
    );
  }

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
