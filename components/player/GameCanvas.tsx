"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { GameCallbacks, GameEngine, GameEngineFactory } from "@/lib/games/types";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export type GameCanvasHandle = Pick<GameEngine, "pause" | "resume" | "restart">;

interface GameCanvasProps {
  createEngine: GameEngineFactory;
  /** Must be referentially stable: a new object recreates the engine. */
  callbacks: GameCallbacks;
  title: string;
  ref?: Ref<GameCanvasHandle>;
}

export function GameCanvas({ createEngine, callbacks, title, ref }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createEngine(canvas, callbacks);
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
      <div className="touch-notice" role="note">
        REQUIERE TECLADO
      </div>
    </>
  );
}
