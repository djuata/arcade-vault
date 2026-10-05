"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toPlayerName, type Game } from "@/lib/games";
import { GAME_ENGINES } from "@/lib/games/registry";
import type { GameCallbacks } from "@/lib/games/types";
import { useSession } from "@/lib/session-context";
import { createClient } from "@/lib/supabase/client";
import { GameCanvas, type GameCanvasHandle } from "./GameCanvas";

type SaveStatus = "idle" | "saving" | "saved" | "error";

async function insertScore(gameId: string, playerName: string, score: number): Promise<boolean> {
  try {
    const { error } = await createClient()
      .from("scores")
      .insert({ game_id: gameId, player_name: playerName, score });
    return !error;
  } catch {
    return false;
  }
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

export function GamePlayer({ game }: { game: Game }) {
  const { user } = useSession();
  const canvasRef = useRef<GameCanvasHandle>(null);
  const createEngine = GAME_ENGINES[game.id];
  const hasEngine = createEngine !== undefined;

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [engineLevel, setEngineLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const level = hasEngine ? engineLevel : Math.floor(score / 2500) + 1;
  const name = nameOverride ?? (user ? toPlayerName(user.name) : "INVITADO");
  const canSave = saveStatus !== "saving" && name.trim().length > 0 && score > 0;

  const callbacks = useMemo<GameCallbacks>(
    () => ({
      onScore: setScore,
      onLives: setLives,
      onLevel: setEngineLevel,
      onGameOver: () => setOver(true),
    }),
    [],
  );

  // Mock score for games that still have no engine.
  useEffect(() => {
    if (hasEngine || over || paused) return;
    const t = setInterval(() => setScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
    return () => clearInterval(t);
  }, [hasEngine, over, paused]);

  // Keeps the engine in sync with the pause/over UI state.
  useEffect(() => {
    if (!hasEngine) return;
    if (paused || over) canvasRef.current?.pause();
    else canvasRef.current?.resume();
  }, [hasEngine, paused, over]);

  useEffect(() => {
    if (!hasEngine || over) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "KeyP" || e.repeat || isTypingTarget(e.target)) return;
      setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasEngine, over]);

  const endGame = () => setOver(true);
  const restart = () => {
    if (hasEngine) canvasRef.current?.restart();
    else setScore(0);
    setPaused(false);
    setOver(false);
    setSaveStatus("idle");
  };

  const saveToLeaderboard = async () => {
    setSaveStatus("saving");
    const ok = await insertScore(game.id, name.trim(), score);
    setSaveStatus(ok ? "saved" : "error");
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <Link href={`/games/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {createEngine ? (
            <GameCanvas ref={canvasRef} createEngine={createEngine} callbacks={callbacks} title={game.title} />
          ) : (
            <div className="game-arena">
              <div className="grid-floor" />
              <div className="enemy e1" />
              <div className="enemy e2" />
              <div className="enemy e3" />
              <div className="player-ship" />
            </div>
          )}
          {paused && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 10, letterSpacing: "0.16em" }}>
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>
            {game.title} · CRT-83 · 60 HZ
          </span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {saveStatus === "saved" ? (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            ) : game.playable ? (
              <>
                <div className="input-row">
                  <input
                    value={name}
                    onChange={(e) => setNameOverride(e.target.value.toUpperCase().slice(0, 10))}
                    maxLength={10}
                    placeholder="TUS INICIALES"
                  />
                  <button className="btn yellow" disabled={!canSave} onClick={saveToLeaderboard}>
                    {saveStatus === "saving" ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                  </button>
                </div>
                {saveStatus === "error" && (
                  <div className="save-error">NO SE PUDO GUARDAR. INTÉNTALO DE NUEVO.</div>
                )}
              </>
            ) : (
              <div className="save-note">ESTE JUEGO AÚN NO TIENE RANKING.</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/games" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
