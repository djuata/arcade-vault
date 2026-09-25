"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

export interface Session {
  name: string;
}

interface SessionContextValue {
  user: Session | null;
  login: (u: Session | null) => void;
  logout: () => void;
}

const STORAGE_KEY = "av_user";
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function parseUser(raw: string | null): Session | null {
  try {
    return raw ? (JSON.parse(raw) as Session | null) : null;
  } catch {
    return null;
  }
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const user = parseUser(raw);

  const login = (u: Session | null) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } catch {
      // localStorage disabled (private mode) — session simply doesn't persist.
    }
    notify();
  };

  const logout = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage disabled (private mode) — session simply doesn't persist.
    }
    notify();
  };

  return <SessionContext.Provider value={{ user, login, logout }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
