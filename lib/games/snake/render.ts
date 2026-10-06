import type { Cell, Direction, Fruit } from "./board";
import { CELL, H, W } from "./constants";
import { FALLBACK_COLORS, FRUIT_SPRITES } from "./sprites";

export interface Frame {
  snake: readonly Cell[];
  fruit: Fruit | null;
  direction: Direction;
  sheet: HTMLImageElement | null;
}

const BOARD_DARK = "#0a0a18";
const BOARD_LIGHT = "#10102a";
const BODY_COLOR = "#2bff88";
const HEAD_COLOR = "#b6ffd0";
const FRUIT_MARGIN = 4;
const BODY_INSET = 3;

function drawBoard(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BOARD_DARK;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = BOARD_LIGHT;
  for (let row = 0; row < H / CELL; row++) {
    for (let col = 0; col < W / CELL; col++) {
      if ((col + row) % 2 === 0) ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
  }
}

function drawEyes(ctx: CanvasRenderingContext2D, head: Cell, direction: Direction) {
  const cx = head.col * CELL + CELL / 2;
  const cy = head.row * CELL + CELL / 2;
  const forward = 8;
  const side = 8;
  const vertical = direction === "up" || direction === "down";
  const sign = direction === "down" || direction === "right" ? 1 : -1;
  ctx.fillStyle = "#0a0a18";
  for (const offset of [-side, side]) {
    const ex = vertical ? cx + offset : cx + sign * forward;
    const ey = vertical ? cy + sign * forward : cy + offset;
    ctx.beginPath();
    ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSnake(ctx: CanvasRenderingContext2D, snake: readonly Cell[], direction: Direction) {
  const size = CELL - BODY_INSET * 2;
  snake.forEach((part, i) => {
    ctx.fillStyle = i === 0 ? HEAD_COLOR : BODY_COLOR;
    ctx.beginPath();
    ctx.roundRect(part.col * CELL + BODY_INSET, part.row * CELL + BODY_INSET, size, size, 8);
    ctx.fill();
  });
  drawEyes(ctx, snake[0], direction);
}

function drawFruit(ctx: CanvasRenderingContext2D, fruit: Fruit, sheet: HTMLImageElement | null) {
  const box = CELL - FRUIT_MARGIN * 2;
  const originX = fruit.col * CELL + FRUIT_MARGIN;
  const originY = fruit.row * CELL + FRUIT_MARGIN;
  if (!sheet) {
    ctx.fillStyle = FALLBACK_COLORS[fruit.kind];
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

export function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame) {
  drawBoard(ctx);
  if (frame.fruit) drawFruit(ctx, frame.fruit, frame.sheet);
  drawSnake(ctx, frame.snake, frame.direction);
}
