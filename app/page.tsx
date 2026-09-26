import type { Metadata } from "next";
import { Home } from "@/components/home/Home";

export const metadata: Metadata = {
  title: "Arcade Vault",
};

export default function HomePage() {
  return <Home />;
}
