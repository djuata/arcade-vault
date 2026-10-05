import type { Metadata } from "next";
import { Library } from "@/components/library/Library";
import { getGames } from "@/lib/data/games";

export const metadata: Metadata = {
  title: "Arcade Vault — Biblioteca",
};

export default async function GamesPage() {
  const games = await getGames();

  return <Library games={games} />;
}
