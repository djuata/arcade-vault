// Ported 1:1 from resources/started-games/04-arkanoid/levels.js

import { BLOCK_COLS, BLOCK_ROWS } from "./constants";
import type { BlockColor } from "./sprites";

export interface LevelBlock {
  col: number;
  row: number;
  color: BlockColor;
}

export interface Level {
  speed: number;
  blocks: readonly LevelBlock[];
}

function buildGrid(pick: (col: number, row: number) => BlockColor | null): LevelBlock[] {
  const blocks: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      const color = pick(col, row);
      if (color) blocks.push({ col, row, color });
    }
  }
  return blocks;
}

const ROW_COLORS_1: readonly BlockColor[] = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
const ROW_COLORS_2: readonly BlockColor[] = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
const ROW_COLORS_4: readonly BlockColor[] = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

const PYRAMID_START = [4, 3, 2, 1, 0, 0];
const PYRAMID_END = [5, 6, 7, 8, 9, 9];
const GAPS_4: readonly (readonly number[])[] = [
  [2, 5, 8],
  [0, 4, 7, 9],
  [1, 3, 6],
  [2, 5, 8, 9],
  [0, 4, 7],
  [1, 3, 6, 9],
];

const level1 = buildGrid((_col, row) => ROW_COLORS_1[row]);

const level2 = buildGrid((col, row) => (col >= PYRAMID_START[row] && col <= PYRAMID_END[row] ? ROW_COLORS_2[row] : null));

const level3 = buildGrid((col, row) => ((col + row) % 2 === 0 ? (row < 3 ? "yellow" : "magenta") : null));

const level4 = buildGrid((col, row) => (GAPS_4[row].includes(col) ? null : ROW_COLORS_4[row]));

const level5 = buildGrid((col, row) => {
  const isFrame = col === 0 || col === BLOCK_COLS - 1 || row === 0 || row === BLOCK_ROWS - 1;
  const isCross = col === 4 || row === 2;
  if (!isFrame && !isCross) return null;
  return isCross && !isFrame ? "hotpink" : "cyan";
});

export const LEVELS: readonly Level[] = [
  { speed: 1.0, blocks: level1 },
  { speed: 1.1, blocks: level2 },
  { speed: 1.21, blocks: level3 },
  { speed: 1.33, blocks: level4 },
  { speed: 1.46, blocks: level5 },
];
