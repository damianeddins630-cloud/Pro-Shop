"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddItemButton, EditableText, ItemControls } from "@/components/Editable";
import { ComingSoonModal } from "@/components/ComingSoonModal";
import { useEditMode } from "@/lib/edit-mode";
import type { Coach } from "@/lib/types";

export function EditableCoaches({ initial }: { initial: Coach[] }) {
  const [coaches, setCoaches] = useState(initial);
  const [active, setActive] = useState<Coach | null>(null);
  const { editMode } = useEditMode();
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
            className="overflow-hidden rounded-2xl border border-white/15"
          >
            <button
              type="button"
              className="group w-full text-left"
              onClick={() => {
                if (!editMode) setActive(coach);
              }}
            >
              <div className="media-box relative aspect-[3/4] overflow-hidden">
                <Image
                  src={coach.image}
                  alt={coach.name}
                  fill
                  className="img-clean p-2 transition duration-500 group-hover:scale-[1.02]"
                  sizes="(max-width:768px) 50vw, 25vw"
                  unoptimized
                />
              </div>
              <div className="p-3 text-center">
                <EditableText
                  as="p"
                  className="text-sm font-semibold"
                  value={coach.name}
                  onSave={(name) => rename(coach.id, name)}
                />
                {!editMode ? (
                  <p className="mt-1 text-xs text-mist">Tap for details</p>
                ) : null}
              </div>
            </button>
            <div className="px-3 pb-3 text-center">
              <ItemControls onRemove={() => remove(coach.id)} />
            </div>
          </article>
        ))}
      </div>
      <AddItemButton onAdd={addCoach} label="Add coach" />
      <ComingSoonModal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.name || "Coach"}
        image={active?.image}
        kind="coach"
      />
    </div>
  );
}
