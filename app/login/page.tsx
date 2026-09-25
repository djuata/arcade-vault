import type { Metadata } from "next";
import { Auth } from "@/components/auth/Auth";

export const metadata: Metadata = {
  title: "Arcade Vault — Iniciar sesión",
};

export default function LoginPage() {
  return <Auth />;
}
