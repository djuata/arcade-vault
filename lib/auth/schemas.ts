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

// Same rule as the dashboard's "Password requirements" (spec 21). Symbols are
// Supabase's exact list, so "ñ" or a space does not count as a symbol.
export const PASSWORD_SYMBOLS = /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/;
export const passwordSchema = z
  .string()
  .min(8)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(PASSWORD_SYMBOLS);

// signInSchema keeps z.string().min(8): existing passwords must still sign in.
export const signUpSchema = signInSchema.extend({ username: usernameSchema, password: passwordSchema });

export type SignUpField = keyof z.infer<typeof signUpSchema>;

// Providers enabled in the Supabase dashboard (spec 20).
export const oauthProviderSchema = z.enum(["google", "github"]);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;
