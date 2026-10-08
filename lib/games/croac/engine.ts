import type { GameEngineFactory } from "../types";
import {
  BAY_CENTERS,
  DEATH_MS,
  GOAL_ROW,
  H,
  HOME_POINTS,
  LEVEL_CLEAR_POINTS,
  LIVES,
  MAX_DT,
  MAX_QUEUED_HOPS,
  RIVER_FIRST_ROW,
  START_ROW,
  START_X,
  STEP_POINTS,
  TIME_PER_FROG,
  W,
} from "./constants";
import { createInput } from "./input";
import { advanceDiveClocks, createLanes, moveLanes, type Lane } from "./lanes";
import { drawFrame } from "./render";
import {
  type DeathCause,
  type Direction,
  type Frog,
  KEY_DIRECTIONS,
  bayIndexAt,
  deathCauseFor,
  isRiverRow,
  laneAt,
  timeBonusFor,
  tryHop,
} from "./rules";

type GameState = "playing" | "dying" | "gameover";

const newFrog = (): Frog => ({ x: START_X, row: START_ROW, facing: "up", hopAnimMs: 0 });
const emptyBays = () => BAY_CENTERS.map(() => false);

export const createCroacGame: GameEngineFactory = (canvas, callbacks) => {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) throw new Error("Croac: 2D canvas context is not available");
  const ctx: CanvasRenderingContext2D = maybeCtx;
  canvas.width = W;
  canvas.height = H;

  let lanes: Lane[] = [];
  let bays: boolean[] = emptyBays();
  let frog: Frog = newFrog();
  let bestRow = START_ROW; // lowest row number reached by the current frog
  let timeLeft = TIME_PER_FROG;
  let lives = LIVES;
  let score = 0;
  let level = 1;
  let deathCause: DeathCause | null = null;
  let deathTimerMs = 0;
  let hopQueue: Direction[] = [];
  let state: GameState = "playing";

  let paused = false;
  let destroyed = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const input = createInput(() => !paused && state !== "gameover", enqueueHop);

  // ── Emitters (only on change) ───────────────────────────────────────────────

  function setScore(value: number) {
    if (value === score) return;
    score = value;
    callbacks.onScore(score);
  }

  function setLevel(value: number) {
    if (value === level) return;
    level = value;
    callbacks.onLevel(level);
  }

  // ── State ───────────────────────────────────────────────────────────────────

  function enqueueHop(code: string) {
    const dir = KEY_DIRECTIONS[code];
    if (!dir || state !== "playing" || hopQueue.length >= MAX_QUEUED_HOPS) return;
    hopQueue.push(dir);
  }

  function respawnFrog() {
    frog = newFrog();
    bestRow = START_ROW;
    timeLeft = TIME_PER_FROG;
    hopQueue = [];
    deathCause = null;
    deathTimerMs = 0;
    state = "playing";
  }

  function initGame() {
    lanes = createLanes(1);
    bays = emptyBays();
    lives = LIVES;
    score = 0;
    level = 1;
    respawnFrog();
    callbacks.onScore(score);
    callbacks.onLevel(level);
    callbacks.onLives?.(lives);
  }

  function endGame() {
    if (state === "gameover") return;
    state = "gameover";
    callbacks.onGameOver(score); // exactly once per game
  }

  function killFrog(cause: DeathCause) {
    if (state !== "playing") return;
    state = "dying";
    deathCause = cause;
    deathTimerMs = DEATH_MS;
    hopQueue = [];
    lives -= 1;
    callbacks.onLives?.(lives);
    if (lives === 0) endGame();
  }

  function homeFrog(bayIndex: number) {
    bays[bayIndex] = true;
    let gained = HOME_POINTS + timeBonusFor(timeLeft);
    if (bays.every(Boolean)) {
      gained += LEVEL_CLEAR_POINTS;
      setLevel(level + 1);
      bays = emptyBays();
      lanes = createLanes(level);
    }
    setScore(score + gained);
    respawnFrog();
  }

  // Applies one queued hop. Returns false when the hop ended the frog's run (home or bay death).
  function applyHop(): boolean {
    const dir = hopQueue.shift();
    if (!dir) return true;
    const next = tryHop(frog, dir);
    if (!next) return true;

    if (next.row === GOAL_ROW) {
      const bay = bayIndexAt(next.x, bays);
      if (bay !== null) {
        homeFrog(bay);
      } else {
        frog = next;
        killFrog("bay");
      }
      return false;
    }

    frog = next;
    if (frog.row >= RIVER_FIRST_ROW && frog.row < bestRow) {
      bestRow = frog.row;
      setScore(score + STEP_POINTS);
    }
    return true;
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  function updatePlaying(dt: number) {
    if (!applyHop()) return;
    moveLanes(lanes, dt);
    advanceDiveClocks(lanes, dt);

    const lane = laneAt(lanes, frog.row);
    if (lane && isRiverRow(frog.row)) frog.x += lane.vx * dt;

    const cause = deathCauseFor(frog, lanes, timeLeft);
    if (cause) {
      killFrog(cause);
      return;
    }
    timeLeft = Math.max(0, timeLeft - dt);
  }

  // The world keeps moving while the frog's death animation plays.
  function updateDying(dt: number) {
    moveLanes(lanes, dt);
    advanceDiveClocks(lanes, dt);
    deathTimerMs -= dt * 1000;
    if (state === "dying" && deathTimerMs <= 0) respawnFrog();
  }

  function update(dt: number) {
    frog.hopAnimMs = Math.max(0, frog.hopAnimMs - dt * 1000);
    if (state === "playing") updatePlaying(dt);
    else updateDying(dt);
  }

  function render() {
    drawFrame(ctx, { lanes, bays, frog, deathCause, deathTimerMs, timeLeft });
  }

  // ── Loop & lifecycle ────────────────────────────────────────────────────────

  function frame(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    update(dt);
    render();
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
      hopQueue = [];
      startLoop();
    },
    restart() {
      if (destroyed) return;
      initGame();
      paused = false;
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
