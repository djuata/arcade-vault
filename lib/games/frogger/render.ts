import type { GlowCache } from "../glow-cache";
import {
  BAY_CENTERS,
  BAY_WIDTH,
  CELL,
  CROC_HEAD_W,
  CROC_JAW_ANIM_S,
  DEATH_MS,
  FROG_SIZE,
  GOAL_ROW,
  H,
  HEDGE_ROW,
  HOP_ANIM_MS,
  MEDIAN_ROW,
  RIVER_FIRST_ROW,
  RIVER_LAST_ROW,
  ROAD_FIRST_ROW,
  ROAD_LAST_ROW,
  SNAKE_W,
  START_ROW,
  TIME_DANGER_S,
  TIME_PER_FROG,
  TIME_WARN_S,
  TIMER_ROW,
  W,
} from "./constants";
import { bayCrocPhaseOf, ladyPosition, visibleFlyBay, type Hazards, type Snake } from "./hazards";
import { divePhaseOf, type Lane, type LaneObject, type LaneSprite } from "./lanes";
import { isRiverRow, type DeathCause, type Direction, type Frog } from "./rules";
import type { FroggerPalette, VehicleSprite } from "./skins";

export interface Frame {
  lanes: readonly Lane[];
  bays: readonly boolean[];
  frog: Frog;
  hazards: Hazards;
  /** Set while the frog is dying (and after the last death). */
  deathCause: DeathCause | null;
  deathTimerMs: number;
  timeLeft: number;
  /** Seconds of world time, for purely visual cycles (crocodile jaws). */
  animClock: number;
}

const rowTop = (row: number) => row * CELL;
const rowCenter = (row: number) => row * CELL + CELL / 2;

function isVehicleSprite(sprite: LaneSprite): sprite is VehicleSprite {
  return sprite !== "turtles" && sprite !== "log";
}

// Draws with a same-color glow when blur > 0; with 0 it draws plain, without touching the shadow.
function withGlow(ctx: CanvasRenderingContext2D, color: string, blur: number, draw: () => void) {
  if (blur <= 0) {
    draw();
    return;
  }
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  draw();
  ctx.restore();
}

// ── Background ──────────────────────────────────────────────────────────────

function drawGrassStrip(ctx: CanvasRenderingContext2D, row: number, palette: FroggerPalette) {
  ctx.fillStyle = palette.grass;
  ctx.fillRect(0, rowTop(row), W, CELL);
  ctx.fillStyle = palette.grassEdge;
  ctx.fillRect(0, rowTop(row), W, 2);
  ctx.fillRect(0, rowTop(row) + CELL - 2, W, 2);
}

function drawBackground(ctx: CanvasRenderingContext2D, palette: FroggerPalette) {
  ctx.fillStyle = palette.hedge;
  ctx.fillRect(0, rowTop(HEDGE_ROW), W, CELL * 2);
  ctx.fillStyle = palette.hedgeLeaf;
  for (let x = 10; x < W; x += 40) ctx.fillRect(x, rowTop(HEDGE_ROW) + 12, 20, 10);

  ctx.fillStyle = palette.river;
  ctx.fillRect(0, rowTop(RIVER_FIRST_ROW), W, CELL * (RIVER_LAST_ROW - RIVER_FIRST_ROW + 1));
  ctx.fillStyle = palette.wave;
  for (let row = RIVER_FIRST_ROW; row <= RIVER_LAST_ROW; row++) {
    for (let x = (row % 2) * 40; x < W; x += 80) ctx.fillRect(x, rowCenter(row), 24, 2);
  }

  drawGrassStrip(ctx, MEDIAN_ROW, palette);

  ctx.fillStyle = palette.road;
  ctx.fillRect(0, rowTop(ROAD_FIRST_ROW), W, CELL * (ROAD_LAST_ROW - ROAD_FIRST_ROW + 1));
  ctx.fillStyle = palette.laneMark;
  for (let row = ROAD_FIRST_ROW + 1; row <= ROAD_LAST_ROW; row++) {
    for (let x = 0; x < W; x += 40) ctx.fillRect(x, rowTop(row) - 1, 20, 2);
  }

  drawGrassStrip(ctx, START_ROW, palette);

  ctx.fillStyle = palette.timerTrack;
  ctx.fillRect(0, rowTop(TIMER_ROW), W, CELL);
}

// The background never changes within a palette: paint it once and blit it every frame.
let backgroundCache: { palette: FroggerPalette; canvas: HTMLCanvasElement } | null = null;

function cachedBackground(palette: FroggerPalette): HTMLCanvasElement {
  if (backgroundCache?.palette === palette) return backgroundCache.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Frogger: 2D canvas context is not available");
  drawBackground(ctx, palette);
  backgroundCache = { palette, canvas };
  return canvas;
}

