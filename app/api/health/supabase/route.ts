import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const HEALTH_ERROR = "No se pudo conectar con Supabase";

function failure() {
  return NextResponse.json({ ok: false, error: HEALTH_ERROR }, { status: 500 });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getSession();

    if (error) return failure();

    return NextResponse.json({ ok: true });
  } catch {
    return failure();
  }
}
