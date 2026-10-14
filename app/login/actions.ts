"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema, type SignUpField } from "@/lib/auth/schemas";
import { AUTH_MESSAGES } from "@/lib/auth/messages";

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

async function isUsernameTaken(username: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
  if (error) throw error;
  return data !== null;
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
  try {
    if (await isUsernameTaken(username)) return { error: AUTH_MESSAGES.usernameTaken };
  } catch {
    return { error: AUTH_MESSAGES.generic };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
  if (error) return { error: signUpErrorMessage(error) };
  redirect("/games");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
