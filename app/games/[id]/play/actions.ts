"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { toPlayerName } from "@/lib/games";

export type SaveScoreResult = "saved" | "name-taken" | "error";

const saveScoreSchema = z.object({
  gameId: z.string().min(1),
  score: z.number().int().min(1).max(99_999_999),
  playerName: z.string(),
});

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function findUsername(supabase: Supabase, column: "id" | "username", value: string) {
  const { data, error } = await supabase.from("profiles").select("username").eq(column, value).maybeSingle();
  if (error) throw error;
  return data?.username ?? null;
}

// Logged in: the row is signed with the uid and the profile username (RLS enforces both).
async function savePlayerScore(
  supabase: Supabase,
  userId: string,
  gameId: string,
  score: number,
): Promise<SaveScoreResult> {
  const username = await findUsername(supabase, "id", userId);
  if (!username) return "error";
  const { error } = await supabase
    .from("scores")
    .insert({ game_id: gameId, player_name: username, score, user_id: userId });
  return error ? "error" : "saved";
}

// Guest: free name, unless it belongs to a registered player (RLS enforces it too).
async function saveGuestScore(
  supabase: Supabase,
  playerName: string,
  gameId: string,
  score: number,
): Promise<SaveScoreResult> {
  const name = toPlayerName(playerName);
  if (!name) return "error";
  if (await findUsername(supabase, "username", name)) return "name-taken";
  const { error } = await supabase.from("scores").insert({ game_id: gameId, player_name: name, score });
  return error ? "error" : "saved";
}

export async function saveScore(input: {
  gameId: string;
  score: number;
  playerName: string;
}): Promise<SaveScoreResult> {
  const parsed = saveScoreSchema.safeParse(input);
  if (!parsed.success) return "error";
  const { gameId, score, playerName } = parsed.data;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims.sub;
    return userId
      ? await savePlayerScore(supabase, userId, gameId, score)
      : await saveGuestScore(supabase, playerName, gameId, score);
  } catch {
    return "error";
  }
}
