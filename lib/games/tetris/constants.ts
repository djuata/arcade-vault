// Values ported 1:1 from resources/started-games/03-tetris/game.js.
// Time is in seconds except the drop interval, which keeps the original milliseconds.

export const W = 800;
export const H = 600;
export const MAX_DT = 0.05;

export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;

// The 300×600 board fills the canvas height and sits left of center;
// the side panel holds the NEXT preview and the LINES counter.
export const BOARD_X = 220;
export const PANEL_X = 560;
export const NEXT_BOX = 120;

// Indexed by piece type (1–8); 8 is the "N" (nut) piece present in the original code.
export const COLORS: readonly (string | null)[] = [
  null,
  "#4dd0e1", // I
  "#ffd54f", // O
  "#ba68c8", // T
  "#81c784", // S
  "#e57373", // Z
  "#90caf9", // J
  "#ffb74d", // L
  "#9e9e9e", // N
];

export const LINE_SCORES: readonly number[] = [0, 100, 300, 500, 800];
export const SOFT_DROP_POINTS = 1;
export const HARD_DROP_POINTS = 2;

export const BASE_DROP_INTERVAL = 1000;
export const MIN_DROP_INTERVAL = 100;
export const DROP_INTERVAL_STEP = 90;
export const LINES_PER_LEVEL = 10;

export const WALL_KICKS: readonly number[] = [0, -1, 1, -2, 2];
