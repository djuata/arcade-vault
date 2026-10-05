import type { Metadata } from "next";
import { HallOfFame } from "@/components/hall-of-fame/HallOfFame";
import { getGames } from "@/lib/data/games";
import { getTopScoresByGame } from "@/lib/data/scores";

export const metadata: Metadata = {
  title: "Arcade Vault — Salón de la Fama",
};

export default async function HallOfFamePage() {
  const [games, scoresByGame] = await Promise.all([getGames(), getTopScoresByGame(10)]);

  return <HallOfFame games={games} scoresByGame={scoresByGame} />;
}
