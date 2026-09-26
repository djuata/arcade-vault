import type { Metadata } from "next";
import { HallOfFame } from "@/components/hall-of-fame/HallOfFame";

export const metadata: Metadata = {
  title: "Arcade Vault — Salón de la Fama",
};

export default function HallOfFamePage() {
  return <HallOfFame />;
}
