import { DEFAULT_SKIN, resolveSkin } from "../skins";
import type { GameEngineFactory } from "../types";
import {
  type Cell,
  type Direction,
  type Fruit,
  KEY_DIRECTIONS,
  createSnake,
  hitsBody,
  hitsWall,
  isOpposite,
  levelFor,
  nextHead,
  pickFruit,
  sameCell,
  tickIntervalFor,
} from "./board";
import { FRUIT_POINTS, H, MAX_DT, MAX_QUEUED_TURNS, W } from "./constants";
import { createInput } from "./input";
import { drawFrame } from "./render";
import { SNAKE_SKINS, type SnakePalette } from "./skins";
import { SPRITESHEET_URL } from "./sprites";
import { tintSheet } from "./tint";

type GameState = "playing" | "gameover";

export const createSnakeGame: GameEngineFactory = (canvas, callbacks, options) => {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) throw new Error("Snake: 2D canvas context is not available");
  const ctx: CanvasRenderingContext2D = maybeCtx;
  canvas.width = W;
  canvas.height = H;

  let snake: Cell[] = [];
  let fruit: Fruit | null = null;
  let direction: Direction = "right";
  let queuedTurns: Direction[] = [];
  let fruitsEaten = 0;
  let score = 0;
  let level = 1;
  let tickAccumulator = 0; // ms
  let state: GameState = "playing";

  let skinId: string = options?.skin ?? DEFAULT_SKIN;
  let palette: SnakePalette = resolveSkin(SNAKE_SKINS, skinId);
  let image: HTMLImageElement | null = null; // the loaded PNG, untinted
  let activeSheet: HTMLImageElement | HTMLCanvasElement | null = null;
  const tintCache = new Map<string, HTMLCanvasElement>();
  let paused = false;
  let destroyed = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const input = createInput(() => !paused && state !== "gameover", enqueueTurn);

  const loader = new Image();
  loader.onload = () => {
    if (destroyed) return;
    image = loader;
    refreshSheet();
  };
  loader.src = SPRITESHEET_URL;

  // ── Skin ────────────────────────────────────────────────────────────────────

  // Tints always start from the original PNG and are cached per skin, so
  // switching skins back and forth never stacks tints.
  function tintedSheet(source: HTMLImageElement): HTMLCanvasElement | HTMLImageElement {
    const tint = palette.spriteTint;
    if (!tint) return source;
    let sheet = tintCache.get(skinId);
    if (!sheet) {
      sheet = tintSheet(source, tint);
      tintCache.set(skinId, sheet);
    }
    return sheet;
  }

  function refreshSheet() {
    activeSheet = image ? tintedSheet(image) : null;
  }

  function render() {
    drawFrame(ctx, { snake, fruit, direction, sheet: activeSheet }, palette);
  }

  // ── State ───────────────────────────────────────────────────────────────────

  function enqueueTurn(code: string) {
    const turn = KEY_DIRECTIONS[code];
    if (!turn || queuedTurns.length >= MAX_QUEUED_TURNS) return;
    queuedTurns.push(turn);
  }

  function endGame() {
    if (state === "gameover") return;
    state = "gameover";
    callbacks.onGameOver(score); // exactly once per game
  }

  function initGame() {
    snake = createSnake();
    fruit = pickFruit(snake);
    direction = "right";
    queuedTurns = [];
    fruitsEaten = 0;
    score = 0;
    level = 1;
    tickAccumulator = 0;
    state = "playing";
    callbacks.onScore(score);
    callbacks.onLevel(level);
  }

  // Consumes queued turns until one is valid (not the same as, nor opposite to,
  // the direction already applied), so two quick keys never reverse the snake.
  function applyQueuedTurn() {
    while (queuedTurns.length > 0) {
      const turn = queuedTurns.shift() as Direction;
      if (turn !== direction && !isOpposite(direction, turn)) {
        direction = turn;
        return;
      }
    }
  }

  function eatFruit() {
    fruitsEaten++;
    score += FRUIT_POINTS;
    callbacks.onScore(score);
    const newLevel = levelFor(fruitsEaten);
    if (newLevel !== level) {
      level = newLevel;
      callbacks.onLevel(level);
    }
    fruit = pickFruit(snake);
    if (!fruit) endGame(); // board full
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  function step() {
    applyQueuedTurn();
    const head = nextHead(snake[0], direction);
    const willGrow = fruit !== null && sameCell(head, fruit);
    if (hitsWall(head) || hitsBody(head, snake, willGrow)) {
      endGame();
      return;
    }
    snake.unshift(head);
    if (willGrow) eatFruit();
    else snake.pop();
  }

  function update(dt: number) {
    tickAccumulator += dt * 1000;
    let interval = tickIntervalFor(fruitsEaten);
    while (state === "playing" && tickAccumulator >= interval) {
      tickAccumulator -= interval;
      step();
      interval = tickIntervalFor(fruitsEaten);
    }
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
      queuedTurns = [];
      tickAccumulator = 0;
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
      skinId = id;
      palette = resolveSkin(SNAKE_SKINS, id);
      refreshSheet();
      if (rafId === null) render(); // paused or game over: show the new palette now
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      input.detach();
      loader.onload = null;
      tintCache.clear();
    },
  };
};
