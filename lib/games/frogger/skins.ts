import type { GameSkins } from "../skins";
import type { LaneSprite } from "./lanes";

export type VehicleSprite = Exclude<LaneSprite, "turtles" | "log">;

/** shadowBlur in px per entity; 0 = no glow. The shadow color is the entity's fill. */
export interface FroggerGlow {
  frog: number;
  lady: number;
  fly: number;
  vehicle: number;
  snake: number;
  timer: number;
}

export interface FroggerPalette {
  hedge: string;
  hedgeLeaf: string;
  bayWater: string;
  lily: string;
  river: string;
  wave: string;
  grass: string;
  grassEdge: string;
  road: string;
  laneMark: string;
  log: string;
  logRing: string;
  turtle: string;
  turtleShell: string;
  ripple: string;
  croc: string;
  crocDark: string; // river croc scutes + bay croc jaws
  crocTeeth: string;
  crocEye: string;
  fly: string;
  flyWing: string;
  lady: string;
  snake: string;
  snakeDark: string; // snake head
  frog: string;
  frogEye: string; // pupils (frog and lady)
  frogEyeWhite: string;
  splash: string;
  squash: string;
  timerTrack: string;
  timerOk: string;
  timerWarn: string;
  timerDanger: string;
  headlight: string;
  cabShade: string;
  vehicles: Readonly<Record<VehicleSprite, string>>;
  glow: FroggerGlow;
}

const CLASSIC_YELLOW = "#f5ff00";
const CLASSIC_MINT = "#00ff88";
const CLASSIC_PINK = "#ff006e";
const CLASSIC_FROG = "#a6ff00";
const CLASSIC_NIGHT = "#020b1f";
const CAB_SHADE = "rgba(0,0,0,0.35)";

const NEON_GREEN = "#39ff14";
const NEON_CYAN = "#00f0ff";
const NEON_MAGENTA = "#ff2bd6";
const NEON_YELLOW = "#ffe600";
const NEON_ORANGE = "#e05a00";
const NEON_NIGHT = "#000814";
const WHITE = "#ffffff";

// NES (2C02) subset — exactly 8 colors, arcade layout.
const NES_BLACK = "#000000";
const NES_BLUE = "#0000bc";
const NES_VIOLET = "#6844fc";
const NES_GREEN = "#00a800";
const NES_LIME = "#b8f818";
const NES_BROWN = "#ac7c00";
const NES_RED = "#f83800";
const NES_WHITE = "#fcfcfc";

const classic: FroggerPalette = {
  hedge: "#06240f",
  hedgeLeaf: "#0f4d22",
  bayWater: CLASSIC_NIGHT,
  lily: "#2fbf5a",
  river: "#04102e",
  wave: "rgba(120,200,255,0.12)",
  grass: "#0a2a12",
  grassEdge: "#39ff14",
  road: "#141416",
  laneMark: "#e6e9ff",
  log: "#7a4a22",
  logRing: "#5a3416",
  turtle: "#c2412d",
  turtleShell: "#8e2a1c",
  ripple: "rgba(120,200,255,0.55)",
  croc: "#2f9e44",
  crocDark: "#16602a",
  crocTeeth: WHITE,
  crocEye: CLASSIC_YELLOW,
  fly: CLASSIC_YELLOW,
  flyWing: "rgba(230,233,255,0.8)",
  lady: "#ff6ec7",
  snake: "#c6ff00",
  snakeDark: "#5c7a00",
  frog: CLASSIC_FROG,
  frogEye: CLASSIC_NIGHT,
  frogEyeWhite: WHITE,
  splash: "#78c8ff",
  squash: CLASSIC_FROG,
  timerTrack: "#0a0a12",
  timerOk: CLASSIC_MINT,
  timerWarn: CLASSIC_YELLOW,
  timerDanger: CLASSIC_PINK,
  headlight: "#fff6b0",
  cabShade: CAB_SHADE,
  vehicles: {
    car: CLASSIC_YELLOW,
    digger: CLASSIC_MINT,
    racer: CLASSIC_PINK,
    sedan: "#e6e9ff",
    truck: "#00f5ff",
  },
  glow: { frog: 10, lady: 8, fly: 8, vehicle: 8, snake: 8, timer: 8 },
};

const neon: FroggerPalette = {
  hedge: "#1a0638",
  hedgeLeaf: "#4b1a8a",
  bayWater: NEON_NIGHT,
  lily: "#1a8c3a",
  river: "#00101f",
  wave: "rgba(0,240,255,0.15)",
  grass: "#03140a",
  grassEdge: NEON_CYAN,
  road: "#08080d",
  laneMark: "#7a7aa8",
  log: NEON_ORANGE,
  logRing: "#6b2a00",
  turtle: NEON_CYAN,
  turtleShell: "#006b73",
  ripple: "rgba(0,240,255,0.6)",
  croc: NEON_MAGENTA,
  crocDark: "#b0189a",
  crocTeeth: WHITE,
  crocEye: NEON_YELLOW,
  fly: NEON_YELLOW,
  flyWing: "rgba(255,255,255,0.7)",
  lady: WHITE,
  snake: NEON_YELLOW,
  snakeDark: "#8a7a00",
  frog: NEON_GREEN,
  frogEye: NEON_NIGHT,
  frogEyeWhite: WHITE,
  splash: NEON_CYAN,
  squash: NEON_GREEN,
  timerTrack: "#0a0a14",
  timerOk: NEON_GREEN,
  timerWarn: NEON_YELLOW,
  timerDanger: NEON_MAGENTA,
  headlight: WHITE,
  cabShade: CAB_SHADE,
  vehicles: {
    car: NEON_YELLOW,
    digger: NEON_CYAN,
    racer: NEON_MAGENTA,
    sedan: WHITE,
    truck: NEON_ORANGE,
  },
  glow: { frog: 16, lady: 10, fly: 12, vehicle: 8, snake: 10, timer: 8 },
};

const retro: FroggerPalette = {
  hedge: NES_GREEN,
  hedgeLeaf: NES_BLACK,
  bayWater: NES_BLUE,
  lily: NES_GREEN,
  river: NES_BLUE,
  wave: NES_VIOLET,
  grass: NES_VIOLET,
  grassEdge: NES_WHITE,
  road: NES_BLACK,
  laneMark: NES_WHITE,
  log: NES_BROWN,
  logRing: NES_BLACK,
  turtle: NES_RED,
  turtleShell: NES_BLACK,
  ripple: NES_WHITE,
  croc: NES_GREEN,
  crocDark: NES_RED,
  crocTeeth: NES_WHITE,
  crocEye: NES_WHITE,
  fly: NES_WHITE,
  flyWing: NES_WHITE,
  lady: NES_WHITE,
  snake: NES_BLACK,
  snakeDark: NES_RED,
  frog: NES_LIME,
  frogEye: NES_BLACK,
  frogEyeWhite: NES_WHITE,
  splash: NES_WHITE,
  squash: NES_LIME,
  timerTrack: NES_BLACK,
  timerOk: NES_LIME,
  timerWarn: NES_WHITE,
  timerDanger: NES_RED,
  headlight: NES_WHITE,
  cabShade: NES_BLACK,
  vehicles: {
    car: NES_VIOLET,
    digger: NES_GREEN,
    racer: NES_RED,
    sedan: NES_WHITE,
    truck: NES_BROWN,
  },
  glow: { frog: 0, lady: 0, fly: 0, vehicle: 0, snake: 0, timer: 0 },
};

export const FROGGER_SKINS: GameSkins<FroggerPalette> = { classic, neon, retro };
