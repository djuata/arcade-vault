// Values ported 1:1 from resources/started-games/02-asteroids/game.js.
// Coordinates: origin top-left, velocities in px/s, time in seconds.

export const W = 800;
export const H = 600;
export const MAX_DT = 0.05;

export const INITIAL_LIVES = 3;
export const INITIAL_ASTEROIDS = 4;
export const ASTEROID_SPAWN_SAFE_DIST = 130;
export const RESPAWN_DELAY = 2;
export const SHIP_COLLISION_FUDGE = 0.82;

export type AsteroidSize = 1 | 2 | 3; // 1 = small, 2 = medium, 3 = large

// Indexed by asteroid size.
export const RADII: readonly number[] = [0, 16, 30, 50];
export const SPEEDS: readonly number[] = [0, 85, 55, 32];
export const POINTS: readonly number[] = [0, 100, 50, 20];

export const POWERUP_DROP_CHANCE = 0.15;
export const POWERUP_DURATION = 5;
export const POWERUP_TTL = 12;
export const POWERUP_GUARANTEED_AFTER_KILLS = 5;
export const TRIPLE_SPREAD = 0.18;
