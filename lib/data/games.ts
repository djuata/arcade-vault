import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { Game, GameAccent, GameCategory } from "@/lib/games";

type GameStatsRow = Database["public"]["Views"]["games_with_stats"]["Row"];

// The generator types every view column as nullable; the underlying
// `games` columns are NOT NULL, so the casts below are safe.
function toGame(row: GameStatsRow): Game {
  return {
    id: row.id as string,
    title: row.title as string,
    short: row.short as string,
    long: row.long as string,
    cat: row.cat as GameCategory,
    cover: row.cover as string,
    color: row.color as GameAccent,
    playable: row.playable ?? false,
    best: row.best_score ?? 0,
    plays: row.plays_count ?? 0,
  };
}

export const getGames = cache(async (): Promise<Game[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("games_with_stats").select("*").order("sort_order");

  if (error) throw new Error("No se pudieron cargar los juegos");
  return data.map(toGame);
});

export const getGameById = cache(async (id: string): Promise<Game | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("games_with_stats").select("*").eq("id", id).maybeSingle();

  if (error) throw new Error("No se pudo cargar el juego");
  return data ? toGame(data) : null;
});
