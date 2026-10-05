// Template: lib/games/<slug>/input.ts
// Same behavior as lib/games/asteroids/input.ts, with the captured keys as a parameter.
// If a second game adopts this, promote it to lib/games/input.ts and let asteroids use it too.

export interface Input {
  keys: Record<string, boolean | undefined>;
  /** True once per fresh key press; the flag is consumed on read. */
  pressed: (code: string) => boolean;
  clearPressed: () => void;
  attach: () => void;
  detach: () => void;
}

/**
 * `shouldCapture` tells whether the game currently owns the keyboard. Only then
 * are `captureKeys` `preventDefault`-ed, so the page doesn't scroll while playing
 * but typing in the game-over modal input keeps working.
 */
export function createInput(
  shouldCapture: () => boolean,
  captureKeys: ReadonlySet<string> = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]),
): Input {
  const keys: Record<string, boolean | undefined> = {};
  const justPressed: Record<string, boolean | undefined> = {};

  const onKeyDown = (e: KeyboardEvent) => {
    if (captureKeys.has(e.code) && shouldCapture()) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true; // ignores auto-repeat
    keys[e.code] = true;
  };

  // Firefox activates a focused button on Space keyup, so cancel it too.
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space" && shouldCapture()) e.preventDefault();
    keys[e.code] = false;
  };

  return {
    keys,
    pressed(code) {
      const value = justPressed[code] === true;
      justPressed[code] = false;
      return value;
    },
    clearPressed() {
      for (const code of Object.keys(justPressed)) justPressed[code] = false;
    },
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
