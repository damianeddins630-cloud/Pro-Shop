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
import type { PublicUser } from "@/lib/types";

type EditModeContextValue = {
  user: PublicUser | null;
  isAdmin: boolean;
  editing: boolean;
  setEditing: (value: boolean) => void;
  toggleEditing: () => void;
  refreshUser: () => Promise<void>;
};

const EditModeContext = createContext<EditModeContextValue | null>(null);

async function fetchMe(): Promise<PublicUser | null> {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    return (data.user as PublicUser) || null;
  } catch {
    return null;
  }
}

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [editing, setEditingState] = useState(false);

  const refreshUser = useCallback(async () => {
    const next = await fetchMe();
    setUser(next);
    if (!next || next.role !== "admin") setEditingState(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((next) => {
      if (cancelled) return;
      setUser(next);
      if (!next || next.role !== "admin") setEditingState(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAdmin: user?.role === "admin",
      editing: Boolean(user?.role === "admin" && editing),
      setEditing: (v: boolean) => {
        if (user?.role === "admin") setEditingState(v);
      },
      toggleEditing: () => {
        if (user?.role === "admin") setEditingState((e) => !e);
      },
      refreshUser,
    }),
    [user, editing, refreshUser]
  );

  return (
    <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>
  );
}

export function useEditMode() {
  const ctx = useContext(EditModeContext);
  if (!ctx) throw new Error("useEditMode must be used within EditModeProvider");
  return ctx;
}
