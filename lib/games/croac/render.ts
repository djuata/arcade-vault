import {
  BAY_CENTERS,
  BAY_WIDTH,
  CELL,
  DEATH_MS,
  FROG_SIZE,
  GOAL_ROW,
  HEDGE_ROW,
  HOP_ANIM_MS,
  MEDIAN_ROW,
  RIVER_FIRST_ROW,
  RIVER_LAST_ROW,
  ROAD_FIRST_ROW,
  ROAD_LAST_ROW,
  START_ROW,
  TIME_DANGER_S,
  TIME_PER_FROG,
  TIME_WARN_S,
  TIMER_ROW,
  W,
} from "./constants";
import { divePhaseOf, type Lane, type LaneObject } from "./lanes";
import { isRiverRow, type DeathCause, type Direction, type Frog } from "./rules";

export interface Frame {
  lanes: readonly Lane[];
  bays: readonly boolean[];
  frog: Frog;
  /** Set while the frog is dying (and after the last death). */
  deathCause: DeathCause | null;
  deathTimerMs: number;
  timeLeft: number;
}

const COLORS = {
  hedge: "#0b2614",
  hedgeLeaf: "#14452a",
  bayWater: "#020b1f",
  lily: "#1f9d55",
  river: "#030c26",
  wave: "rgba(0,245,255,0.12)",
  safe: "#1a0b2e",
  safeEdge: "#ff006e",
  road: "#121218",
  laneMark: "#f5ff00",
  log: "#7a4a22",
  logRing: "#5a3416",
  turtle: "#c2412d",
  turtleShell: "#8e2a1c",
  ripple: "rgba(0,245,255,0.55)",
  frog: "#39ff6a",
  frogEye: "#020b1f",
  frogEyeWhite: "#ffffff",
  splash: "#00f5ff",
  squash: "#39ff6a",
  timerTrack: "#0a0a12",
  timerOk: "#00ff88",
  timerWarn: "#f5ff00",
  timerDanger: "#ff006e",
  headlight: "#fff6b0",
} as const;

const VEHICLE_COLORS: Readonly<Record<number, string>> = {
  12: "#f5ff00", // car
  11: "#00ff88", // tractor
  10: "#ff006e", // racer
  9: "#00f5ff", // car
  8: "#e6e9ff", // truck
};

const rowTop = (row: number) => row * CELL;
const rowCenter = (row: number) => row * CELL + CELL / 2;

// ── Background ──────────────────────────────────────────────────────────────

function drawSafeStrip(ctx: CanvasRenderingContext2D, row: number) {
  ctx.fillStyle = COLORS.safe;
  ctx.fillRect(0, rowTop(row), W, CELL);
  ctx.fillStyle = COLORS.safeEdge;
  ctx.fillRect(0, rowTop(row), W, 2);
  ctx.fillRect(0, rowTop(row) + CELL - 2, W, 2);
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLORS.hedge;
  ctx.fillRect(0, rowTop(HEDGE_ROW), W, CELL * 2);
  ctx.fillStyle = COLORS.hedgeLeaf;
  for (let x = 10; x < W; x += 40) ctx.fillRect(x, rowTop(HEDGE_ROW) + 12, 20, 10);

  ctx.fillStyle = COLORS.river;
  ctx.fillRect(0, rowTop(RIVER_FIRST_ROW), W, CELL * (RIVER_LAST_ROW - RIVER_FIRST_ROW + 1));
  ctx.fillStyle = COLORS.wave;
  for (let row = RIVER_FIRST_ROW; row <= RIVER_LAST_ROW; row++) {
    for (let x = (row % 2) * 40; x < W; x += 80) ctx.fillRect(x, rowCenter(row), 24, 2);
  }

  drawSafeStrip(ctx, MEDIAN_ROW);

  ctx.fillStyle = COLORS.road;
  ctx.fillRect(0, rowTop(ROAD_FIRST_ROW), W, CELL * (ROAD_LAST_ROW - ROAD_FIRST_ROW + 1));
  ctx.fillStyle = COLORS.laneMark;
  for (let row = ROAD_FIRST_ROW + 1; row <= ROAD_LAST_ROW; row++) {
    for (let x = 0; x < W; x += 40) ctx.fillRect(x, rowTop(row) - 1, 20, 2);
  }

  drawSafeStrip(ctx, START_ROW);

  ctx.fillStyle = COLORS.timerTrack;
  ctx.fillRect(0, rowTop(TIMER_ROW), W, CELL);
}

