import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ScoreRow } from "@/lib/games";

type RankedRow = Database["public"]["Views"]["scores_ranked"]["Row"];

const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function toScoreRow(row: RankedRow): ScoreRow {
  return {
    rank: row.rank ?? 0,
    name: row.player_name ?? "",
    score: row.score ?? 0,
    date: row.created_at ? DATE_FORMAT.format(new Date(row.created_at)) : "",
  };
}

export async function getTopScores(gameId: string, limit = 10): Promise<ScoreRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores_ranked")
    .select("*")
    .eq("game_id", gameId)
    .lte("rank", limit)
    .order("rank");

  if (error) throw new Error("No se pudieron cargar los puntajes");
  return data.map(toScoreRow);
}

export async function getTopScoresByGame(limit = 10): Promise<Record<string, ScoreRow[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores_ranked")
    .select("*")
    .lte("rank", limit)
    .order("game_id")
    .order("rank");

  if (error) throw new Error("No se pudieron cargar los puntajes");

  const byGame: Record<string, ScoreRow[]> = {};
  for (const row of data) {
    const gameId = row.game_id as string;
    (byGame[gameId] ??= []).push(toScoreRow(row));
  }
  return byGame;
}
