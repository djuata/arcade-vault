"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { GameCallbacks, GameEngine, GameEngineFactory } from "@/lib/games/types";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export type GameCanvasHandle = Pick<GameEngine, "pause" | "resume" | "restart"> & {
  focus: () => void;
};

interface GameCanvasProps {
  createEngine: GameEngineFactory;
  /** Must be referentially stable: a new object recreates the engine. */
  callbacks: GameCallbacks;
  /** Changing it swaps the palette live; it never recreates the engine. */
  skin: string;
  title: string;
  /** Shows the "REQUIERE TECLADO" notice on touch devices (no touch layout). */
  requiresKeyboard: boolean;
  ref?: Ref<GameCanvasHandle>;
}

export function GameCanvas({
  createEngine,
  callbacks,
  skin,
  title,
  requiresKeyboard,
  ref,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const skinRef = useRef(skin);

  // Declared before the engine effect so a (re)mounted engine is born with the current skin.
  useEffect(() => {
    skinRef.current = skin;
    engineRef.current?.setSkin?.(skin);
  }, [skin]);

  // `skin` must stay out of these deps: changing it would restart the run.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createEngine(canvas, callbacks, { skin: skinRef.current });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [createEngine, callbacks]);

  // Focus goes back to the canvas so Space can't re-trigger a focused button.
  useImperativeHandle(
    ref,
    () => ({
      pause: () => engineRef.current?.pause(),
      resume: () => {
        engineRef.current?.resume();
        canvasRef.current?.focus({ preventScroll: true });
      },
      restart: () => {
        engineRef.current?.restart();
        canvasRef.current?.focus({ preventScroll: true });
      },
      focus: () => canvasRef.current?.focus({ preventScroll: true }),
    }),
    [],
  );

  return (
    <>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        tabIndex={-1}
        aria-label={`Juego ${title}`}
      />
      {requiresKeyboard && (
        <div className="touch-notice" role="note">
          REQUIERE TECLADO
        </div>
      )}
    </>
  );
}
