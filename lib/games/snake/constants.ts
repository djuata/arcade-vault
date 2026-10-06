export const W = 800;
export const H = 600;
export const MAX_DT = 0.05; // seconds; caps the jump after a background tab

export const CELL = 40;
export const COLS = W / CELL; // 20
export const ROWS = H / CELL; // 15

export const INITIAL_LENGTH = 3;
export const START_CELL = { col: 10, row: 7 } as const;

export const TICK_START_MS = 150;
export const TICK_STEP_MS = 10;
export const TICK_MIN_MS = 70;
export const FRUITS_PER_LEVEL = 5;

export const FRUIT_POINTS = 10;
export const MAX_QUEUED_TURNS = 2;
