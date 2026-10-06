import { createAsteroidsGame } from "./asteroids/engine";
import { createArkanoidGame } from "./arkanoid/engine";
import { createTetrisGame } from "./tetris/engine";
import type { GameEngineFactory } from "./types";

// Games listed here run a real engine in the player; the rest keep the mock arena.
export const GAME_ENGINES: Readonly<Record<string, GameEngineFactory | undefined>> = {
  rocas: createAsteroidsGame,
  tetris: createTetrisGame,
  arkanoid: createArkanoidGame,
};
