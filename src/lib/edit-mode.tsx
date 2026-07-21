"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { Permission, PublicUser } from "@/lib/types";

type EditModeContextValue = {
  user: PublicUser | null;
  loading: boolean;
  editMode: boolean;
  setEditMode: (value: boolean) => void;
  canEdit: boolean;
  can: (permission: Permission) => boolean;
  refreshUser: () => Promise<void>;
};

const EditModeContext = createContext<EditModeContextValue | null>(null);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser, pathname]);

  const can = useCallback(
    (permission: Permission) => Boolean(user?.permissions?.includes(permission)),
    [user],
  );

  const canEdit = can("edit_pages");

  useEffect(() => {
    if (!canEdit) setEditMode(false);
  }, [canEdit]);

  const value = useMemo(
    () => ({
      user,
      loading,
      editMode: canEdit && editMode,
      setEditMode,
      canEdit,
      can,
      refreshUser,
    }),
    [user, loading, editMode, canEdit, can, refreshUser],
  );

  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>;
}

export function useEditMode() {
  const ctx = useContext(EditModeContext);
  if (!ctx) throw new Error("useEditMode must be used within EditModeProvider");
  return ctx;
}
