"use client";

import { useRef, type KeyboardEvent } from "react";
import { skinLabel } from "@/lib/games/skins";

interface SkinSelectorProps {
  skins: readonly string[];
  value: string;
  onChange: (skin: string) => void;
  /** Called when the choice is committed (click, Enter, Space, Escape): GamePlayer refocuses the canvas. */
  onCommit: () => void;
}

const COMMIT_KEYS: ReadonlySet<string> = new Set(["Enter", " ", "Escape"]);

function targetIndex(key: string, current: number, count: number): number | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + count) % count;
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

export function SkinSelector({ skins, value, onChange, onCommit }: SkinSelectorProps) {
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (skins.length <= 1) return null;

  const selectedIndex = Math.max(0, skins.indexOf(value));

  // The engine listens on window: stopping propagation keeps these keys from steering the game.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (COMMIT_KEYS.has(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      onCommit();
      return;
    }
    const next = targetIndex(e.key, selectedIndex, skins.length);
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    onChange(skins[next]);
    optionRefs.current[next]?.focus();
  };

  const choose = (skin: string) => {
    onChange(skin);
    onCommit();
  };

  return (
    <div className="av-skin-group" role="radiogroup" aria-label="Skin" onKeyDown={onKeyDown}>
      {skins.map((skin, i) => {
        const checked = i === selectedIndex;
        return (
          <button
            key={skin}
            ref={(el) => {
              optionRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className="av-skin-option"
            onClick={() => choose(skin)}
          >
            {skinLabel(skin)}
          </button>
        );
      })}
    </div>
  );
}
