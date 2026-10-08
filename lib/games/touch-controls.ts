// Touch controls emulate the keyboard: engines read `e.code` on `window`, so a
// synthetic KeyboardEvent with the right code drives them without engine changes.

export type DpadDirection = "up" | "down" | "left" | "right";

/** A keyboard key the touch control emulates. */
export interface TouchKey {
  /** KeyboardEvent.code the engine reads, e.g. "ArrowLeft", "Space". */
  code: string;
  /** Holding re-emits keydown with repeat: true, like a held keyboard key. */
  repeat?: boolean;
}

export interface TouchActionButton extends TouchKey {
  /** Stable id, used as React key. */
  id: string;
  /** Spanish action label shown on the button, e.g. "DISPARO". */
  label: string;
}

export interface TouchControlsLayout {
  /** Only mapped directions react; an unmapped sector does nothing. */
  dpad: Partial<Record<DpadDirection, TouchKey>>;
  /** Diagonal sectors press two directions at once (ROCAS: rotate + thrust). */
  diagonals?: boolean;
  /** 0 to 4 action buttons, right side. */
  buttons: readonly TouchActionButton[];
}

export const TOUCH_REPEAT_DELAY_MS = 170;
export const TOUCH_REPEAT_INTERVAL_MS = 50;
/** Fraction of the D-pad radius where touches are ignored. */
export const DPAD_DEAD_ZONE = 0.25;

export function dispatchGameKey(type: "keydown" | "keyup", code: string, repeat = false): void {
  window.dispatchEvent(new KeyboardEvent(type, { code, repeat, bubbles: true, cancelable: true }));
}

// ── D-pad geometry ──────────────────────────────────────────────────────────

// Sectors clockwise from "right", in screen coordinates (y grows downwards).
const CROSS_SECTORS: readonly (readonly DpadDirection[])[] = [
  ["right"],
  ["down"],
  ["left"],
  ["up"],
];

const DIAGONAL_SECTORS: readonly (readonly DpadDirection[])[] = [
  ["right"],
  ["down", "right"],
  ["down"],
  ["down", "left"],
  ["left"],
  ["up", "left"],
  ["up"],
  ["up", "right"],
];

/**
 * Maps a touch offset from the D-pad center to the pressed directions.
 * Inside the dead zone nothing is pressed; with `diagonals`, the 45° sectors
 * between axes press two directions at once.
 */
export function directionFromVector(
  dx: number,
  dy: number,
  radius: number,
  diagonals: boolean,
): DpadDirection[] {
  if (Math.hypot(dx, dy) < radius * DPAD_DEAD_ZONE) return [];

  const sectors = diagonals ? DIAGONAL_SECTORS : CROSS_SECTORS;
  const sectorSize = (2 * Math.PI) / sectors.length;
  const angle = (Math.atan2(dy, dx) + 2 * Math.PI) % (2 * Math.PI);
  const index = Math.round(angle / sectorSize) % sectors.length;

  return [...sectors[index]];
}
