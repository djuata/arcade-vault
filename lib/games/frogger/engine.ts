import { createGlowCache } from "../glow-cache";
import { resolveSkin } from "../skins";
import type { GameEngineFactory } from "../types";
import {
  BAY_COUNT,
  DEATH_MS,
  EXTRA_LIFE_AT,
  FLY_POINTS,
  GOAL_ROW,
  H,
  HOME_POINTS,
  LADY_POINTS,
  LEVEL_CLEAR_POINTS,
  LIVES,
  MAX_DT,
  MAX_LIVES,
  MAX_QUEUED_HOPS,
  RIVER_FIRST_ROW,
  START_ROW,
  START_X,
  STEP_POINTS,
  TIME_PER_FROG,
  W,
} from "./constants";
import {
  clearFly,
  createHazards,
  endLadyEscort,
  moveSnake,
  scareBayCroc,
  stepBayCroc,
  stepFly,
  stepLady,
  tryPickUpLady,
  type Hazards,
} from "./hazards";
import { createInput } from "./input";
import { advanceDiveClocks, createLanes, moveLanes, type Lane } from "./lanes";
import { drawFrame } from "./render";
import {
  type DeathCause,
  type Direction,
  type Frog,
  KEY_DIRECTIONS,
  bayEntryFor,
  deathCauseFor,
  isRiverRow,
  laneAt,
  timeBonusFor,
  tryHop,
} from "./rules";
import { FROGGER_SKINS, type FroggerPalette } from "./skins";

type GameState = "playing" | "dying" | "gameover";

const newFrog = (): Frog => ({ x: START_X, row: START_ROW, facing: "up", hopAnimMs: 0 });
const emptyBays = () => Array.from({ length: BAY_COUNT }, () => false);

export const createFroggerGame: GameEngineFactory = (canvas, callbacks, options) => {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) throw new Error("Frogger: 2D canvas context is not available");
  const ctx: CanvasRenderingContext2D = maybeCtx;
  canvas.width = W;
  canvas.height = H;

  let lanes: Lane[] = [];
  let bays: boolean[] = emptyBays();
  let hazards: Hazards = createHazards(1);
  let frog: Frog = newFrog();
  let bestRow = START_ROW; // lowest row number reached by the current frog
  let timeLeft = TIME_PER_FROG;
  let lives = LIVES;
  let extraLifeGiven = false;
  let score = 0;
  let level = 1;
  let deathCause: DeathCause | null = null;
  let deathTimerMs = 0;
  let hopQueue: Direction[] = [];
  let animClock = 0;
  let state: GameState = "playing";

  let palette: FroggerPalette = resolveSkin(FROGGER_SKINS, options?.skin);
  const glow = createGlowCache();
  let paused = false;
  let destroyed = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const input = createInput(() => !paused && state !== "gameover", enqueueHop);

  // ── Emitters (only on change) ───────────────────────────────────────────────

  function setLevel(value: number) {
    if (value === level) return;
    level = value;
    callbacks.onLevel(level);
  }

  function setLives(value: number) {
    if (value === lives) return;
    lives = value;
    callbacks.onLives?.(lives);
  }

  function addScore(points: number) {
    if (points === 0) return;
    score += points;
    callbacks.onScore(score);
    checkExtraLife();
  }

  function checkExtraLife() {
    if (extraLifeGiven || score < EXTRA_LIFE_AT) return;
    extraLifeGiven = true;
    if (lives < MAX_LIVES) setLives(lives + 1);
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
    hazards = createHazards(1);
    lives = LIVES;
    extraLifeGiven = false;
    score = 0;
    level = 1;
    animClock = 0;
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
    if (hazards.ladyEscorted) endLadyEscort(hazards);
    lives -= 1;
    callbacks.onLives?.(lives); // emitted on every death, including the one that leaves 0
    if (lives === 0) endGame();
  }

  function levelUp() {
    setLevel(level + 1);
    bays = emptyBays();
    lanes = createLanes(level);
    hazards = createHazards(level);
  }

  function homeFrog(index: number, fly: boolean) {
    const lady = hazards.ladyEscorted;
    bays[index] = true;
    let gained = HOME_POINTS + timeBonusFor(timeLeft);
    if (fly) {
      gained += FLY_POINTS;
      clearFly(hazards);
    }
    if (lady) {
      gained += LADY_POINTS;
      endLadyEscort(hazards);
    }
    if (hazards.bayCrocBay === index) scareBayCroc(hazards);
    if (bays.every(Boolean)) {
      gained += LEVEL_CLEAR_POINTS;
      levelUp();
    }
    addScore(gained);
    respawnFrog();
  }

  // Applies one queued hop. Returns false when the hop ended the frog's run (home or bay death).
  function applyHop(): boolean {
    const dir = hopQueue.shift();
    if (!dir) return true;
    const next = tryHop(frog, dir);
    if (!next) return true;

    if (next.row === GOAL_ROW) {
      const entry = bayEntryFor(next.x, bays, hazards);
      if (entry.kind === "home") {
        homeFrog(entry.index, entry.fly);
      } else {
        frog = next;
        killFrog(entry.cause);
      }
      return false;
    }

    frog = next;
    if (frog.row >= RIVER_FIRST_ROW && frog.row < bestRow) {
      bestRow = frog.row;
      addScore(STEP_POINTS);
    }
    return true;
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  function moveWorld(dt: number) {
    moveLanes(lanes, dt);
    advanceDiveClocks(lanes, dt);
    moveSnake(hazards, dt, level);
  }

  function updatePlaying(dt: number) {
    if (!applyHop()) return;
    moveWorld(dt);
    stepFly(hazards, dt, bays);
    stepBayCroc(hazards, dt, bays);
    stepLady(hazards, dt);

    const lane = laneAt(lanes, frog.row);
    if (lane && isRiverRow(frog.row)) frog.x += lane.vx * dt;
    tryPickUpLady(hazards, frog, lanes);

    const cause = deathCauseFor(frog, lanes, hazards, timeLeft);
    if (cause) {
      killFrog(cause);
      return;
    }
    timeLeft = Math.max(0, timeLeft - dt);
  }

  // Lanes and the snake keep moving during the death animation; hazard clocks and the timer freeze.
  function updateDying(dt: number) {
    moveWorld(dt);
    deathTimerMs -= dt * 1000;
    if (state === "dying" && deathTimerMs <= 0) respawnFrog();
  }

  function update(dt: number) {
    animClock += dt;
    frog.hopAnimMs = Math.max(0, frog.hopAnimMs - dt * 1000);
    if (state === "playing") updatePlaying(dt);
    else updateDying(dt);
  }

  function render() {
    drawFrame(ctx, { lanes, bays, frog, hazards, deathCause, deathTimerMs, timeLeft, animClock }, palette, glow);
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
    setSkin(id) {
      if (destroyed) return;
      palette = resolveSkin(FROGGER_SKINS, id);
      glow.clear();
      if (rafId === null) render(); // paused: show the new palette behind the overlay now
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      input.detach();
      glow.clear();
    },
  };
};
