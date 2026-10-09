export const W = 800;
export const H = 600;
export const MAX_DT = 0.05; // seconds; caps the jump after a background tab

// ── Grid ────────────────────────────────────────────────────────────────────

export const CELL = 40;
export const COLS = W / CELL; // 20
export const ROWS = H / CELL; // 15

// Row r spans y ∈ [r·CELL, r·CELL + CELL).
export const HEDGE_ROW = 0;
export const GOAL_ROW = 1;
export const RIVER_FIRST_ROW = 2;
export const RIVER_LAST_ROW = 6;
export const MEDIAN_ROW = 7;
export const ROAD_FIRST_ROW = 8;
export const ROAD_LAST_ROW = 12;
export const START_ROW = 13;
export const TIMER_ROW = 14;

// ── Frog ────────────────────────────────────────────────────────────────────

export const START_X = 400;
export const HOP = 40;
export const FROG_HALF_W = 14;
export const FROG_MIN_X = 20;
export const FROG_MAX_X = 780;
export const FROG_SIZE = 32;
export const HOP_ANIM_MS = 90; // visual only: hops are logically instant
export const MAX_QUEUED_HOPS = 2;

// ── Bays ────────────────────────────────────────────────────────────────────

export const BAY_CENTERS = [80, 240, 400, 560, 720] as const;
export const BAY_COUNT = BAY_CENTERS.length;
export const BAY_WIDTH = 64;
export const BAY_TOLERANCE = 24;

// ── Lanes ───────────────────────────────────────────────────────────────────

export const VEHICLE_INSET = 4;

export const DIVE_SURFACED_S = 3.0;
export const DIVE_SINKING_S = 0.6;
export const DIVE_UNDER_S = 1.2;
export const DIVE_RISING_S = 0.6;
export const DIVE_CYCLE_S = DIVE_SURFACED_S + DIVE_SINKING_S + DIVE_UNDER_S + DIVE_RISING_S; // 5.4

// ── Time, lives, death ──────────────────────────────────────────────────────

export const TIME_PER_FROG = 30;
export const TIME_WARN_S = 10;
export const TIME_DANGER_S = 5;
export const LIVES = 3;
export const MAX_LIVES = 4;
export const EXTRA_LIFE_AT = 10000; // once per run
export const DEATH_MS = 1000;

// ── Score ───────────────────────────────────────────────────────────────────

export const STEP_POINTS = 10;
export const HOME_POINTS = 50;
export const TIME_BONUS_PER_HALF_S = 10;
export const TIME_BONUS_MAX = 600;
export const LEVEL_CLEAR_POINTS = 1000;
export const FLY_POINTS = 200;
export const LADY_POINTS = 200;

// ── Level speed ─────────────────────────────────────────────────────────────

export const LEVEL_SPEED_STEP = 0.12;
export const LEVEL_SPEED_CAP = 9; // ×1.96 from level 9 on

// ── Hazards by level ────────────────────────────────────────────────────────

export const CROC_FROM_LEVEL = 2;
export const SNAKE_FROM_LEVEL = 3;

// Fly: hidden, then visible on one empty bay picked from a fixed rotation.
export const FLY_HIDDEN_S = 5;
export const FLY_VISIBLE_S = 4;
export const FLY_CYCLE_S = FLY_HIDDEN_S + FLY_VISIBLE_S; // 9
export const FLY_BAY_ORDER = [2, 0, 3, 1, 4] as const;

// Bay crocodile: hidden → peek (safe to enter, scares it off) → jaws (deadly).
export const BAY_CROC_HIDDEN_S = 7;
export const BAY_CROC_PEEK_S = 2;
export const BAY_CROC_JAWS_S = 3;
export const BAY_CROC_CYCLE_S = BAY_CROC_HIDDEN_S + BAY_CROC_PEEK_S + BAY_CROC_JAWS_S; // 12
export const BAY_CROC_ORDER = [0, 2, 4, 1, 3] as const;

// River crocodile: the head is the front CROC_HEAD_W px, in the travel direction.
export const CROC_HEAD_W = 40;
export const CROC_JAW_ANIM_S = 1.2; // visual only

// Lady frog: rides log 1 of row 5 while present; picked up within the tolerance.
export const LADY_ABSENT_S = 10;
export const LADY_PRESENT_S = 6;
export const LADY_CYCLE_S = LADY_ABSENT_S + LADY_PRESENT_S; // 16
export const LADY_PICKUP_TOLERANCE = 20;

// Snake: patrols the median from SNAKE_FROM_LEVEL, bouncing in [0, W − SNAKE_W].
export const SNAKE_W = 80;
export const SNAKE_SPEED = 60; // px/s, times the level multiplier
export const SNAKE_INSET = 6;
