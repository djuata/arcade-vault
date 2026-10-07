import type { Cell, Direction, Fruit } from "./board";
import { CELL, H, W } from "./constants";
import type { Glow, SnakePalette } from "./skins";
import { FRUIT_SPRITES } from "./sprites";

export interface Frame {
  snake: readonly Cell[];
  fruit: Fruit | null;
  direction: Direction;
  sheet: HTMLImageElement | HTMLCanvasElement | null;
}

const FRUIT_MARGIN = 4;
const BODY_INSET = 3;

// Applies the glow only around `draw` and always resets it, so it never leaks.
function withGlow(ctx: CanvasRenderingContext2D, glow: Glow | null, draw: () => void) {
  if (glow) {
    ctx.shadowColor = glow.color;
    ctx.shadowBlur = glow.blur;
  }
  draw();
  ctx.shadowBlur = 0;
}

function drawBoard(ctx: CanvasRenderingContext2D, palette: SnakePalette) {
  ctx.fillStyle = palette.boardDark;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = palette.boardLight;
  for (let row = 0; row < H / CELL; row++) {
    for (let col = 0; col < W / CELL; col++) {
      if ((col + row) % 2 === 0) ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
  }
}

function drawEyes(ctx: CanvasRenderingContext2D, head: Cell, direction: Direction, palette: SnakePalette) {
  const cx = head.col * CELL + CELL / 2;
  const cy = head.row * CELL + CELL / 2;
  const forward = 8;
  const side = 8;
  const vertical = direction === "up" || direction === "down";
  const sign = direction === "down" || direction === "right" ? 1 : -1;
  ctx.fillStyle = palette.eyes;
  for (const offset of [-side, side]) {
    const ex = vertical ? cx + offset : cx + sign * forward;
    const ey = vertical ? cy + sign * forward : cy + offset;
    ctx.beginPath();
    ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSegment(ctx: CanvasRenderingContext2D, part: Cell, color: string) {
  const size = CELL - BODY_INSET * 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(part.col * CELL + BODY_INSET, part.row * CELL + BODY_INSET, size, size, 8);
  ctx.fill();
}

function drawSnake(
  ctx: CanvasRenderingContext2D,
  snake: readonly Cell[],
  direction: Direction,
  palette: SnakePalette,
) {
  withGlow(ctx, palette.headGlow, () => drawSegment(ctx, snake[0], palette.head));
  for (let i = 1; i < snake.length; i++) drawSegment(ctx, snake[i], palette.body);
  drawEyes(ctx, snake[0], direction, palette);
}

function drawFruit(
  ctx: CanvasRenderingContext2D,
  fruit: Fruit,
  sheet: HTMLImageElement | HTMLCanvasElement | null,
  palette: SnakePalette,
) {
  const box = CELL - FRUIT_MARGIN * 2;
  const originX = fruit.col * CELL + FRUIT_MARGIN;
  const originY = fruit.row * CELL + FRUIT_MARGIN;
  if (!sheet) {
    ctx.fillStyle = palette.fruitFallback[fruit.kind];
    ctx.beginPath();
    ctx.arc(originX + box / 2, originY + box / 2, box / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const sprite = FRUIT_SPRITES[fruit.kind];
  const scale = Math.min(box / sprite.w, box / sprite.h); // keep aspect ratio
  const dw = sprite.w * scale;
  const dh = sprite.h * scale;
  ctx.drawImage(
    sheet,
    sprite.x,
    sprite.y,
    sprite.w,
    sprite.h,
    originX + (box - dw) / 2,
    originY + (box - dh) / 2,
    dw,
    dh,
  );
}

export function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame, palette: SnakePalette) {
  drawBoard(ctx, palette);
  if (frame.fruit) {
    const fruit = frame.fruit;
    withGlow(ctx, palette.fruitGlow, () => drawFruit(ctx, fruit, frame.sheet, palette));
  }
  drawSnake(ctx, frame.snake, frame.direction, palette);
}
