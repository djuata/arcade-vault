import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Profile lookups shared by the auth actions, the OAuth callback and the proxy.
// Plain module (not "use server"): these must never become callable actions.
type Supabase = SupabaseClient<Database>;

export async function isUsernameTaken(supabase: Supabase, username: string): Promise<boolean> {
  const { data, error } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function hasProfile(supabase: Supabase, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data !== null;
}
