import type { GameSkins } from "../skins";
import { FRUIT_KEYS, type FruitKey } from "./sprites";

export interface SpriteTint {
  color: string;
  alpha: number;
}

export interface Glow {
  color: string;
  blur: number;
}

export interface SnakePalette {
  boardDark: string; // base fill of the board
  boardLight: string; // checkerboard cells
  body: string;
  head: string;
  eyes: string;
  fruitFallback: Readonly<Record<FruitKey, string>>; // used while/if fruits.png fails
  spriteTint: SpriteTint | null; // null = draw the PNG as is
  headGlow: Glow | null;
  fruitGlow: Glow | null;
}

export function uniformFruitColors(color: string): Readonly<Record<FruitKey, string>> {
  return Object.fromEntries(FRUIT_KEYS.map((key) => [key, color])) as Record<FruitKey, string>;
}

const NEON_MAGENTA = "#ff2bd6";
const NEON_CYAN = "#00f0ff";
const DMG_LIGHTEST = "#9bbc0f";
const DMG_DARK = "#306230";
const DMG_DARKEST = "#0f380f";

export const SNAKE_SKINS: GameSkins<SnakePalette> = {
  classic: {
    boardDark: "#0a0a18",
    boardLight: "#10102a",
    body: "#2bff88",
    head: "#b6ffd0",
    eyes: "#0a0a18",
    fruitFallback: {
      banana: "#f2d12b",
      orange: "#f58a1f",
      grape: "#8e2fb5",
      garlic: "#e8e2d0",
      eggplant: "#6a1f8a",
      strawberry: "#e5262c",
      cherry: "#c4162a",
      carrot: "#f08a24",
      mushroom: "#d9534f",
      broccoli: "#2e8b2e",
      watermelon: "#e0434f",
      pepper: "#2f9e44",
      kiwi: "#7cb518",
      lemon: "#f4e04d",
      peach: "#f7a58b",
      peanut: "#c49a5b",
      apple: "#d62828",
      tomato: "#ff3b1d",
      berries: "#9b2d6f",
      grapes2: "#7a2fa8",
      pineapple: "#f0b323",
      melon: "#9bd36b",
    },
    spriteTint: null,
    headGlow: null,
    fruitGlow: null,
  },
  neon: {
    boardDark: "#05050f",
    boardLight: "#0d0d24",
    body: "#39ff14",
    head: NEON_CYAN,
    eyes: "#05050f",
    fruitFallback: uniformFruitColors(NEON_MAGENTA),
    spriteTint: { color: NEON_MAGENTA, alpha: 0.35 },
    headGlow: { color: NEON_CYAN, blur: 12 },
    fruitGlow: { color: NEON_MAGENTA, blur: 16 },
  },
  retro: {
    boardDark: DMG_LIGHTEST,
    boardLight: DMG_LIGHTEST,
    body: DMG_DARK,
    head: DMG_DARKEST,
    eyes: DMG_LIGHTEST,
    fruitFallback: uniformFruitColors(DMG_DARKEST),
    spriteTint: { color: DMG_DARKEST, alpha: 1 },
    headGlow: null,
    fruitGlow: null,
  },
};