// ── Frog ────────────────────────────────────────────────────────────────────

function drawEyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, half: number, facing: Direction) {
  const offsets: Readonly<Record<Direction, [number, number, number, number]>> = {
    up: [-half / 2, -half / 2, half / 2, -half / 2],
    down: [-half / 2, half / 2, half / 2, half / 2],
    left: [-half / 2, -half / 2, -half / 2, half / 2],
    right: [half / 2, -half / 2, half / 2, half / 2],
  };
  const [ax, ay, bx, by] = offsets[facing];
  for (const [ex, ey] of [[ax, ay], [bx, by]] as const) {
    ctx.fillStyle = COLORS.frogEyeWhite;
    ctx.fillRect(cx + ex - 4, cy + ey - 4, 8, 8);
    ctx.fillStyle = COLORS.frogEye;
    ctx.fillRect(cx + ex - 2, cy + ey - 2, 4, 4);
  }
}

function drawFrogAt(ctx: CanvasRenderingContext2D, cx: number, cy: number, facing: Direction, stretch = 0) {
  const vertical = facing === "up" || facing === "down";
  const w = FROG_SIZE * (vertical ? 1 - stretch * 0.2 : 1 + stretch * 0.3);
  const h = FROG_SIZE * (vertical ? 1 + stretch * 0.3 : 1 - stretch * 0.2);
  ctx.save();
  ctx.shadowColor = COLORS.frog;
  ctx.shadowBlur = 10;
  ctx.fillStyle = COLORS.frog;
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
  drawEyes(ctx, cx, cy, FROG_SIZE / 2, facing);
}

function drawSquash(ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number) {
  ctx.globalAlpha = 1 - progress * 0.6;
  ctx.fillStyle = COLORS.squash;
  ctx.fillRect(cx - FROG_SIZE * 0.7, cy - 4, FROG_SIZE * 1.4, 8);
  ctx.fillRect(cx - FROG_SIZE * 0.5, cy - 9, 6, 18);
  ctx.fillRect(cx + FROG_SIZE * 0.5 - 6, cy - 9, 6, 18);
  ctx.globalAlpha = 1;
}

