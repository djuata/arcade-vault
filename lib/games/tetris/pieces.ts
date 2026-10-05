import { collide, type Board, type Piece, type Shape } from "./board";
import { COLS, WALL_KICKS } from "./constants";

// Index + 1 is the piece type, which also indexes COLORS.
const SHAPES: readonly Shape[] = [
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[2, 2], [2, 2]], // O
  [[0, 3, 0], [3, 3, 3], [0, 0, 0]], // T
  [[0, 4, 4], [4, 4, 0], [0, 0, 0]], // S
  [[5, 5, 0], [0, 5, 5], [0, 0, 0]], // Z
  [[6, 0, 0], [6, 6, 6], [0, 0, 0]], // J
  [[0, 0, 7], [7, 7, 7], [0, 0, 0]], // L
  [[8, 8, 8], [8, 0, 8], [8, 8, 8]], // N (nut)
];

export function randomPiece(): Piece {
  const index = Math.floor(Math.random() * SHAPES.length);
  const shape = SHAPES[index].map((row) => [...row]);
  return { type: index + 1, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

export function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  }
  return result;
}

/** Rotates clockwise trying the wall kicks in order; leaves the piece untouched if none fits. */
export function tryRotate(board: Board, piece: Piece): void {
  const rotated = rotateCW(piece.shape);
  for (const kick of WALL_KICKS) {
    if (!collide(board, rotated, piece.x + kick, piece.y)) {
      piece.shape = rotated;
      piece.x += kick;
      return;
    }
  }
}

/** Row where the piece would land if dropped straight down. */
export function ghostRow(board: Board, piece: Piece): number {
  let row = piece.y;
  while (!collide(board, piece.shape, piece.x, row + 1)) row++;
  return row;
}
