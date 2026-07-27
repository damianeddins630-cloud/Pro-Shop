"use client";

import { useEffect, useState } from "react";
import { useEditMode } from "@/lib/edit-mode";

type EditableTextProps = {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  as?: "h1" | "h2" | "h3" | "p" | "span" | "strong";
  className?: string;
  /** Use a textarea so longer page copy can be edited */
  multiline?: boolean;
  rows?: number;
  /** Optional label shown in edit mode so long paragraphs are obvious */
  editLabel?: string;
};

export function EditableText({
  value,
  onSave,
  as = "span",
  className = "",
  multiline = false,
  rows = 4,
  editLabel,
}: EditableTextProps) {
  const { editMode: editing } = useEditMode();
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const Tag = as;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function commit() {
    const next = draft.trim();
    if (!next || next === value) {
      setDraft(value);
      setError("");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setDraft(value);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return <Tag className={className}>{value}</Tag>;
  }

  return (
    <span className="relative my-1 block rounded-xl border border-dashed border-red/70 bg-black/40 p-2 shadow-[0_0_0_1px_rgba(225,6,0,0.25)]">
      {editLabel && (
        <span className="mb-1 block text-[11px] font-bold tracking-[0.16em] text-red uppercase">
          Edit · {editLabel}
        </span>
      )}
      {multiline ? (
        <textarea
          className={`field min-h-[6rem] !border-red/40 ${className}`}
          value={draft}
          rows={rows}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
        />
      ) : (
        <input
          className={`field !border-red/40 !py-2 ${className}`}
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
      )}
      <span className="mt-1 block text-[11px] tracking-wide text-red/90 uppercase">
        {saving
          ? "Saving…"
          : error
            ? error
            : "Change this text, then click away to save"}
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
