import { createAsteroidsGame } from "./asteroids/engine";
import { createArkanoidGame } from "./arkanoid/engine";
import { createSnakeGame } from "./snake/engine";
import { SNAKE_SKINS } from "./snake/skins";
import { createTetrisGame } from "./tetris/engine";
import type { GameEngineFactory } from "./types";

// Games listed here run a real engine in the player; the rest keep the mock arena.
export const GAME_ENGINES: Readonly<Record<string, GameEngineFactory | undefined>> = {
  rocas: createAsteroidsGame,
  tetris: createTetrisGame,
  arkanoid: createArkanoidGame,
  snake: createSnakeGame,
};

// Slug → available skin ids, `classic` first. Games without an entry have no skins.
export const GAME_SKINS: Readonly<Record<string, readonly string[] | undefined>> = {
  snake: Object.keys(SNAKE_SKINS),
};
