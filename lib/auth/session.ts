import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/session-context";

// Current player for this request (layout + pages share one lookup).
// Any failure degrades to "no session": the site stays usable as a guest.
export const getSessionUser = cache(async (): Promise<Session | null> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const id = data?.claims.sub;
    if (!id) return null;

    const { data: profile } = await supabase.from("profiles").select("username").eq("id", id).maybeSingle();
    return profile ? { id, name: profile.username } : null;
  } catch {
    return null;
  }
});
