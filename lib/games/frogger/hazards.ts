import {
  BAY_CROC_CYCLE_S,
  BAY_CROC_HIDDEN_S,
  BAY_CROC_ORDER,
  BAY_CROC_PEEK_S,
  CROC_FROM_LEVEL,
  FLY_BAY_ORDER,
  FLY_CYCLE_S,
  FLY_HIDDEN_S,
  FROG_HALF_W,
  LADY_ABSENT_S,
  LADY_CYCLE_S,
  LADY_PICKUP_TOLERANCE,
  MEDIAN_ROW,
  SNAKE_FROM_LEVEL,
  SNAKE_INSET,
  SNAKE_SPEED,
  SNAKE_W,
  W,
} from "./constants";
import { speedMultiplierFor, type Lane } from "./lanes";

export type BayCrocPhase = "hidden" | "peek" | "jaws";

/** Only what the hazards need from the frog: continuous center `x` and grid `row`. */
interface FrogSpot {
  x: number;
  row: number;
}

export interface Snake {
  x: number; // left edge
  dir: 1 | -1;
}

/**
 * Every hazard runs on a fixed clock and a fixed bay rotation: no randomness,
 * so two runs with the same input are identical. Bays are picked once per cycle
 * (`*Cycle` tracks which cycle the current pick belongs to).
 */
export interface Hazards {
  flyClock: number;
  flyCycle: number;
  flyTurn: number;
  flyBay: number | null;

  crocsEnabled: boolean;
  bayCrocClock: number;
  bayCrocCycle: number;
  bayCrocTurn: number;
  bayCrocBay: number | null;

  ladyClock: number;
  ladyEscorted: boolean;

  snake: Snake | null;
}

export function createHazards(level: number): Hazards {
  return {
    flyClock: 0,
    flyCycle: -1,
    flyTurn: 0,
    flyBay: null,
    crocsEnabled: level >= CROC_FROM_LEVEL,
    bayCrocClock: 0,
    bayCrocCycle: -1,
    bayCrocTurn: 0,
    bayCrocBay: null,
    ladyClock: 0,
    ladyEscorted: false,
    snake: level >= SNAKE_FROM_LEVEL ? { x: 0, dir: 1 } : null,
  };
}

// Next bay of `order` from `turn` that passes `isFree`; returns the bay and the turn after it.
function pickBay(
  order: readonly number[],
  turn: number,
  isFree: (bay: number) => boolean,
): { bay: number | null; turn: number } {
  for (let k = 0; k < order.length; k++) {
    const bay = order[(turn + k) % order.length];
    if (isFree(bay)) return { bay, turn: (turn + k + 1) % order.length };
  }
  return { bay: null, turn: (turn + 1) % order.length };
}

// ── Fly ─────────────────────────────────────────────────────────────────────

export function stepFly(h: Hazards, dt: number, bays: readonly boolean[]): void {
  h.flyClock += dt;
  const cycle = Math.floor(h.flyClock / FLY_CYCLE_S);
  if (cycle === h.flyCycle) return;
  h.flyCycle = cycle;
  const pick = pickBay(FLY_BAY_ORDER, h.flyTurn, (bay) => !bays[bay] && bay !== h.bayCrocBay);
  h.flyBay = pick.bay;
  h.flyTurn = pick.turn;
}

/** The bay showing the fly right now, or `null`. */
export function visibleFlyBay(h: Hazards, bays: readonly boolean[]): number | null {
  if (h.flyBay === null || bays[h.flyBay]) return null;
  return h.flyClock % FLY_CYCLE_S >= FLY_HIDDEN_S ? h.flyBay : null;
}

/** The fly is eaten (or its bay got taken): gone until the next cycle. */
export function clearFly(h: Hazards): void {
  h.flyBay = null;
}

// ── Bay crocodile ───────────────────────────────────────────────────────────

export function stepBayCroc(h: Hazards, dt: number, bays: readonly boolean[]): void {
  if (!h.crocsEnabled) return;
  h.bayCrocClock += dt;
  const cycle = Math.floor(h.bayCrocClock / BAY_CROC_CYCLE_S);
  if (cycle === h.bayCrocCycle) return;
  h.bayCrocCycle = cycle;
  const pick = pickBay(BAY_CROC_ORDER, h.bayCrocTurn, (bay) => !bays[bay] && bay !== h.flyBay);
  h.bayCrocBay = pick.bay;
  h.bayCrocTurn = pick.turn;
}

export function bayCrocPhaseOf(h: Hazards, bays: readonly boolean[]): { bay: number; phase: BayCrocPhase } | null {
  if (h.bayCrocBay === null || bays[h.bayCrocBay]) return null;
  const t = h.bayCrocClock % BAY_CROC_CYCLE_S;
  const phase: BayCrocPhase =
    t < BAY_CROC_HIDDEN_S ? "hidden" : t < BAY_CROC_HIDDEN_S + BAY_CROC_PEEK_S ? "peek" : "jaws";
  return { bay: h.bayCrocBay, phase };
}

/** Entering during `peek` scares the crocodile off until its next cycle. */
export function scareBayCroc(h: Hazards): void {
  h.bayCrocBay = null;
}

// ── Lady frog ───────────────────────────────────────────────────────────────

export function stepLady(h: Hazards, dt: number): void {
  if (!h.ladyEscorted) h.ladyClock += dt;
}

/** Center `x` of the lady frog sitting on her log, or `null` when absent or escorted. */
export function ladyPosition(h: Hazards, lanes: readonly Lane[]): { x: number; row: number } | null {
  if (h.ladyEscorted || h.ladyClock % LADY_CYCLE_S < LADY_ABSENT_S) return null;
  const lane = lanes.find((l) => l.def.ladyIndex !== undefined);
  const log = lane?.objects[lane.def.ladyIndex ?? 0];
  if (!lane || !log) return null;
  return { x: log.x + lane.def.width / 2, row: lane.def.row };
}

export function tryPickUpLady(h: Hazards, frog: FrogSpot, lanes: readonly Lane[]): void {
  const lady = ladyPosition(h, lanes);
  if (!lady || frog.row !== lady.row) return;
  if (Math.abs(frog.x - lady.x) <= LADY_PICKUP_TOLERANCE) h.ladyEscorted = true;
}

/** Escort over (home or death): the lady's cycle starts again from absent. */
export function endLadyEscort(h: Hazards): void {
  h.ladyEscorted = false;
  h.ladyClock = 0;
}

// ── Snake ───────────────────────────────────────────────────────────────────

export function moveSnake(h: Hazards, dt: number, level: number): void {
  const snake = h.snake;
  if (!snake) return;
  snake.x += snake.dir * SNAKE_SPEED * speedMultiplierFor(level) * dt;
  const maxX = W - SNAKE_W;
  if (snake.x >= maxX) {
    snake.x = maxX;
    snake.dir = -1;
  } else if (snake.x <= 0) {
    snake.x = 0;
    snake.dir = 1;
  }
}

export function snakeHits(frog: FrogSpot, snake: Snake | null): boolean {
  if (!snake || frog.row !== MEDIAN_ROW) return false;
  return frog.x - FROG_HALF_W < snake.x + SNAKE_W - SNAKE_INSET && snake.x + SNAKE_INSET < frog.x + FROG_HALF_W;
}
