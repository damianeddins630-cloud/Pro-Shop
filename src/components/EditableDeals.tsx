"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddItemButton, EditableText, ItemControls } from "@/components/Editable";
import { ComingSoonModal } from "@/components/ComingSoonModal";
import { useEditMode } from "@/lib/edit-mode";
import type { Deal } from "@/lib/types";

export function EditableDeals({ initial }: { initial: Deal[] }) {
  const [deals, setDeals] = useState(initial);
  const [active, setActive] = useState<Deal | null>(null);
  const { editMode } = useEditMode();
  const router = useRouter();

  async function rename(id: string, title: string) {
    const res = await fetch(`/api/deals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Rename failed");
    setDeals((prev) => prev.map((d) => (d.id === id ? data.deal : d)));
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this deal?")) return;
    const res = await fetch(`/api/deals/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setDeals((prev) => prev.filter((d) => d.id !== id));
    router.refresh();
  }

  async function addDeal() {
    const title = prompt("Deal title?");
    if (!title?.trim()) return;
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: "New deal / special",
        image: "/images/deals/combo-special.png",
        active: true,
        featured: false,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Add failed");
      return;
    }
    setDeals((prev) => [data.deal, ...prev]);
    router.refresh();
  }

  return (
    <div className="grid gap-10">
      {deals.map((deal) => (
        <article
          key={deal.id}
          className="overflow-hidden rounded-[2rem] border border-white/15"
        >
          <button
            type="button"
            className="media-box mx-auto block w-full max-w-[600px] p-2 text-left sm:p-3"
            onClick={() => {
              if (!editMode) setActive(deal);
            }}
            aria-label={`Open ${deal.title} flyer larger`}
          >
            {/* ~50% of prior full-bleed width; tap to enlarge for full reading */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={deal.image}
              alt={deal.title}
              className="img-clean mx-auto block h-auto w-full"
              loading="eager"
            />
          </button>

          <div className="flex flex-col items-start justify-center gap-3 border-t border-white/10 bg-black/40 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-8">
            <div>
              {deal.featured && (
                <span className="mb-2 inline-flex w-fit rounded-full bg-red/15 px-3 py-1 text-xs tracking-[0.16em] text-red uppercase">
                  Deal of the Month
                </span>
              )}
              <EditableText
                as="h2"
                className="display text-3xl md:text-4xl"
                value={deal.title}
                onSave={(title) => rename(deal.id, title)}
              />
              <p className="mt-2 text-sm text-mist">
                {editMode
                  ? deal.description
                  : "Scroll the flyer to read prices — or tap to enlarge."}
              </p>
              <ItemControls onRemove={() => remove(deal.id)} />
            </div>
            {!editMode ? (
              <button
                type="button"
                className="btn btn-primary shrink-0"
                onClick={() => setActive(deal)}
              >
                Enlarge flyer
              </button>
            ) : null}
          </div>
        </article>
      ))}
      <AddItemButton onAdd={addDeal} label="Add deal" />
      <ComingSoonModal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.title || "Deal"}
        image={active?.image}
        kind="deal"
        largeImage
      />
    </div>
  );
}
