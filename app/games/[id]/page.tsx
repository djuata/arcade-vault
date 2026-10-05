import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGameById } from "@/lib/data/games";
import { getTopScores } from "@/lib/data/scores";
import { GameDetail } from "@/components/detail/GameDetail";

export async function generateMetadata(props: PageProps<"/games/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const game = await getGameById(id);
  return { title: game ? `Arcade Vault — ${game.title}` : "Arcade Vault — Juego no encontrado" };
}

export default async function GameDetailPage(props: PageProps<"/games/[id]">) {
  const { id } = await props.params;
  const game = await getGameById(id);
  if (!game) notFound();

  const scores = await getTopScores(id, 10);

  return <GameDetail game={game} scores={scores} />;
}
