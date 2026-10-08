"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import {
  dispatchGameKey,
  directionFromVector,
  TOUCH_REPEAT_DELAY_MS,
  TOUCH_REPEAT_INTERVAL_MS,
  type DpadDirection,
  type TouchActionButton,
  type TouchControlsLayout,
  type TouchKey,
} from "@/lib/games/touch-controls";

const DIRECTIONS: readonly DpadDirection[] = ["up", "left", "right", "down"];

const DIRECTION_LABELS: Readonly<Record<DpadDirection, string>> = {
  up: "Arriba",
  down: "Abajo",
  left: "Izquierda",
  right: "Derecha",
};

const DIRECTION_GLYPHS: Readonly<Record<DpadDirection, string>> = {
  up: "▲",
  down: "▼",
  left: "◄",
  right: "►",
};

const NO_PRESSED: ReadonlySet<string> = new Set();

interface HeldKey {
  code: string;
  delay?: ReturnType<typeof setTimeout>;
  interval?: ReturnType<typeof setInterval>;
}

function dpadId(direction: DpadDirection) {
  return `dpad:${direction}`;
}

function buttonId(button: TouchActionButton) {
  return `btn:${button.id}`;
}

function stopRepeat(held: HeldKey) {
  clearTimeout(held.delay);
  clearInterval(held.interval);
}

/**
 * Tracks every emulated key that is down, keyed by control id, so they can all be
 * released at once: nothing may stay "stuck" after blur, tab switch or unmount.
 */
function useHeldKeys() {
  const heldRef = useRef(new Map<string, HeldKey>());
  const [pressed, setPressed] = useState(NO_PRESSED);

  const sync = useCallback(() => setPressed(new Set(heldRef.current.keys())), []);

  const press = useCallback(
    (id: string, key: TouchKey) => {
      const held = heldRef.current;
      if (held.has(id)) return;
      const entry: HeldKey = { code: key.code };
      dispatchGameKey("keydown", key.code);
      if (key.repeat) {
        entry.delay = setTimeout(() => {
          entry.interval = setInterval(() => dispatchGameKey("keydown", key.code, true), TOUCH_REPEAT_INTERVAL_MS);
        }, TOUCH_REPEAT_DELAY_MS);
      }
      held.set(id, entry);
      sync();
    },
    [sync],
  );

  const release = useCallback(
    (id: string) => {
      const entry = heldRef.current.get(id);
      if (!entry) return;
      stopRepeat(entry);
      dispatchGameKey("keyup", entry.code);
      heldRef.current.delete(id);
      sync();
    },
    [sync],
  );

  const releaseAll = useCallback(() => {
    for (const id of [...heldRef.current.keys()]) release(id);
  }, [release]);

  // Unmount: only keyups and timers, no state updates on a dead component.
  useEffect(() => {
    const held = heldRef.current;
    return () => {
      for (const entry of held.values()) {
        stopRepeat(entry);
        dispatchGameKey("keyup", entry.code);
      }
      held.clear();
    };
  }, []);

  return { pressed, press, release, releaseAll };
}

export function TouchControls({ layout }: { layout: TouchControlsLayout }) {
  const { pressed, press, release, releaseAll } = useHeldKeys();
  const dpadPointerRef = useRef<number | null>(null);

  const releaseDpad = useCallback(() => {
    dpadPointerRef.current = null;
    for (const direction of DIRECTIONS) release(dpadId(direction));
  }, [release]);

  useEffect(() => {
    const releaseEverything = () => {
      dpadPointerRef.current = null;
      releaseAll();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") releaseEverything();
    };
    window.addEventListener("blur", releaseEverything);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", releaseEverything);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [releaseAll]);

  // Releases directions the finger left, then presses the new ones; unchanged ones stay held.
  const updateDpad = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const active = directionFromVector(dx, dy, rect.width / 2, layout.diagonals ?? false);
    for (const direction of DIRECTIONS) {
      const key = layout.dpad[direction];
      if (key && active.includes(direction)) press(dpadId(direction), key);
      else release(dpadId(direction));
    }
  };

  const onDpadPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (dpadPointerRef.current !== null) return;
    dpadPointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateDpad(e);
  };

  const onDpadPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === dpadPointerRef.current) updateDpad(e);
  };

  const onDpadPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === dpadPointerRef.current) releaseDpad();
  };

  const hasButtons = layout.buttons.length > 0;

  return (
    <div
      className="av-touch-controls"
      data-buttons={hasButtons ? "true" : "false"}
      role="group"
      aria-label="Controles táctiles"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="av-touch-dpad"
        onPointerDown={onDpadPointerDown}
        onPointerMove={onDpadPointerMove}
        onPointerUp={onDpadPointerEnd}
        onPointerCancel={onDpadPointerEnd}
        onLostPointerCapture={onDpadPointerEnd}
      >
        {DIRECTIONS.filter((direction) => layout.dpad[direction]).map((direction) => (
          <button
            key={direction}
            type="button"
            tabIndex={-1}
            className="av-touch-dir"
            data-dir={direction}
            data-pressed={pressed.has(dpadId(direction)) ? "true" : undefined}
            aria-label={DIRECTION_LABELS[direction]}
          >
            {DIRECTION_GLYPHS[direction]}
          </button>
        ))}
        <span className="av-touch-dpad-hub" aria-hidden="true" />
      </div>

      {hasButtons && (
        <div className="av-touch-actions" data-count={layout.buttons.length}>
          {layout.buttons.map((button) => {
            const id = buttonId(button);
            const onEnd = () => release(id);
            return (
              <button
                key={button.id}
                type="button"
                tabIndex={-1}
                className="av-touch-btn"
                data-pressed={pressed.has(id) ? "true" : undefined}
                aria-label={button.label}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  press(id, button);
                }}
                onPointerUp={onEnd}
                onPointerCancel={onEnd}
                onLostPointerCapture={onEnd}
              >
                {button.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
