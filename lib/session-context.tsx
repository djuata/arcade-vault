"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { signOut } from "@/app/login/actions";

export interface Session {
  id: string; // auth.users.id = profiles.id
  name: string; // profiles.username (already uppercase, 3–10)
}

interface SessionContextValue {
  user: Session | null;
  logout: () => Promise<void>;
}

// Key of the pre-spec-19 mock session.
const LEGACY_STORAGE_KEY = "av_user";

const SessionContext = createContext<SessionContextValue | null>(null);

async function logout() {
  try {
    await signOut();
  } finally {
    // Full navigation on purpose (spec 19, D13): router.push would keep the
    // in-memory React tree, and logout must drop every trace of the session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }
}

// `user` comes from the server on every render (app/layout.tsx). Cookies are
// HttpOnly, so the browser never reads the session itself (spec 19, D17).
export function SessionProvider({ user, children }: { user: Session | null; children: ReactNode }) {
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // localStorage disabled (private mode) — nothing to clean.
    }
  }, []);

  return <SessionContext.Provider value={{ user, logout }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
