"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddItemButton, EditableText, ItemControls } from "@/components/Editable";
import type { Deal } from "@/lib/types";

export function EditableDeals({ initial }: { initial: Deal[] }) {
  const [deals, setDeals] = useState(initial);
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
    <div className="grid gap-8">
      {deals.map((deal) => (
        <article
          key={deal.id}
          className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] lg:grid-cols-2"
        >
          <div className="relative min-h-[320px]">
            <Image src={deal.image} alt={deal.title} fill className="object-cover" />
          </div>
          <div className="flex flex-col justify-center p-8 md:p-10">
            {deal.featured && (
              <span className="mb-3 w-fit rounded-full bg-red/15 px-3 py-1 text-xs tracking-[0.16em] text-red uppercase">
                Deal of the Month
              </span>
            )}
            <EditableText
              as="h2"
              className="display text-4xl"
              value={deal.title}
              onSave={(title) => rename(deal.id, title)}
            />
            <p className="mt-4 text-mist">{deal.description}</p>
            <ItemControls onRemove={() => remove(deal.id)} />
          </div>
        </article>
      ))}
      <AddItemButton onAdd={addDeal} label="Add deal" />
    </div>
  );
}
