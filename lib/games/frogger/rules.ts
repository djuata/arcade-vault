import {
  BAY_CENTERS,
  BAY_TOLERANCE,
  CROC_HEAD_W,
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
import { bayCrocPhaseOf, snakeHits, visibleFlyBay, type Hazards } from "./hazards";
import { crocHeadRange, isStandable, type Lane, type LaneObject } from "./lanes";

export type Direction = "up" | "down" | "left" | "right";
export type DeathCause = "vehicle" | "snake" | "croc" | "water" | "edge" | "time" | "bay";

/** `x` is continuous (center, px); `row` is an integer grid row. */
export interface Frog {
  x: number;
  row: number;
  facing: Direction;
  hopAnimMs: number;
}

export type BayEntry = { kind: "home"; index: number; fly: boolean } | { kind: "death"; cause: "bay" | "croc" };

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

export function hitsCrocHead(frog: Frog, lane: Lane): boolean {
  return lane.objects.some((obj) => {
    if (!obj.croc) return false;
    const [from, to] = crocHeadRange(obj, lane);
    return frog.x >= from && frog.x <= to;
  });
}

// A crocodile is standable only on its body, never on its head.
function standableRange(obj: LaneObject, lane: Lane): [number, number] {
  if (!obj.croc) return [obj.x, obj.x + lane.def.width];
  return lane.def.dir > 0
    ? [obj.x, obj.x + lane.def.width - CROC_HEAD_W]
    : [obj.x + CROC_HEAD_W, obj.x + lane.def.width];
}

/** The standable object under the frog's center, if any. */
export function platformUnder(frog: Frog, lane: Lane): LaneObject | null {
  return (
    lane.objects.find((obj) => {
      if (!isStandable(obj)) return false;
      const [from, to] = standableRange(obj, lane);
      return frog.x >= from && frog.x <= to;
    }) ?? null
  );
}

export function isOffEdge(frog: Frog): boolean {
  return frog.x < 0 || frog.x > W;
}

/** What happens when the frog lands on the goal row at `x`. */
export function bayEntryFor(x: number, bays: readonly boolean[], hazards: Hazards): BayEntry {
  const index = BAY_CENTERS.findIndex((center) => Math.abs(x - center) <= BAY_TOLERANCE);
  if (index === -1 || bays[index]) return { kind: "death", cause: "bay" };
  const croc = bayCrocPhaseOf(hazards, bays);
  if (croc?.bay === index && croc.phase === "jaws") return { kind: "death", cause: "croc" };
  return { kind: "home", index, fly: visibleFlyBay(hazards, bays) === index };
}

export function timeBonusFor(timeLeft: number): number {
  return Math.min(Math.floor(timeLeft * 2) * TIME_BONUS_PER_HALF_S, TIME_BONUS_MAX);
}

/** First death that applies, in the order vehicle → snake → croc → water → edge → time; `null` if alive. */
export function deathCauseFor(
  frog: Frog,
  lanes: readonly Lane[],
  hazards: Hazards,
  timeLeft: number,
): DeathCause | null {
  const lane = laneAt(lanes, frog.row);
  if (lane && isRoadRow(frog.row) && hitsVehicle(frog, lane)) return "vehicle";
  if (snakeHits(frog, hazards.snake)) return "snake";
  if (lane && isRiverRow(frog.row)) {
    if (hitsCrocHead(frog, lane)) return "croc";
    if (!platformUnder(frog, lane)) return "water";
    if (isOffEdge(frog)) return "edge";
  }
  if (timeLeft <= 0) return "time";
  return null;
}
