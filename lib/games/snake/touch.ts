import type { TouchControlsLayout } from "../touch-controls";

// No diagonals: one would queue two turns at once.
export const SNAKE_TOUCH_CONTROLS: TouchControlsLayout = {
  dpad: {
    up: { code: "ArrowUp" },
    down: { code: "ArrowDown" },
    left: { code: "ArrowLeft" },
    right: { code: "ArrowRight" },
  },
  buttons: [],
};
