import type { GameEngineFactory } from "../types";
import {
  ASTEROID_SPAWN_SAFE_DIST,
  H,
  INITIAL_ASTEROIDS,
  INITIAL_LIVES,
  MAX_DT,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  POWERUP_GUARANTEED_AFTER_KILLS,
  RESPAWN_DELAY,
  SHIP_COLLISION_FUDGE,
  W,
} from "./constants";
import { Asteroid, Bullet, Particle, PowerUp, Ship } from "./entities";
import { createInput } from "./input";
import { dist, rand } from "./utils";

type GameState = "playing" | "dead" | "gameover";

export const createAsteroidsGame: GameEngineFactory = (canvas, callbacks) => {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) throw new Error("Asteroids: 2D canvas context is not available");
  const ctx: CanvasRenderingContext2D = maybeCtx;
  canvas.width = W;
  canvas.height = H;

  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let score = 0;
  let lives = INITIAL_LIVES;
  let level = 1;
  let state: GameState = "playing";
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;

  let paused = false;
  let destroyed = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const input = createInput(() => !paused && state !== "gameover");

  // ── State ───────────────────────────────────────────────────────────────────

  function spawnAsteroids(count: number) {
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < ASTEROID_SPAWN_SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = INITIAL_LIVES;
    level = 1;
    state = "playing";
    spawnAsteroids(INITIAL_ASTEROIDS);
    callbacks.onScore(score);
    callbacks.onLives(lives);
    callbacks.onLevel(level);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
    callbacks.onLevel(level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    callbacks.onLives(lives);
    if (lives <= 0) {
      state = "gameover";
      callbacks.onGameOver(score);
    } else {
      state = "dead";
      deadTimer = RESPAWN_DELAY;
    }
  }

  function maybeDropPowerUp(x: number, y: number) {
    if (powerUpSpawned) return;
    killsSinceSpawn++;
    const guaranteed = killsSinceSpawn >= POWERUP_GUARANTEED_AFTER_KILLS;
    if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
      powerUps.push(new PowerUp(x, y));
      powerUpSpawned = true;
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  function updateParticles(dt: number) {
    particles.forEach((p) => p.update(dt));
    particles = particles.filter((p) => !p.dead);
  }

  function resolveBulletHits() {
    const fragments: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (a.dead || b.dead || dist(b, a) >= a.radius) continue;
        b.dead = true;
        a.dead = true;
        score += a.points;
        callbacks.onScore(score);
        explode(a.x, a.y, a.size * 5);
        fragments.push(...a.split());
        maybeDropPowerUp(a.x, a.y);
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(fragments);
    bullets = bullets.filter((b) => !b.dead);
  }

  function update(dt: number) {
    if (state === "gameover") {
      updateParticles(dt);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      updateParticles(dt);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    if (input.pressed("Space")) bullets.push(...ship.tryShoot());

    ship.update(dt, {
      left: !!input.keys.ArrowLeft,
      right: !!input.keys.ArrowRight,
      thrust: !!input.keys.ArrowUp,
    });
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    resolveBulletHits();

    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * SHIP_COLLISION_FUDGE) {
          killShip();
          break;
        }
      }
    }

    if (state === "playing" && asteroids.length === 0) nextLevel();
  }

  // ── Draw ────────────────────────────────────────────────────────────────────

  function drawTripleShotIndicator() {
    if (ship.tripleShot <= 0) return;
    ctx.fillStyle = "#0ff";
    ctx.font = "15px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`3x  ${ship.tripleShot.toFixed(1)}s`, 14, 26);
  }

  function draw() {
    const c = ctx;
    c.fillStyle = "#000";
    c.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(c));
    asteroids.forEach((a) => a.draw(c));
    powerUps.forEach((p) => p.draw(c));
    bullets.forEach((b) => b.draw(c));
    ship.draw(c);
    drawTripleShotIndicator();
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
    lastTime = null;
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
