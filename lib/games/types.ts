// Contracts shared by every game engine mounted in the player.

export interface GameCallbacks {
  onScore: (score: number) => void;
  /** Optional: games without lives never emit it and the HUD hides the stat. */
  onLives?: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface GameEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
  /** Optional: swaps the palette live, without restarting the run. */
  setSkin?: (skin: string) => void;
}

export interface GameEngineOptions {
  /** Skin id; unknown or missing ids fall back to the default skin. */
  skin?: string;
}

export type GameEngineFactory = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
  options?: GameEngineOptions,
) => GameEngine;
