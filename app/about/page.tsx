import type { Metadata } from "next";
import { About } from "@/components/about/About";

export const metadata: Metadata = {
  title: "Arcade Vault — Acerca de",
};

export default function AboutPage() {
  return <About />;
}
