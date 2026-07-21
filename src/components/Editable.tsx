"use client";

import { useState } from "react";
import { useEditMode } from "@/lib/edit-mode";

type EditableTextProps = {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
};

export function EditableText({
  value,
  onSave,
  as = "span",
  className = "",
}: EditableTextProps) {
  const { editMode: editing } = useEditMode();
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [activeValue, setActiveValue] = useState(value);
  const Tag = as;

  if (value !== activeValue) {
    setActiveValue(value);
    setDraft(value);
  }

  if (!editing) {
    return <Tag className={className}>{value}</Tag>;
  }

  return (
    <span className="relative block">
      <input
        className={`field !py-2 ${className}`}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={async () => {
          const next = draft.trim();
          if (!next || next === value) {
            setDraft(value);
            return;
          }
          setSaving(true);
          try {
            await onSave(next);
          } finally {
            setSaving(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </span>
  );
}

type ItemControlsProps = {
  onAdd?: () => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  addLabel?: string;
};

export function ItemControls({ onAdd, onRemove, addLabel = "Add" }: ItemControlsProps) {
  const { editMode: editing } = useEditMode();
  if (!editing) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {onAdd && (
        <button
          type="button"
          onClick={() => onAdd()}
          className="grid h-8 w-8 place-items-center rounded-full bg-red text-lg font-bold text-white"
          aria-label={addLabel}
          title={addLabel}
        >
          +
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove()}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/30 bg-black text-lg font-bold text-white"
          aria-label="Remove"
          title="Remove"
        >
          −
        </button>
      )}
    </div>
  );
}

export function AddItemButton({
  onAdd,
  label = "Add item",
}: {
  onAdd: () => void | Promise<void>;
  label?: string;
}) {
  const { editMode: editing } = useEditMode();
  if (!editing) return null;
  return (
    <button type="button" onClick={() => onAdd()} className="btn btn-primary mt-4 gap-2">
      <span className="text-xl leading-none">+</span> {label}
    </button>
  );
}
