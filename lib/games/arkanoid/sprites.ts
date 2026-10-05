// Coordinates ported from resources/started-games/04-arkanoid/assets/spritesheet.js

export type BlockColor = "gray" | "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";

export interface Sprite {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export const SPRITESHEET_URL = "/games/arkanoid/spritesheet-breakout.png";

export const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
} as const satisfies { paddle: Sprite; ball: Sprite; blocks: Record<BlockColor, Sprite> };

function explosionRow(sy: number): readonly Sprite[] {
  return [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));
}

// `gray` reuses the red row, as in the original.
export const EXPLOSION_FRAMES: Readonly<Record<BlockColor, readonly Sprite[]>> = {
  red: explosionRow(176),
  cyan: explosionRow(192),
  green: explosionRow(208),
  magenta: explosionRow(224),
  yellow: explosionRow(240),
  hotpink: explosionRow(256),
  gray: explosionRow(176),
};

// Flat colors drawn while the spritesheet is loading or if it fails to load.
export const FALLBACK_COLORS = {
  paddle: "#e0e0e0",
  ball: "#ffffff",
  blocks: {
    gray: "#9e9e9e",
    red: "#e57373",
    yellow: "#ffd54f",
    cyan: "#4dd0e1",
    magenta: "#ba68c8",
    hotpink: "#ff69b4",
    green: "#81c784",
  },
} as const satisfies { paddle: string; ball: string; blocks: Record<BlockColor, string> };
