"use client";

import { useEffect, useState } from "react";
import { useEditMode } from "@/lib/edit-mode";

type EditableTextProps = {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  /** Use a textarea so longer page copy can be edited */
  multiline?: boolean;
  rows?: number;
};

export function EditableText({
  value,
  onSave,
  as = "span",
  className = "",
  multiline = false,
  rows = 4,
}: EditableTextProps) {
  const { editMode: editing } = useEditMode();
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const Tag = as;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function commit() {
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
  }

  if (!editing) {
    return <Tag className={className}>{value}</Tag>;
  }

  if (multiline) {
    return (
      <span className="relative block">
        <textarea
          className={`field min-h-[6rem] ${className}`}
          value={draft}
          rows={rows}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
        />
        <span className="mt-1 block text-[11px] tracking-wide text-red/80 uppercase">
          {saving ? "Saving…" : "Edit text — click away to save"}
        </span>
      </span>
    );
  }

  return (
    <span className="relative block">
      <input
        className={`field !py-2 ${className}`}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <span className="mt-1 block text-[11px] tracking-wide text-red/80 uppercase">
        {saving ? "Saving…" : "Edit text — Enter or click away to save"}
      </span>
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
