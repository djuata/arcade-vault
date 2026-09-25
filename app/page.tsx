import type { Metadata } from "next";
import { Library } from "@/components/library/Library";

export const metadata: Metadata = {
  title: "Arcade Vault — Biblioteca",
};

export default function Home() {
  return <Library />;
}
