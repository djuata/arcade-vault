"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usernameSchema } from "@/lib/auth/schemas";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { hasProfile, isUsernameTaken } from "@/lib/auth/profiles";
import type { AuthFormState } from "@/app/login/actions";

const UNIQUE_VIOLATION = "23505";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function nameStatus(supabase: Supabase, userId: string, username: string) {
  if (await hasProfile(supabase, userId)) return "has-profile" as const;
  return (await isUsernameTaken(supabase, username)) ? ("taken" as const) : ("free" as const);
}

// Creates the profile of a signed-in player who has none yet (OAuth, spec 20).
// RLS lets `authenticated` insert only its own row, once.
export async function chooseUsername(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");

  const parsed = usernameSchema.safeParse(String(formData.get("username") ?? ""));
  if (!parsed.success) return { error: AUTH_MESSAGES.invalidUsername };
  const username = parsed.data;

  const status = await nameStatus(supabase, userId, username).catch(() => "error" as const);
  if (status === "error") return { error: AUTH_MESSAGES.generic };
  if (status === "has-profile") redirect("/games");
  if (status === "taken") return { error: AUTH_MESSAGES.usernameTaken };

  const { error } = await supabase.from("profiles").insert({ id: userId, username });
  if (error) {
    // Someone took the name between the pre-check and the insert.
    return { error: error.code === UNIQUE_VIOLATION ? AUTH_MESSAGES.usernameTaken : AUTH_MESSAGES.generic };
  }
  // No cookie changes here, so Next would keep the client's root layout (user = null).
  // Invalidate it so the Nav and the score modal get the new username.
  revalidatePath("/", "layout");
  redirect("/games");
}
