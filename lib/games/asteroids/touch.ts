import type { TouchControlsLayout } from "../touch-controls";

// Diagonals let one thumb rotate and thrust at once; DISPARO goes on another finger.
export const ASTEROIDS_TOUCH_CONTROLS: TouchControlsLayout = {
  dpad: {
    left: { code: "ArrowLeft" },
    right: { code: "ArrowRight" },
    up: { code: "ArrowUp" },
  },
  diagonals: true,
  buttons: [{ id: "fire", label: "DISPARO", code: "Space" }],
};