function drawSplash(ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number) {
  ctx.strokeStyle = COLORS.splash;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 1 - progress;
  for (const scale of [0.4, 0.75, 1.1]) {
    ctx.beginPath();
    ctx.arc(cx, cy, (6 + progress * 14) * scale + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawFrog(ctx: CanvasRenderingContext2D, frame: Frame) {
  const { frog, deathCause, deathTimerMs } = frame;
  const cy = rowCenter(frog.row);
  if (deathCause === null) {
    drawFrogAt(ctx, frog.x, cy, frog.facing, Math.max(0, frog.hopAnimMs) / HOP_ANIM_MS);
    return;
  }
  const progress = Math.min(1, Math.max(0, 1 - deathTimerMs / DEATH_MS));
  const splashes = deathCause !== "vehicle" && (deathCause !== "time" || isRiverRow(frog.row));
  if (splashes) drawSplash(ctx, frog.x, cy, progress);
  else drawSquash(ctx, frog.x, cy, progress);
}

// ── Bays ────────────────────────────────────────────────────────────────────

function drawBays(ctx: CanvasRenderingContext2D, bays: readonly boolean[]) {
  const top = rowTop(GOAL_ROW);
  BAY_CENTERS.forEach((center, i) => {
    ctx.fillStyle = COLORS.bayWater;
    ctx.fillRect(center - BAY_WIDTH / 2, top + 2, BAY_WIDTH, CELL - 2);
    if (bays[i]) {
      drawFrogAt(ctx, center, rowCenter(GOAL_ROW), "down");
      return;
    }
    ctx.fillStyle = COLORS.lily;
    ctx.beginPath();
    ctx.arc(center, rowCenter(GOAL_ROW), 12, 0.25, Math.PI * 2 - 0.25);
    ctx.lineTo(center, rowCenter(GOAL_ROW));
    ctx.fill();
  });
}

// ── Lanes ───────────────────────────────────────────────────────────────────

function drawLog(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
  ctx.fillStyle = COLORS.log;
  ctx.fillRect(x, y + 6, width, CELL - 12);
  ctx.fillStyle = COLORS.logRing;
  for (let lx = x + 20; lx < x + width - 10; lx += 40) ctx.fillRect(lx, y + 12, 3, CELL - 24);
  ctx.fillRect(x, y + 6, 4, CELL - 12);
  ctx.fillRect(x + width - 4, y + 6, 4, CELL - 12);
}

function drawTurtles(ctx: CanvasRenderingContext2D, obj: LaneObject, y: number, width: number) {
  const phase = divePhaseOf(obj);
  const count = Math.round(width / CELL);
  for (let i = 0; i < count; i++) {
    const cx = obj.x + CELL * i + CELL / 2;
    const cy = y + CELL / 2;
    if (phase === "under") {
      ctx.strokeStyle = COLORS.ripple;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    const radius = phase === "surfaced" ? 15 : 10;
    ctx.globalAlpha = phase === "surfaced" ? 1 : 0.55;
    ctx.fillStyle = COLORS.turtle;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.turtleShell;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawVehicle(ctx: CanvasRenderingContext2D, lane: Lane, obj: LaneObject, y: number) {
  const { width, dir, row, sprite } = lane.def;
  const color = VEHICLE_COLORS[row] ?? COLORS.laneMark;
  const body = sprite === "truck" ? 26 : 24;
  const top = y + (CELL - body) / 2;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillRect(obj.x, top, width, body);
  ctx.restore();

  // Cab / cockpit darker block toward the front.
  const front = dir > 0 ? obj.x + width : obj.x;
  const cabW = sprite === "truck" ? 26 : sprite === "tractor" ? 18 : 14;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(dir > 0 ? front - cabW - 4 : front + 4, top + 4, cabW, body - 8);

  ctx.fillStyle = COLORS.headlight;
  const lx = dir > 0 ? front - 3 : front;
  ctx.fillRect(lx, top + 3, 3, 4);
  ctx.fillRect(lx, top + body - 7, 3, 4);
}

function drawLanes(ctx: CanvasRenderingContext2D, lanes: readonly Lane[]) {
  for (const lane of lanes) {
    const y = rowTop(lane.def.row);
    for (const obj of lane.objects) {
      if (lane.def.sprite === "log") drawLog(ctx, obj.x, y, lane.def.width);
      else if (lane.def.sprite === "turtles") drawTurtles(ctx, obj, y, lane.def.width);
      else drawVehicle(ctx, lane, obj, y);
    }
  }
}

// ── Timer ───────────────────────────────────────────────────────────────────

function drawTimer(ctx: CanvasRenderingContext2D, timeLeft: number) {
  const usable = W - 40;
  const width = (Math.max(0, timeLeft) / TIME_PER_FROG) * usable;
  const color =
    timeLeft < TIME_DANGER_S ? COLORS.timerDanger : timeLeft < TIME_WARN_S ? COLORS.timerWarn : COLORS.timerOk;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillRect(20 + usable - width, rowCenter(TIMER_ROW) - 8, width, 16);
  ctx.restore();
}

export function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame): void {
  drawBackground(ctx);
  drawBays(ctx, frame.bays);
  drawLanes(ctx, frame.lanes);
  drawFrog(ctx, frame);
  drawTimer(ctx, frame.timeLeft);
}
