import {
  COLS,
  FRUITS_PER_LEVEL,
  INITIAL_LENGTH,
  ROWS,
  START_CELL,
  TICK_MIN_MS,
  TICK_START_MS,
  TICK_STEP_MS,
} from "./constants";
import { FRUIT_KEYS, type FruitKey } from "./sprites";

export type Direction = "up" | "down" | "left" | "right";

export interface Cell {
  col: number;
  row: number;
}

export interface Fruit extends Cell {
  kind: FruitKey;
}

const DELTAS: Readonly<Record<Direction, Cell>> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

const OPPOSITES: Readonly<Record<Direction, Direction>> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

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

// snake[0] is the head, body extends to the left.
export function createSnake(): Cell[] {
  return Array.from({ length: INITIAL_LENGTH }, (_, i) => ({
    col: START_CELL.col - i,
    row: START_CELL.row,
  }));
}

export function nextHead(head: Cell, dir: Direction): Cell {
  const d = DELTAS[dir];
  return { col: head.col + d.col, row: head.row + d.row };
}

export function isOpposite(a: Direction, b: Direction): boolean {
  return OPPOSITES[a] === b;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.col === b.col && a.row === b.row;
}

export function hitsWall(cell: Cell): boolean {
  return cell.col < 0 || cell.col >= COLS || cell.row < 0 || cell.row >= ROWS;
}

// When the snake doesn't grow its tail leaves its cell this tick, so it is free.
export function hitsBody(cell: Cell, snake: readonly Cell[], willGrow: boolean): boolean {
  const body = willGrow ? snake : snake.slice(0, -1);
  return body.some((part) => sameCell(part, cell));
}

export function pickFreeCell(snake: readonly Cell[], rng: () => number = Math.random): Cell | null {
  const taken = new Set(snake.map((c) => c.row * COLS + c.col));
  const free: Cell[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!taken.has(row * COLS + col)) free.push({ col, row });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(rng() * free.length)];
}

export function pickFruit(snake: readonly Cell[], rng: () => number = Math.random): Fruit | null {
  const cell = pickFreeCell(snake, rng);
  if (!cell) return null;
  return { ...cell, kind: FRUIT_KEYS[Math.floor(rng() * FRUIT_KEYS.length)] };
}

export function levelFor(fruits: number): number {
  return Math.floor(fruits / FRUITS_PER_LEVEL) + 1;
}

export function tickIntervalFor(fruits: number): number {
  const interval = TICK_START_MS - (levelFor(fruits) - 1) * TICK_STEP_MS;
  return Math.max(TICK_MIN_MS, interval);
}
