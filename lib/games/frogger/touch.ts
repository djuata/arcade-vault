import type { TouchControlsLayout } from "../touch-controls";

// No diagonals: one would fire two hops at once. No repeat: every tap is one hop.
export const FROGGER_TOUCH_CONTROLS: TouchControlsLayout = {
  dpad: {
    up: { code: "ArrowUp" },
    down: { code: "ArrowDown" },
    left: { code: "ArrowLeft" },
    right: { code: "ArrowRight" },
  },
  buttons: [],
};
