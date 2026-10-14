import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { SESSION_COOKIE_OPTIONS } from "./session-cookies";
import { hasProfile } from "@/lib/auth/profiles";

const CHOOSE_USERNAME_PATH = "/login/nombre";

// The mandatory name screen, the OAuth callback and APIs never redirect (spec 20, D3).
function isExemptFromProfileGate(pathname: string): boolean {
  return (
    pathname === CHOOSE_USERNAME_PATH ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/")
  );
}

// Keeps the refreshed session cookies on the redirect, or the next request loses them.
function redirectWithCookies(request: NextRequest, response: NextResponse, pathname: string) {
  const redirect = NextResponse.redirect(new URL(pathname, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

// Refreshes the auth token and writes the new cookies on both the request
// (for Server Components in this render) and the response (for the browser).
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });

  if (!url || !key) return response;

  const supabase = createServerClient<Database>(url, key, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Don't run code between createServerClient and getClaims: it validates and refreshes the token.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  // A session without a profile (new OAuth player) must pick a name first (spec 20, D2).
  if (userId && !isExemptFromProfileGate(request.nextUrl.pathname)) {
    const profileExists = await hasProfile(supabase, userId).catch(() => true);
    if (!profileExists) return redirectWithCookies(request, response, CHOOSE_USERNAME_PATH);
  }

  return response;
}
