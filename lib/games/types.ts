// Contracts shared by every game engine mounted in the player.

export interface GameCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface GameEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
}

export type GameEngineFactory = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
) => GameEngine;
