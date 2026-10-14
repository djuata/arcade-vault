import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Auth } from "@/components/auth/Auth";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Arcade Vault — Iniciar sesión",
};

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/games");
  return <Auth />;
}
