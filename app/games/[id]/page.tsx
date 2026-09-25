import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GAMES, seededScores } from "@/lib/games";
import { GameDetail } from "@/components/detail/GameDetail";

export async function generateMetadata(props: PageProps<"/games/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const game = GAMES.find((g) => g.id === id);
  return { title: game ? `Arcade Vault — ${game.title}` : "Arcade Vault — Juego no encontrado" };
}

export default async function GameDetailPage(props: PageProps<"/games/[id]">) {
  const { id } = await props.params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  const scores = seededScores(id.length * 17 + 3, 10);

  return <GameDetail game={game} scores={scores} />;
}
