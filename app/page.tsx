import type { Metadata } from "next";
import { Home } from "@/components/home/Home";
import { getGames } from "@/lib/data/games";

export const metadata: Metadata = {
  title: "Arcade Vault",
};

export default async function HomePage() {
  const games = await getGames();

  return <Home games={games} />;
}
