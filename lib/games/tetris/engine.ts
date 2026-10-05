import type { GameEngineFactory } from "../types";
import { clearFullRows, collide, createBoard, merge } from "./board";
import {
  BASE_DROP_INTERVAL,
  DROP_INTERVAL_STEP,
  H,
  HARD_DROP_POINTS,
  LINES_PER_LEVEL,
  LINE_SCORES,
  MAX_DT,
  MIN_DROP_INTERVAL,
  SOFT_DROP_POINTS,
  W,
} from "./constants";
import { createInput } from "./input";
import { ghostRow, randomPiece, tryRotate } from "./pieces";
import { drawFrame } from "./render";

type GameState = "playing" | "gameover";

// Move, rotate and soft drop act on every keydown, OS auto-repeat included (as in the original).
// Space (hard drop) is deliberately a single press: holding it would chain drops.
const REPEAT_KEYS: ReadonlySet<string> = new Set(["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "KeyX"]);
const CAPTURE_KEYS: ReadonlySet<string> = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

export const createTetrisGame: GameEngineFactory = (canvas, callbacks) => {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) throw new Error("Tetris: 2D canvas context is not available");
  const ctx: CanvasRenderingContext2D = maybeCtx;
  canvas.width = W;
  canvas.height = H;

  let board = createBoard();
  let current = randomPiece();
  let next = randomPiece();
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropInterval = BASE_DROP_INTERVAL;
  let dropAccum = 0;
  let state: GameState = "playing";

  let paused = false;
  let destroyed = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const input = createInput(() => !paused && state !== "gameover", CAPTURE_KEYS, REPEAT_KEYS);

  // ── State ───────────────────────────────────────────────────────────────────

  // Reads the live state: TS can't see that input handlers may end the game.
  function isGameOver(): boolean {
    return state === "gameover";
  }

  function addScore(points: number) {
    if (points === 0) return;
    score += points;
    callbacks.onScore(score);
  }

  function endGame() {
    if (isGameOver()) return;
    state = "gameover";
    callbacks.onGameOver(score); // exactly once per game
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(board, current.shape, current.x, current.y)) endGame();
  }

  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = BASE_DROP_INTERVAL;
    dropAccum = 0;
    state = "playing";
    next = randomPiece();
    spawn();
    callbacks.onScore(score);
    callbacks.onLevel(level);
  }

  function lockPiece() {
    merge(board, current);
    const cleared = clearFullRows(board);
    if (cleared > 0) {
      lines += cleared;
      addScore((LINE_SCORES[cleared] || 0) * level); // scored with the level before it rises
      const newLevel = Math.floor(lines / LINES_PER_LEVEL) + 1;
      dropInterval = Math.max(MIN_DROP_INTERVAL, BASE_DROP_INTERVAL - (newLevel - 1) * DROP_INTERVAL_STEP);
      if (newLevel !== level) {
        level = newLevel;
        callbacks.onLevel(level);
      }
    }
    spawn();
  }

  function softDrop() {
    if (collide(board, current.shape, current.x, current.y + 1)) {
      lockPiece();
      return;
    }
    current.y++;
    addScore(SOFT_DROP_POINTS);
  }

  function hardDrop() {
    const row = ghostRow(board, current);
    addScore((row - current.y) * HARD_DROP_POINTS);
    current.y = row;
    lockPiece();
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  // Consumes every code so no stale press is left behind by short-circuiting.
  function pressedAny(...codes: string[]): boolean {
    return codes.map((code) => input.pressed(code)).some(Boolean);
  }

  function handleInput() {
    if (input.pressed("ArrowLeft") && !collide(board, current.shape, current.x - 1, current.y)) current.x--;
    if (input.pressed("ArrowRight") && !collide(board, current.shape, current.x + 1, current.y)) current.x++;
    if (input.pressed("ArrowDown")) softDrop();
    if (isGameOver()) return;
    if (pressedAny("ArrowUp", "KeyX")) tryRotate(board, current);
    if (input.pressed("Space")) hardDrop();
  }

  function update(dt: number) {
    if (isGameOver()) return;
    handleInput();
    if (isGameOver()) return;

    dropAccum += dt * 1000;
    if (dropAccum < dropInterval) return;
    dropAccum = 0;
    if (collide(board, current.shape, current.x, current.y + 1)) lockPiece();
    else current.y++;
  }

  // ── Loop & lifecycle ────────────────────────────────────────────────────────

  function frame(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    update(dt);
    drawFrame(ctx, { board, current, next, lines });
    rafId = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (destroyed || rafId !== null) return;
    lastTime = null; // avoids a dt jump after pause
    rafId = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  input.attach();
  initGame();
  startLoop();

  return {
    pause() {
      if (destroyed || paused) return;
      paused = true;
      stopLoop();
    },
    resume() {
      if (destroyed || !paused) return;
      paused = false;
      input.clearPressed();
      startLoop();
    },
    restart() {
      if (destroyed) return;
      initGame();
      paused = false;
      input.clearPressed();
      startLoop();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      input.detach();
    },
  };
};
