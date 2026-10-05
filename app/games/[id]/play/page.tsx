import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGameById } from "@/lib/data/games";
import { GamePlayer } from "@/components/player/GamePlayer";

export async function generateMetadata(props: PageProps<"/games/[id]/play">): Promise<Metadata> {
  const { id } = await props.params;
  const game = await getGameById(id);
  return { title: game ? `Arcade Vault — Jugando ${game.title}` : "Arcade Vault — Juego no encontrado" };
}

export default async function GamePlayPage(props: PageProps<"/games/[id]/play">) {
  const { id } = await props.params;
  const game = await getGameById(id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
