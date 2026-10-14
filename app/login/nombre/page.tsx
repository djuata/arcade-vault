import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChooseUsername } from "@/components/auth/ChooseUsername";
import { createClient } from "@/lib/supabase/server";
import { hasProfile, isUsernameTaken } from "@/lib/auth/profiles";
import { suggestUsername } from "@/lib/auth/username";

export const metadata: Metadata = {
  title: "Arcade Vault — Elige tu nombre",
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

// The suggestion is only offered if it's still free (spec 20, D7).
async function freeSuggestion(supabase: Supabase, metadata: Record<string, unknown>): Promise<string> {
  const suggestion = suggestUsername(metadata);
  if (!suggestion) return "";
  try {
    return (await isUsernameTaken(supabase, suggestion)) ? "" : suggestion;
  } catch {
    return "";
  }
}

// Mandatory for a session without a profile; proxy.ts sends every other route here (spec 20).
export default async function ChooseUsernamePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  if (await hasProfile(supabase, claims.sub).catch(() => false)) redirect("/games");

  const suggestion = await freeSuggestion(supabase, { ...claims.user_metadata, email: claims.email });
  return <ChooseUsername suggestion={suggestion} />;
}