// ── Frog ────────────────────────────────────────────────────────────────────

function drawEyes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  half: number,
  facing: Direction,
  palette: FroggerPalette,
) {
  const offsets: Readonly<Record<Direction, [number, number, number, number]>> = {
    up: [-half / 2, -half / 2, half / 2, -half / 2],
    down: [-half / 2, half / 2, half / 2, half / 2],
    left: [-half / 2, -half / 2, -half / 2, half / 2],
    right: [half / 2, -half / 2, half / 2, half / 2],
  };
  const [ax, ay, bx, by] = offsets[facing];
  for (const [ex, ey] of [[ax, ay], [bx, by]] as const) {
    ctx.fillStyle = palette.frogEyeWhite;
    ctx.fillRect(cx + ex - 4, cy + ey - 4, 8, 8);
    ctx.fillStyle = palette.frogEye;
    ctx.fillRect(cx + ex - 2, cy + ey - 2, 4, 4);
  }
}

function drawFrogAt(
  ctx: CanvasRenderingContext2D,
  palette: FroggerPalette,
  cx: number,
  cy: number,
  facing: Direction,
  stretch = 0,
) {
  const vertical = facing === "up" || facing === "down";
  const w = FROG_SIZE * (vertical ? 1 - stretch * 0.2 : 1 + stretch * 0.3);
  const h = FROG_SIZE * (vertical ? 1 + stretch * 0.3 : 1 - stretch * 0.2);
  withGlow(ctx, palette.frog, palette.glow.frog, () => {
    ctx.fillStyle = palette.frog;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  });
  drawEyes(ctx, cx, cy, FROG_SIZE / 2, facing, palette);
}

function drawLadyAt(ctx: CanvasRenderingContext2D, palette: FroggerPalette, glow: GlowCache, cx: number, cy: number) {
  glow.rect(ctx, cx - 8, cy - 8, 16, 16, palette.lady, palette.glow.lady);
  ctx.fillStyle = palette.frogEye;
  ctx.fillRect(cx - 5, cy - 5, 3, 3);
  ctx.fillRect(cx + 2, cy - 5, 3, 3);
}

function drawSquash(ctx: CanvasRenderingContext2D, palette: FroggerPalette, cx: number, cy: number, progress: number) {
  ctx.globalAlpha = 1 - progress * 0.6;
  ctx.fillStyle = palette.squash;
  ctx.fillRect(cx - FROG_SIZE * 0.7, cy - 4, FROG_SIZE * 1.4, 8);
  ctx.fillRect(cx - FROG_SIZE * 0.5, cy - 9, 6, 18);
  ctx.fillRect(cx + FROG_SIZE * 0.5 - 6, cy - 9, 6, 18);
  ctx.globalAlpha = 1;
}

