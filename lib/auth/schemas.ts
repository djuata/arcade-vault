import { z } from "zod";

// Same rule as the `profiles.username` CHECK (spec 19).
export const USERNAME_PATTERN = /^[A-Z0-9_]{3,10}$/;
export const RESERVED_USERNAME = "INVITADO";

export const usernameSchema = z
  .string()
  .transform((v) => v.trim().toUpperCase())
  .pipe(z.string().regex(USERNAME_PATTERN).refine((v) => v !== RESERVED_USERNAME));

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const signUpSchema = signInSchema.extend({ username: usernameSchema });

export type SignUpField = keyof z.infer<typeof signUpSchema>;

// Providers enabled in the Supabase dashboard (spec 20).
export const oauthProviderSchema = z.enum(["google", "github"]);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;
