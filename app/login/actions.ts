"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { oauthProviderSchema, signInSchema, signUpSchema, type SignUpField } from "@/lib/auth/schemas";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { isUsernameTaken } from "@/lib/auth/profiles";

export type AuthFormState = { error: string | null };

const FIELD_MESSAGES: Record<SignUpField, string> = {
  username: AUTH_MESSAGES.invalidUsername,
  password: AUTH_MESSAGES.passwordTooShort,
  email: AUTH_MESSAGES.generic,
};

function readForm(formData: FormData) {
  return {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    username: String(formData.get("username") ?? ""),
  };
}

function signUpErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "email_exists":
    case "user_already_exists":
      return AUTH_MESSAGES.emailTaken;
    case "weak_password":
      return AUTH_MESSAGES.passwordTooShort;
    // The profiles trigger aborted the sign-up: the username was taken in between.
    case "unexpected_failure":
      return AUTH_MESSAGES.usernameTaken;
    default:
      return AUTH_MESSAGES.generic;
  }
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: AUTH_MESSAGES.invalidCredentials };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.code === "invalid_credentials" ? AUTH_MESSAGES.invalidCredentials : AUTH_MESSAGES.generic };
  }
  redirect("/games");
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0] as SignUpField | undefined;
    return { error: field ? FIELD_MESSAGES[field] : AUTH_MESSAGES.generic };
  }

  const { email, password, username } = parsed.data;
  const supabase = await createClient();
  try {
    if (await isUsernameTaken(supabase, username)) return { error: AUTH_MESSAGES.usernameTaken };
  } catch {
    return { error: AUTH_MESSAGES.generic };
  }

  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
  if (error) return { error: signUpErrorMessage(error) };
  // An email that already belongs to an account (e.g. a Google/GitHub one) comes back as a
  // fake user with no identities and no session, not as an error (anti-enumeration).
  if (data.user?.identities?.length === 0) return { error: AUTH_MESSAGES.emailTaken };
  // Email confirmation is off, so a real sign-up always opens a session.
  if (!data.session) return { error: AUTH_MESSAGES.generic };
  redirect("/games");
}

const OAUTH_ERROR_URL = "/login?error=oauth";

// Starts the PKCE flow on the server: the code verifier lands in an HttpOnly
// cookie that only /auth/callback reads (spec 20, D10). Supabase rejects any
// redirectTo outside its allow list, so the request origin is safe to use (D11).
export async function signInWithOAuth(formData: FormData): Promise<void> {
  const provider = oauthProviderSchema.safeParse(formData.get("provider"));
  const origin = (await headers()).get("origin");
  if (!provider.success || !origin) redirect(OAUTH_ERROR_URL);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider.data,
    options: { redirectTo: `${origin}/auth/callback` },
  });
  redirect(error || !data.url ? OAUTH_ERROR_URL : data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