function drawSplash(ctx: CanvasRenderingContext2D, palette: FroggerPalette, cx: number, cy: number, progress: number) {
  ctx.strokeStyle = palette.splash;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 1 - progress;
  for (const scale of [0.4, 0.75, 1.1]) {
    ctx.beginPath();
    ctx.arc(cx, cy, (6 + progress * 14) * scale + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Splash in water (or for bay/croc deaths at the goal); squash on land.
function splashes(cause: DeathCause, row: number): boolean {
  if (cause === "vehicle" || cause === "snake") return false;
  if (cause === "time") return isRiverRow(row);
  return true;
}

function drawFrog(ctx: CanvasRenderingContext2D, frame: Frame, palette: FroggerPalette, glow: GlowCache) {
  const { frog, deathCause, deathTimerMs, hazards } = frame;
  const cy = rowCenter(frog.row);
  if (deathCause === null) {
    drawFrogAt(ctx, palette, frog.x, cy, frog.facing, Math.max(0, frog.hopAnimMs) / HOP_ANIM_MS);
    if (hazards.ladyEscorted) drawLadyAt(ctx, palette, glow, frog.x, cy);
    return;
  }
  const progress = Math.min(1, Math.max(0, 1 - deathTimerMs / DEATH_MS));
  if (splashes(deathCause, frog.row)) drawSplash(ctx, palette, frog.x, cy, progress);
  else drawSquash(ctx, palette, frog.x, cy, progress);
}

// ── Bays ────────────────────────────────────────────────────────────────────

function drawFly(ctx: CanvasRenderingContext2D, palette: FroggerPalette, cx: number, cy: number, animClock: number) {
  const flap = Math.sin(animClock * 30) > 0 ? 6 : 3;
  ctx.fillStyle = palette.flyWing;
  ctx.fillRect(cx - 9, cy - flap, 7, flap);
  ctx.fillRect(cx + 2, cy - flap, 7, flap);
  withGlow(ctx, palette.fly, palette.glow.fly, () => {
    ctx.fillStyle = palette.fly;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBayCroc(ctx: CanvasRenderingContext2D, palette: FroggerPalette, cx: number, cy: number, jaws: boolean) {
  if (!jaws) {
    for (const ex of [cx - 8, cx + 8]) {
      ctx.fillStyle = palette.croc;
      ctx.fillRect(ex - 5, cy - 2, 10, 8);
      ctx.fillStyle = palette.crocEye;
      ctx.fillRect(ex - 2, cy, 4, 4);
    }
    return;
  }
  ctx.fillStyle = palette.crocDark;
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - 14);
  ctx.lineTo(cx, cy + 14);
  ctx.lineTo(cx + 24, cy - 14);
  ctx.lineTo(cx + 14, cy - 14);
  ctx.lineTo(cx, cy + 2);
  ctx.lineTo(cx - 14, cy - 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = palette.crocTeeth;
  for (const tx of [-18, -10, 10, 18]) ctx.fillRect(cx + tx - 1, cy - 12, 3, 4);
}

function drawBays(ctx: CanvasRenderingContext2D, frame: Frame, palette: FroggerPalette) {
  const { bays, hazards, animClock } = frame;
  const top = rowTop(GOAL_ROW);
  const cy = rowCenter(GOAL_ROW);
  const flyBay = visibleFlyBay(hazards, bays);
  const croc = bayCrocPhaseOf(hazards, bays);
  BAY_CENTERS.forEach((center, i) => {
    ctx.fillStyle = palette.bayWater;
    ctx.fillRect(center - BAY_WIDTH / 2, top + 2, BAY_WIDTH, CELL - 2);
    if (bays[i]) {
      drawFrogAt(ctx, palette, center, cy, "down");
      return;
    }
    if (croc?.bay === i && croc.phase !== "hidden") {
      drawBayCroc(ctx, palette, center, cy, croc.phase === "jaws");
      return;
    }
    ctx.fillStyle = palette.lily;
    ctx.beginPath();
    ctx.arc(center, cy, 12, 0.25, Math.PI * 2 - 0.25);
    ctx.lineTo(center, cy);
    ctx.fill();
    if (flyBay === i) drawFly(ctx, palette, center, cy, animClock);
  });
}

// ── Lanes ───────────────────────────────────────────────────────────────────

function drawLog(ctx: CanvasRenderingContext2D, palette: FroggerPalette, x: number, y: number, width: number) {
  ctx.fillStyle = palette.log;
  ctx.fillRect(x, y + 6, width, CELL - 12);
  ctx.fillStyle = palette.logRing;
  for (let lx = x + 20; lx < x + width - 10; lx += 40) ctx.fillRect(lx, y + 12, 3, CELL - 24);
  ctx.fillRect(x, y + 6, 4, CELL - 12);
  ctx.fillRect(x + width - 4, y + 6, 4, CELL - 12);
}

function drawRiverCroc(
  ctx: CanvasRenderingContext2D,
  palette: FroggerPalette,
  lane: Lane,
  obj: LaneObject,
  y: number,
  animClock: number,
) {
  const { width, dir } = lane.def;
  const headX = dir > 0 ? obj.x + width - CROC_HEAD_W : obj.x;
  const bodyX = dir > 0 ? obj.x : obj.x + CROC_HEAD_W;
  const bodyW = width - CROC_HEAD_W;

  ctx.fillStyle = palette.croc;
  ctx.fillRect(bodyX, y + 8, bodyW, CELL - 16);
  ctx.fillStyle = palette.crocDark;
  for (let sx = bodyX + 10; sx < bodyX + bodyW - 6; sx += 16) ctx.fillRect(sx, y + 12, 8, 4);

  const open = (animClock % CROC_JAW_ANIM_S) / CROC_JAW_ANIM_S < 0.5;
  const gap = open ? 8 : 2;
  const cy = y + CELL / 2;
  ctx.fillStyle = palette.croc;
  ctx.fillRect(headX, cy - gap / 2 - 8, CROC_HEAD_W, 8);
  ctx.fillRect(headX, cy + gap / 2, CROC_HEAD_W, 8);
  ctx.fillStyle = palette.crocTeeth;
  for (let tx = headX + 4; tx < headX + CROC_HEAD_W - 2; tx += 8) {
    ctx.fillRect(tx, cy - gap / 2, 3, 3);
    ctx.fillRect(tx, cy + gap / 2 - 3, 3, 3);
  }
  ctx.fillStyle = palette.crocEye;
  ctx.fillRect(dir > 0 ? headX + 4 : headX + CROC_HEAD_W - 8, cy - gap / 2 - 12, 4, 4);
}

function drawTurtles(ctx: CanvasRenderingContext2D, palette: FroggerPalette, obj: LaneObject, y: number, width: number) {
  const phase = divePhaseOf(obj);
  const count = Math.round(width / CELL);
  for (let i = 0; i < count; i++) {
    const cx = obj.x + CELL * i + CELL / 2;
    const cy = y + CELL / 2;
    if (phase === "under") {
      ctx.strokeStyle = palette.ripple;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    const radius = phase === "surfaced" ? 15 : 10;
    ctx.globalAlpha = phase === "surfaced" ? 1 : 0.55;
    ctx.fillStyle = palette.turtle;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.turtleShell;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  palette: FroggerPalette,
  glow: GlowCache,
  lane: Lane,
  obj: LaneObject,
  y: number,
) {
  const { width, dir, sprite } = lane.def;
  if (!isVehicleSprite(sprite)) return;
  const color = palette.vehicles[sprite];
  const body = sprite === "truck" ? 26 : 24;
  const top = y + (CELL - body) / 2;
  glow.rect(ctx, obj.x, top, width, body, color, palette.glow.vehicle);

  // Cab / cockpit darker block toward the front.
  const front = dir > 0 ? obj.x + width : obj.x;
  const cabW = sprite === "truck" ? 26 : sprite === "digger" ? 18 : 14;
  ctx.fillStyle = palette.cabShade;
  ctx.fillRect(dir > 0 ? front - cabW - 4 : front + 4, top + 4, cabW, body - 8);

  ctx.fillStyle = palette.headlight;
  const lx = dir > 0 ? front - 3 : front;
  ctx.fillRect(lx, top + 3, 3, 4);
  ctx.fillRect(lx, top + body - 7, 3, 4);
}

function drawLanes(ctx: CanvasRenderingContext2D, palette: FroggerPalette, glow: GlowCache, frame: Frame) {
  for (const lane of frame.lanes) {
    const y = rowTop(lane.def.row);
    for (const obj of lane.objects) {
      if (obj.croc) drawRiverCroc(ctx, palette, lane, obj, y, frame.animClock);
      else if (lane.def.sprite === "log") drawLog(ctx, palette, obj.x, y, lane.def.width);
      else if (lane.def.sprite === "turtles") drawTurtles(ctx, palette, obj, y, lane.def.width);
      else drawVehicle(ctx, palette, glow, lane, obj, y);
    }
  }
}

function drawLadyOnLog(ctx: CanvasRenderingContext2D, frame: Frame, palette: FroggerPalette, glow: GlowCache) {
  const lady = ladyPosition(frame.hazards, frame.lanes);
  if (lady) drawLadyAt(ctx, palette, glow, lady.x, rowCenter(lady.row));
}

// ── Snake ───────────────────────────────────────────────────────────────────

function drawSnake(ctx: CanvasRenderingContext2D, palette: FroggerPalette, snake: Snake | null) {
  if (!snake) return;
  const cy = rowCenter(MEDIAN_ROW);
  withGlow(ctx, palette.snake, palette.glow.snake, () => {
    ctx.strokeStyle = palette.snake;
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const x = snake.x + (SNAKE_W * i) / 8;
      const y = cy + (i % 2 === 0 ? -5 : 5);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
  const headX = snake.dir > 0 ? snake.x + SNAKE_W : snake.x;
  ctx.fillStyle = palette.snakeDark;
  ctx.fillRect(headX - 5, cy - 5, 10, 10);
}

// ── Timer ───────────────────────────────────────────────────────────────────

function drawTimer(ctx: CanvasRenderingContext2D, palette: FroggerPalette, timeLeft: number) {
  const usable = W - 40;
  const width = (Math.max(0, timeLeft) / TIME_PER_FROG) * usable;
  const color =
    timeLeft < TIME_DANGER_S ? palette.timerDanger : timeLeft < TIME_WARN_S ? palette.timerWarn : palette.timerOk;
  withGlow(ctx, color, palette.glow.timer, () => {
    ctx.fillStyle = color;
    ctx.fillRect(20 + usable - width, rowCenter(TIMER_ROW) - 8, width, 16);
  });
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  palette: FroggerPalette,
  glow: GlowCache,
): void {
  ctx.drawImage(cachedBackground(palette), 0, 0);
  drawBays(ctx, frame, palette);
  drawLanes(ctx, palette, glow, frame);
  drawLadyOnLog(ctx, frame, palette, glow);
  drawSnake(ctx, palette, frame.hazards.snake);
  drawFrog(ctx, frame, palette, glow);
  drawTimer(ctx, palette, frame.timeLeft);
}
