import { createAsteroidsGame } from "./asteroids/engine";
import { ASTEROIDS_TOUCH_CONTROLS } from "./asteroids/touch";
import { createArkanoidGame } from "./arkanoid/engine";
import { ARKANOID_TOUCH_CONTROLS } from "./arkanoid/touch";
import { createCroacGame } from "./croac/engine";
import { CROAC_TOUCH_CONTROLS } from "./croac/touch";
import { createFroggerGame } from "./frogger/engine";
import { FROGGER_TOUCH_CONTROLS } from "./frogger/touch";
import { createSnakeGame } from "./snake/engine";
import { SNAKE_SKINS } from "./snake/skins";
import { SNAKE_TOUCH_CONTROLS } from "./snake/touch";
import { createTetrisGame } from "./tetris/engine";
import { TETRIS_TOUCH_CONTROLS } from "./tetris/touch";
import type { TouchControlsLayout } from "./touch-controls";
import type { GameEngineFactory } from "./types";

// Games listed here run a real engine in the player; the rest keep the mock arena.
export const GAME_ENGINES: Readonly<Record<string, GameEngineFactory | undefined>> = {
  rocas: createAsteroidsGame,
  tetris: createTetrisGame,
  arkanoid: createArkanoidGame,
  snake: createSnakeGame,
  croac: createCroacGame,
  frogger: createFroggerGame,
};

// Slug → available skin ids, `classic` first. Games without an entry have no skins.
export const GAME_SKINS: Readonly<Record<string, readonly string[] | undefined>> = {
  snake: Object.keys(SNAKE_SKINS),
};

// Slug → touch panel layout. Games with an engine but no entry show "REQUIERE TECLADO".
export const GAME_TOUCH_CONTROLS: Readonly<Record<string, TouchControlsLayout | undefined>> = {
  rocas: ASTEROIDS_TOUCH_CONTROLS,
  tetris: TETRIS_TOUCH_CONTROLS,
  arkanoid: ARKANOID_TOUCH_CONTROLS,
  snake: SNAKE_TOUCH_CONTROLS,
  croac: CROAC_TOUCH_CONTROLS,
  frogger: FROGGER_TOUCH_CONTROLS,
};
