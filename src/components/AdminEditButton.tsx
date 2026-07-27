"use client";

import { useEditMode } from "@/lib/edit-mode";

export function AdminEditButton() {
  const { canEdit, editMode, setEditMode } = useEditMode();
  if (!canEdit) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-2">
      {editMode && (
        <p className="max-w-[240px] rounded-2xl border border-red/40 bg-black/90 px-3 py-2 text-xs text-mist shadow-lg">
          Edit mode on — click any page text to change it. Longer copy uses a text box.
          Click away to save.
        </p>
      )}
      <button
        type="button"
        onClick={() => setEditMode(!editMode)}
        className={`rounded-full px-5 py-3 text-sm font-bold shadow-xl transition ${
          editMode ? "bg-white text-black" : "bg-red text-white hover:bg-red-deep"
        }`}
      >
        {editMode ? "Done editing" : "Edit all text"}
      </button>
    </div>
  );
}
