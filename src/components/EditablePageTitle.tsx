"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EditableText } from "@/components/Editable";

export function EditablePageTitle({
  page,
  slot,
  initial,
  as = "h1",
  className = "",
}: {
  page: string;
  slot: string;
  initial: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
}) {
  const [text, setText] = useState(initial);
  const router = useRouter();

  return (
    <EditableText
      as={as}
      className={className}
      value={text}
      onSave={async (next) => {
        const res = await fetch("/api/texts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page, slot, text: next }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Save failed");
        setText(next);
        router.refresh();
      }}
    />
  );
}
