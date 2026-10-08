import {
  BAY_CENTERS,
  BAY_TOLERANCE,
  FROG_HALF_W,
  FROG_MAX_X,
  FROG_MIN_X,
  HOP,
  HOP_ANIM_MS,
  RIVER_FIRST_ROW,
  RIVER_LAST_ROW,
  ROAD_FIRST_ROW,
  ROAD_LAST_ROW,
  START_ROW,
  TIME_BONUS_MAX,
  TIME_BONUS_PER_HALF_S,
  VEHICLE_INSET,
  W,
} from "./constants";
import { isStandable, type Lane, type LaneObject } from "./lanes";

export type Direction = "up" | "down" | "left" | "right";
export type DeathCause = "vehicle" | "water" | "edge" | "time" | "bay";

/** `x` is continuous (center, px); `row` is an integer grid row. */
export interface Frog {
  x: number;
  row: number;
  facing: Direction;
  hopAnimMs: number;
}

export const KEY_DIRECTIONS: Readonly<Record<string, Direction | undefined>> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

export function isRiverRow(row: number): boolean {
  return row >= RIVER_FIRST_ROW && row <= RIVER_LAST_ROW;
}

export function isRoadRow(row: number): boolean {
  return row >= ROAD_FIRST_ROW && row <= ROAD_LAST_ROW;
}

/** The frog after hopping, or `null` when the hop is ignored (down from the start, out the sides). */
export function tryHop(frog: Frog, dir: Direction): Frog | null {
  let { x, row } = frog;
  if (dir === "up") row -= 1;
  else if (dir === "down") row += 1;
  else x += dir === "left" ? -HOP : HOP;

  if (row > START_ROW) return null;
  if (x < FROG_MIN_X || x > FROG_MAX_X) return null;
  return { x, row, facing: dir, hopAnimMs: HOP_ANIM_MS };
}

export function laneAt(lanes: readonly Lane[], row: number): Lane | undefined {
  return lanes.find((lane) => lane.def.row === row);
}

export function hitsVehicle(frog: Frog, lane: Lane): boolean {
  const left = frog.x - FROG_HALF_W;
  const right = frog.x + FROG_HALF_W;
  return lane.objects.some(
    (obj) => left < obj.x + lane.def.width - VEHICLE_INSET && obj.x + VEHICLE_INSET < right,
  );
}

/** The standable object under the frog's center, if any. */
export function platformUnder(frog: Frog, lane: Lane): LaneObject | null {
  return (
    lane.objects.find((obj) => isStandable(obj) && frog.x >= obj.x && frog.x <= obj.x + lane.def.width) ??
    null
  );
}

export function isOffEdge(frog: Frog): boolean {
  return frog.x < 0 || frog.x > W;
}

/** Index of the empty bay within tolerance of `x`, or `null`. */
export function bayIndexAt(x: number, bays: readonly boolean[]): number | null {
  const index = BAY_CENTERS.findIndex((center, i) => !bays[i] && Math.abs(x - center) <= BAY_TOLERANCE);
  return index === -1 ? null : index;
}

export function timeBonusFor(timeLeft: number): number {
  return Math.min(Math.floor(timeLeft * 2) * TIME_BONUS_PER_HALF_S, TIME_BONUS_MAX);
}

/** First death that applies, in the order vehicle → water → edge → time; `null` if alive. */
export function deathCauseFor(frog: Frog, lanes: readonly Lane[], timeLeft: number): DeathCause | null {
  const lane = laneAt(lanes, frog.row);
  if (lane && isRoadRow(frog.row) && hitsVehicle(frog, lane)) return "vehicle";
  if (lane && isRiverRow(frog.row)) {
    if (!platformUnder(frog, lane)) return "water";
    if (isOffEdge(frog)) return "edge";
  }
  if (timeLeft <= 0) return "time";
  return null;
}
