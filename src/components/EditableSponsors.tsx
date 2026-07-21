"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddItemButton, EditableText, ItemControls } from "@/components/Editable";
import type { Sponsor } from "@/lib/types";

export function EditableSponsors({ initial }: { initial: Sponsor[] }) {
  const [sponsors, setSponsors] = useState(initial);
  const router = useRouter();

  async function rename(id: string, name: string) {
    const res = await fetch(`/api/sponsors/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Rename failed");
    setSponsors((prev) => prev.map((s) => (s.id === id ? data.sponsor : s)));
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this sponsor?")) return;
    const res = await fetch(`/api/sponsors/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setSponsors((prev) => prev.filter((s) => s.id !== id));
    router.refresh();
  }

  async function addSponsor() {
    const name = prompt("Sponsor name?");
    if (!name?.trim()) return;
    const res = await fetch("/api/sponsors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        image: "/images/logo.png",
        url: "#",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Add failed");
      return;
    }
    setSponsors((prev) => [...prev, data.sponsor]);
    router.refresh();
  }

  return (
    <div>
      <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {sponsors.map((sponsor) => (
          <div
            key={sponsor.id}
            className="group flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-red/40"
          >
            <a
              href={sponsor.url || "#"}
              target={sponsor.url?.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="relative mb-4 h-28 w-full"
            >
              <Image src={sponsor.image} alt={sponsor.name} fill className="object-contain" />
            </a>
            <EditableText
              as="span"
              className="text-center text-sm font-semibold text-chalk"
              value={sponsor.name}
              onSave={(name) => rename(sponsor.id, name)}
            />
            <ItemControls onRemove={() => remove(sponsor.id)} />
          </div>
        ))}
      </div>
      <AddItemButton onAdd={addSponsor} label="Add sponsor" />
    </div>
  );
}
