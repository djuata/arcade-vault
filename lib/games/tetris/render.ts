import type { Board, Piece } from "./board";
import { ghostRow } from "./pieces";
import { BLOCK, BOARD_X, COLORS, COLS, H, NEXT_BOX, PANEL_X, ROWS, W } from "./constants";

export interface Frame {
  board: Board;
  current: Piece;
  next: Piece;
  lines: number;
}

function drawBlock(ctx: CanvasRenderingContext2D, px: number, py: number, colorIndex: number, alpha = 1) {
  const color = COLORS[colorIndex];
  if (!colorIndex || !color) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, BLOCK - 2, BLOCK - 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(px + 1, py + 1, BLOCK - 2, 4);
  ctx.globalAlpha = 1;
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let c = 1; c < COLS; c++) {
    ctx.moveTo(BOARD_X + c * BLOCK, 0);
    ctx.lineTo(BOARD_X + c * BLOCK, ROWS * BLOCK);
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.moveTo(BOARD_X, r * BLOCK);
    ctx.lineTo(BOARD_X + COLS * BLOCK, r * BLOCK);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(BOARD_X - 0.5, 0.5, COLS * BLOCK + 1, ROWS * BLOCK - 1);
}

function drawPiece(ctx: CanvasRenderingContext2D, piece: Piece, row: number, alpha = 1) {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c]) {
        drawBlock(ctx, BOARD_X + (piece.x + c) * BLOCK, (row + r) * BLOCK, piece.shape[r][c], alpha);
      }
    }
  }
}

function drawNext(ctx: CanvasRenderingContext2D, next: Piece) {
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(PANEL_X + 0.5, 40.5, NEXT_BOX, NEXT_BOX);
  const { shape } = next;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      drawBlock(ctx, PANEL_X + (offX + c) * BLOCK, 40 + (offY + r) * BLOCK, shape[r][c]);
    }
  }
}

function drawLabelValue(ctx: CanvasRenderingContext2D, label: string, value: string, y: number) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "15px monospace";
  ctx.fillStyle = "#fff";
  ctx.fillText(label, PANEL_X, y);
  ctx.font = "26px monospace";
  ctx.fillStyle = "#0ff";
  ctx.fillText(value, PANEL_X, y + 34);
}

/** Draws only the game: board, ghost, piece and the NEXT / LINES indicators. */
export function drawFrame(ctx: CanvasRenderingContext2D, { board, current, next, lines }: Frame) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  drawGrid(ctx);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) drawBlock(ctx, BOARD_X + c * BLOCK, r * BLOCK, board[r][c]);
  }

  drawPiece(ctx, current, ghostRow(board, current), 0.2);
  drawPiece(ctx, current, current.y);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "15px monospace";
  ctx.fillStyle = "#fff";
  ctx.fillText("NEXT", PANEL_X, 28);
  drawNext(ctx, next);
  drawLabelValue(ctx, "LINES", String(lines), 220);
}
