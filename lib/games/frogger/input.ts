const DEFAULT_CAPTURE_KEYS: ReadonlySet<string> = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
]);

export interface Input {
  attach: () => void;
  detach: () => void;
}

/**
 * `shouldCapture` tells whether the game currently owns the keyboard. Only then
 * are `captureKeys` `preventDefault`-ed and `onPress` called, so the page doesn't
 * scroll while playing but typing in the game-over modal input keeps working.
 * `onPress` fires once per fresh key press, in order, ignoring auto-repeat.
 */
export function createInput(
  shouldCapture: () => boolean,
  onPress: (code: string) => void,
  captureKeys: ReadonlySet<string> = DEFAULT_CAPTURE_KEYS,
): Input {
  const onKeyDown = (e: KeyboardEvent) => {
    if (!shouldCapture()) return;
    if (captureKeys.has(e.code)) e.preventDefault();
    if (!e.repeat) onPress(e.code);
  };

  // Firefox activates a focused button on Space keyup, so cancel it too.
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space" && shouldCapture()) e.preventDefault();
  };

  return {
    attach() {
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
    },
    detach() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
