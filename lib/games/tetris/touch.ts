import type { TouchControlsLayout } from "../touch-controls";

// ROTAR does not auto-repeat on touch: accidental extra rotations are worse than tapping twice.
export const TETRIS_TOUCH_CONTROLS: TouchControlsLayout = {
  dpad: {
    left: { code: "ArrowLeft", repeat: true },
    right: { code: "ArrowRight", repeat: true },
    down: { code: "ArrowDown", repeat: true },
  },
  buttons: [
    { id: "rotate", label: "ROTAR", code: "ArrowUp" },
    { id: "drop", label: "CAÍDA", code: "Space" },
  ],
};
