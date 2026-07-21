"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddItemButton, EditableText, ItemControls } from "@/components/Editable";
import type { Coach } from "@/lib/types";

export function EditableCoaches({ initial }: { initial: Coach[] }) {
  const [coaches, setCoaches] = useState(initial);
  const router = useRouter();

  async function rename(id: string, name: string) {
    const res = await fetch(`/api/coaches/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Rename failed");
    setCoaches((prev) => prev.map((c) => (c.id === id ? data.coach : c)));
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this coach?")) return;
    const res = await fetch(`/api/coaches/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setCoaches((prev) => prev.filter((c) => c.id !== id));
    router.refresh();
  }

  async function addCoach() {
    const name = prompt("Coach name?");
    if (!name?.trim()) return;
    const res = await fetch("/api/coaches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        image: "/images/logo.png",
        email: "",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Add failed");
      return;
    }
    setCoaches((prev) => [...prev, data.coach]);
    router.refresh();
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {coaches.map((coach) => (
          <article
            key={coach.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
          >
            <div className="relative aspect-[3/4]">
              <Image src={coach.image} alt={coach.name} fill className="object-cover" />
            </div>
            <div className="p-3 text-center">
              <EditableText
                as="p"
                className="text-sm font-semibold"
                value={coach.name}
                onSave={(name) => rename(coach.id, name)}
              />
              <ItemControls onRemove={() => remove(coach.id)} />
            </div>
          </article>
        ))}
      </div>
      <AddItemButton onAdd={addCoach} label="Add coach" />
    </div>
  );
}
