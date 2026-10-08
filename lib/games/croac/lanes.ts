import {
  DIVE_CYCLE_S,
  DIVE_SINKING_S,
  DIVE_SURFACED_S,
  DIVE_UNDER_S,
  LEVEL_SPEED_CAP,
  LEVEL_SPEED_STEP,
  W,
} from "./constants";

export type LaneKind = "road" | "river";
export type LaneSprite = "car" | "tractor" | "racer" | "truck" | "turtles" | "log";
export type DivePhase = "surfaced" | "sinking" | "under" | "rising";

export interface LaneDef {
  row: number;
  kind: LaneKind;
  sprite: LaneSprite;
  width: number;
  dir: 1 | -1;
  speed: number; // px/s at level 1
  count: number;
  spacing: number;
  offset: number;
  /** Index of the one object in this lane that dives (turtle lanes only). */
  divingIndex?: number;
  /** Initial dive clock, in seconds, of the diving object. */
  diveStartS?: number;
}

/** `x` is the left edge. */
export interface LaneObject {
  x: number;
  diving: boolean;
  diveClock: number;
}

export interface Lane {
  def: LaneDef;
  vx: number;
  period: number;
  objects: LaneObject[];
}

// Every lane satisfies count · spacing ≥ W + width, so nothing pops in or out on screen.
export const LANE_DEFS: readonly LaneDef[] = [
  { row: 12, kind: "road", sprite: "car", width: 48, dir: -1, speed: 70, count: 4, spacing: 240, offset: 0 },
  { row: 11, kind: "road", sprite: "tractor", width: 48, dir: 1, speed: 55, count: 3, spacing: 320, offset: 100 },
  { row: 10, kind: "road", sprite: "racer", width: 48, dir: -1, speed: 110, count: 3, spacing: 300, offset: 200 },
  { row: 9, kind: "road", sprite: "car", width: 48, dir: 1, speed: 80, count: 4, spacing: 230, offset: 50 },
  { row: 8, kind: "road", sprite: "truck", width: 112, dir: -1, speed: 60, count: 3, spacing: 340, offset: 150 },
  {
    row: 6, kind: "river", sprite: "turtles", width: 120, dir: -1, speed: 50, count: 4, spacing: 260, offset: 0,
    divingIndex: 1, diveStartS: 0,
  },
  { row: 5, kind: "river", sprite: "log", width: 120, dir: 1, speed: 45, count: 3, spacing: 330, offset: 80 },
  { row: 4, kind: "river", sprite: "log", width: 240, dir: 1, speed: 80, count: 2, spacing: 520, offset: 0 },
  {
    row: 3, kind: "river", sprite: "turtles", width: 80, dir: -1, speed: 65, count: 4, spacing: 240, offset: 120,
    divingIndex: 2, diveStartS: 2.7,
  },
  { row: 2, kind: "river", sprite: "log", width: 160, dir: 1, speed: 60, count: 3, spacing: 340, offset: 40 },
];

export function speedMultiplierFor(level: number): number {
  return 1 + LEVEL_SPEED_STEP * (Math.min(level, LEVEL_SPEED_CAP) - 1);
}

// Keeps x inside the window the wrap rule maintains for each direction.
function normalizeX(x: number, def: LaneDef, period: number): number {
  const min = def.dir > 0 ? W - period : -def.width;
  return min + ((((x - min) % period) + period) % period);
}

function createLane(def: LaneDef, level: number): Lane {
  const period = def.count * def.spacing;
  const objects = Array.from({ length: def.count }, (_, i) => {
    const diving = def.divingIndex === i;
    return {
      x: normalizeX(def.offset + i * def.spacing, def, period),
      diving,
      diveClock: diving ? (def.diveStartS ?? 0) : 0,
    };
  });
  return { def, vx: def.dir * def.speed * speedMultiplierFor(level), period, objects };
}

export function createLanes(level: number): Lane[] {
  return LANE_DEFS.map((def) => createLane(def, level));
}

export function moveLanes(lanes: Lane[], dt: number): void {
  for (const lane of lanes) {
    for (const obj of lane.objects) {
      obj.x += lane.vx * dt;
      if (lane.def.dir > 0 && obj.x >= W) obj.x -= lane.period;
      else if (lane.def.dir < 0 && obj.x + lane.def.width <= 0) obj.x += lane.period;
    }
  }
}

export function advanceDiveClocks(lanes: Lane[], dt: number): void {
  for (const lane of lanes) {
    for (const obj of lane.objects) if (obj.diving) obj.diveClock += dt;
  }
}

export function divePhaseOf(obj: LaneObject): DivePhase {
  if (!obj.diving) return "surfaced";
  const t = obj.diveClock % DIVE_CYCLE_S;
  if (t < DIVE_SURFACED_S) return "surfaced";
  if (t < DIVE_SURFACED_S + DIVE_SINKING_S) return "sinking";
  if (t < DIVE_SURFACED_S + DIVE_SINKING_S + DIVE_UNDER_S) return "under";
  return "rising";
}

export function isStandable(obj: LaneObject): boolean {
  return divePhaseOf(obj) !== "under";
}
