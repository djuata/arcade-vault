"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Game, ScoreRow } from "@/lib/games";
import { toPlayerName } from "@/lib/games";
import { useSession } from "@/lib/session-context";
import { createClient } from "@/lib/supabase/client";

interface MyBest {
  gameId: string;
  owner: string;
  rank: number;
  score: number;
  date: string;
}

interface HallOfFameProps {
  games: Game[];
  scoresByGame: Record<string, ScoreRow[]>;
}

const PODIUM_SLOTS = [
  { index: 1, className: "silver", label: "02" },
  { index: 0, className: "gold", label: "01" },
  { index: 2, className: "bronze", label: "03" },
] as const;

function rowRankClass(index: number): string {
  if (index === 0) return " top1";
  if (index === 1) return " top2";
  if (index === 2) return " top3";
  return "";
}

function formatScore(score: number): string {
  return score.toLocaleString("es-ES");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function PodiumSlot({ row, className, label }: { row: ScoreRow | undefined; className: string; label: string }) {
  const isGold = className === "gold";

  return (
    <div className={`podium-slot ${className}`}>
      {isGold && (
        <div className="pixel podium-champion">CAMPEÓN</div>
      )}
      <div className="rank-num">{label}</div>
      <div className="name">{row ? row.name : "—"}</div>
      <div className="score">{row ? formatScore(row.score) : "—"}</div>
      <div className="date">{row ? row.date : ""}</div>
    </div>
  );
}

function useMyBest(game: Game | undefined, playerName: string | null): MyBest | null {
  const [myBest, setMyBest] = useState<MyBest | null>(null);
  const gameId = game?.id;
  const playable = game?.playable ?? false;

  useEffect(() => {
    if (!gameId || !playable || !playerName) return;
    const controller = new AbortController();
    const supabase = createClient();

    (async () => {
      // The view already ranks by score desc, oldest first: the best row is the lowest rank.
      const { data, error } = await supabase
        .from("scores_ranked")
        .select("rank, score, created_at")
        .eq("game_id", gameId)
        .eq("player_name", playerName)
        .order("rank")
        .limit(1)
        .abortSignal(controller.signal)
        .maybeSingle();
      if (error || !data || data.rank === null || data.score === null || data.created_at === null) return;

      setMyBest({
        gameId,
        owner: playerName,
        rank: data.rank,
        score: data.score,
        date: formatDate(data.created_at),
      });
    })().catch(() => {
      // Aborted or offline: the "TU MEJOR MARCA" row simply doesn't show.
    });

    return () => controller.abort();
  }, [gameId, playable, playerName]);

  return myBest && myBest.gameId === gameId && myBest.owner === playerName ? myBest : null;
}

export function HallOfFame({ games, scoresByGame }: HallOfFameProps) {
  const { user } = useSession();
  const [tab, setTab] = useState((games.find((g) => g.playable) ?? games[0])?.id ?? "");

  const game = useMemo(() => games.find((g) => g.id === tab), [games, tab]);
  const rows = scoresByGame[tab] ?? [];
  const playerName = user ? toPlayerName(user.name) : null;
  const myBest = useMyBest(game, playerName);

  if (!game) return null;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel hall-sub">LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA</p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button key={g.id} className={`chip${tab === g.id ? " active" : ""}`} onClick={() => setTab(g.id)}>
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <div className="pixel">AÚN NO HAY PUNTAJES</div>
          <p>{game.playable ? "SÉ EL PRIMERO." : "ESTE JUEGO AÚN NO TIENE RANKING."}</p>
        </div>
      ) : (
        <>
          <div className="podium">
            {PODIUM_SLOTS.map((slot) => (
              <PodiumSlot key={slot.label} row={rows[slot.index]} className={slot.className} label={slot.label} />
            ))}
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div key={r.rank} className={`tr${rowRankClass(i)}`} style={{ animationDelay: `${i * 50}ms` }}>
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{formatScore(r.score)}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
            {user && myBest && (
              <>
                <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
                <div className="tr you" style={{ animationDelay: `${rows.length * 50 + 50}ms` }}>
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    #{String(myBest.rank).padStart(2, "0")}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {myBest.owner}
                  </div>
                  <div className="sc" style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}>
                    {formatScore(myBest.score)}
                  </div>
                  <div className="dt">{myBest.date}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/games" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
