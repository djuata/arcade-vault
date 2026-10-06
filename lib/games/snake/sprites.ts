export interface Sprite {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const SPRITESHEET_URL = "/games/snake/fruits.png";

// Pixel-art row of fruits.png (3790x442), ported from app/assets/sprites.js.
export const FRUIT_SPRITES = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
} as const satisfies Record<string, Sprite>;

export type FruitKey = keyof typeof FRUIT_SPRITES;

export const FRUIT_KEYS = Object.keys(FRUIT_SPRITES) as FruitKey[];

// Flat colors used while the spritesheet is loading or if it fails to load.
export const FALLBACK_COLORS: Readonly<Record<FruitKey, string>> = {
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
};
