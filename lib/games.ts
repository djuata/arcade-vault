// ===== lib/games.ts — catalog types =====
// The catalog and the scores live in Supabase (tables `games` / `scores`).
// See lib/data/games.ts and lib/data/scores.ts for the readers.

export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameAccent = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string; // clase CSS, ej. "cover-bricks"
  color: GameAccent;
  playable: boolean; // true solo para juegos con motor real (puede guardar puntajes)
  best: number; // 0 si el juego no tiene puntajes
  plays: number; // cantidad de puntajes guardados
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/YYYY"
}

export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;

// Same shape the `scores.player_name` CHECK expects (1–10 chars) and the modal input produces.
export function toPlayerName(name: string): string {
  return name.trim().toUpperCase().slice(0, 10);
}

export function formatBest(best: number): string {
  return best > 0 ? best.toLocaleString("es-ES") : "—";
}
