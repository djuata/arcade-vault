// Template: lib/games/<slug>/engine.ts
// Replace `MyGame` / `<slug>`; keep the lifecycle and callback contract untouched.
// Pure TypeScript: no React, no next/*.

import type { GameEngineFactory } from "../types";
import { H, INITIAL_LIVES, MAX_DT, W } from "./constants";
import { createInput } from "./input";

type GameState = "playing" | "gameover";

export const createMyGame: GameEngineFactory = (canvas, callbacks) => {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) throw new Error("MyGame: 2D canvas context is not available");
  const ctx: CanvasRenderingContext2D = maybeCtx;
  canvas.width = W;
  canvas.height = H;

  // Game state lives in this closure. No module-level mutable state.
  let score = 0;
  let lives = INITIAL_LIVES;
  let level = 1;
  let state: GameState = "playing";

  let paused = false;
  let destroyed = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const input = createInput(() => !paused && state !== "gameover");

  // ── State ───────────────────────────────────────────────────────────────────

  // Callbacks fire only when the value changes. Scores must be integers.
  function addScore(points: number) {
    const gained = Math.round(points);
    if (gained === 0) return;
    score += gained;
    callbacks.onScore(score);
  }

  function loseLife() {
    lives--;
    callbacks.onLives(lives);
    if (lives <= 0) {
      state = "gameover";
      callbacks.onGameOver(score); // exactly once per game, immediately
    }
  }

  function initGame() {
    score = 0;
    lives = INITIAL_LIVES;
    level = 1;
    state = "playing";
    // TODO: reset entities
    callbacks.onScore(score);
    callbacks.onLives(lives);
    callbacks.onLevel(level);
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  function update(dt: number) {
    if (state === "gameover") return;
    // TODO: read input (input.keys / input.pressed), advance entities with dt,
    // resolve collisions, call addScore / loseLife / level up.
    void dt;
  }

  // ── Draw: only the game. HUD and GAME OVER belong to the platform. ──────────

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    // TODO: draw entities
  }

  // ── Loop & lifecycle ────────────────────────────────────────────────────────

  function frame(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    update(dt);
    draw();
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
      if (destroyed) return; // idempotent
      destroyed = true;
      stopLoop();
      input.detach();
    },
  };
};
