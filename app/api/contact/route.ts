import { NextResponse } from "next/server";
import { ContactFormSchema } from "@/lib/contact";
import { resend } from "@/lib/resend";

const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL as string;
const CONTACT_FROM_EMAIL =
  process.env.CONTACT_FROM_EMAIL ?? "Arcade Vault <onboarding@resend.dev>";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { company, ...fields } = body;

    if (typeof company === "string" && company.length > 0) {
      return NextResponse.json({ ok: true });
    }

    const parsed = ContactFormSchema.safeParse(fields);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, message } = parsed.data;

    const { error } = await resend.emails.send({
      from: CONTACT_FROM_EMAIL,
      to: [CONTACT_TO_EMAIL],
      replyTo: email,
      subject: `Nuevo mensaje de contacto de ${name}`,
      text: message,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "No se pudo enviar el mensaje" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar el mensaje" },
      { status: 500 }
    );
  }
}
