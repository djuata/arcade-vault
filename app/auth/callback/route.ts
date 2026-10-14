import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasProfile } from "@/lib/auth/profiles";

// OAuth return point (spec 20). The provider's own `error` param, a missing
// code or a failed exchange all end on the same generic message in /login.
async function resolveDestination(code: string | null): Promise<string> {
  if (!code) return "/login?error=oauth";

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return "/login?error=oauth";
    return (await hasProfile(supabase, data.user.id)) ? "/games" : "/login/nombre";
  } catch {
    return "/login?error=oauth";
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = await resolveDestination(code);
  return NextResponse.redirect(new URL(destination, request.nextUrl.origin));
}
