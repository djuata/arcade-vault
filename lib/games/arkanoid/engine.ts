import type { GameEngineFactory } from "../types";
import {
  BALL_SIZE,
  BASE_BALL_VX,
  BASE_BALL_VY,
  BLOCKS_ORIGIN_X,
  BLOCKS_ORIGIN_Y,
  BLOCK_H,
  BLOCK_POINTS,
  BLOCK_W,
  EXPLOSION_DURATION,
  H,
  INITIAL_LIVES,
  LAST_LEVEL,
  MAX_DT,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
  W,
} from "./constants";
import type { Ball, Block, Explosion, Rect } from "./entities";
import { createInput } from "./input";
import { LEVELS } from "./levels";
import { drawFrame } from "./render";
import { SPRITESHEET_URL } from "./sprites";

type GameState = "playing" | "gameover";

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export const createArkanoidGame: GameEngineFactory = (canvas, callbacks) => {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) throw new Error("Arkanoid: 2D canvas context is not available");
  const ctx: CanvasRenderingContext2D = maybeCtx;
  canvas.width = W;
  canvas.height = H;

  const paddle: Rect = { x: 0, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
  const ball: Ball = { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: 0, vy: 0 };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let score = 0;
  let lives = INITIAL_LIVES;
  let level = 1;
  let state: GameState = "playing";

  let sheet: HTMLImageElement | null = null;
  let paused = false;
  let destroyed = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const input = createInput(() => !paused && state !== "gameover");

  const image = new Image();
  image.onload = () => {
    if (!destroyed) sheet = image;
  };
  image.src = SPRITESHEET_URL;

  // ── State ───────────────────────────────────────────────────────────────────

  // Reads the live state: TS can't see that update steps may end the game.
  function isGameOver(): boolean {
    return state === "gameover";
  }

  function addScore(points: number) {
    score += points;
    callbacks.onScore(score);
  }

  function endGame() {
    if (isGameOver()) return;
    state = "gameover";
    callbacks.onGameOver(score); // exactly once per game
  }

  function clampPaddle(x: number): number {
    return Math.max(0, Math.min(W - paddle.w, x));
  }

  function placeBall() {
    const speed = LEVELS[level - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    level = n;
    blocks = LEVELS[n - 1].blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    placeBall();
  }

  function initGame() {
    score = 0;
    lives = INITIAL_LIVES;
    state = "playing";
    paddle.x = (W - paddle.w) / 2;
    loadLevel(1);
    callbacks.onScore(score);
    callbacks.onLives?.(lives);
    callbacks.onLevel(level);
  }

  function advanceLevel() {
    if (level >= LAST_LEVEL) {
      endGame();
      return;
    }
    loadLevel(level + 1);
    callbacks.onLevel(level);
  }

  function loseLife() {
    lives--;
    callbacks.onLives?.(lives);
    if (lives <= 0) endGame();
    else placeBall();
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  function movePaddle(dt: number) {
    if (input.keys.ArrowLeft) paddle.x = clampPaddle(paddle.x - PADDLE_SPEED * dt);
    if (input.keys.ArrowRight) paddle.x = clampPaddle(paddle.x + PADDLE_SPEED * dt);
  }

  function bounceOffWalls() {
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }
  }

  function bounceOffPaddle() {
    const touchesPaddle =
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8;
    if (!touchesPaddle) return;
    ball.y = paddle.y - ball.h;
    ball.vy = -Math.abs(ball.vy);
  }

  // One block per frame and always flips `vy`: rules of the original, kept 1:1.
  function breakBlocks() {
    const hit = blocks.find((b) => b.alive && overlaps(ball, b));
    if (!hit) return;
    hit.alive = false;
    explosions.push({ x: hit.x, y: hit.y, w: hit.w, h: hit.h, color: hit.color, elapsed: 0 });
    addScore(BLOCK_POINTS);
    ball.vy = -ball.vy;
    if (blocks.every((b) => !b.alive)) advanceLevel();
  }

  function tickExplosions(dt: number) {
    for (const explosion of explosions) explosion.elapsed += dt * 1000;
    explosions = explosions.filter((e) => e.elapsed < EXPLOSION_DURATION);
  }

  function update(dt: number) {
    if (isGameOver()) return;
    movePaddle(dt);
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    bounceOffWalls();
    bounceOffPaddle();
    breakBlocks();
    if (isGameOver()) return;
    tickExplosions(dt);
    if (ball.y > H) loseLife();
  }

  // The mouse centers the paddle under the cursor; ignored while paused or over.
  function onMouseMove(e: MouseEvent) {
    if (paused || isGameOver()) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    paddle.x = clampPaddle(mouseX - paddle.w / 2);
  }

  // ── Loop & lifecycle ────────────────────────────────────────────────────────

  function frame(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    update(dt);
    drawFrame(ctx, { blocks, explosions, paddle, ball, sheet });
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
  canvas.addEventListener("mousemove", onMouseMove);
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
      canvas.removeEventListener("mousemove", onMouseMove);
      image.onload = null;
    },
  };
};
