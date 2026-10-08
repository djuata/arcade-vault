---
name: arcade-vault-game
description: >
  Creates a playable game for Arcade Vault (pure-TS canvas engine, registry entry, Supabase leaderboard wiring) or ports one from resources/started-games/.
  Trigger: When asked to create, port, add or integrate a game, its engine, its leaderboard/ranking, or to make a catalog game playable.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Building a new game engine, or porting `resources/started-games/<NN>-name/game.js`.
- Making a catalog game (`games` table) playable and ranked.
- Touching the engine ↔ player ↔ leaderboard contract.

Reference implementation: ROCAS (Asteroids). Specs: `specs/05-asteroids-game.md` (engine + player), `specs/06-games-table-and-leaderboard.md` (DB + ranking), `specs/07-tetris-game.md` (second game; best template for a new spec).

This skill is spec-first: it writes the spec, **pauses for the user's approval**, then implements. One invocation, two phases, one gate in between.

## What a New Game Touches

| Piece | Where | Needed |
| ----- | ----- | ------ |
| Engine | `lib/games/<slug>/` (pure TS) | Always |
| Registry | `lib/games/registry.ts` (one line in `GAME_ENGINES`) | Always |
| Touch layout | `lib/games/<slug>/touch.ts` + one line in `GAME_TOUCH_CONTROLS` | Always |
| `playable = true` | New migration in `supabase/migrations/` + `apply_migration` | Always |
| `games` row | Same migration, `insert` | Only if the slug is NOT in the catalog |
| Cover CSS | `.cover-*` in `app/globals.css` | Only for a brand-new catalog game |
| `database.types.ts` | `generate_typescript_types` | Only if the schema changes (data-only: never) |
| Games doc | `GAMES.md` (summary row + game section) | Always |
| `GamePlayer`, Library, Detail, Hall of Fame | — | **Never**: all DB-driven |

Catalog slugs without engine yet: `bloque-buster` (04-arkanoid), `caida` (03-tetris), `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`. They already exist in `games`: only flip `playable`.

## Critical Patterns

### 1. One slug, five places

`games.id` = route segment (`/games/<slug>`) = `GAME_ENGINES` key = `scores.game_id` = engine folder name. Never alias.

### 2. Two sources of truth MUST agree

`GAME_ENGINES[slug]` exists **⇔** `games.playable = true`.

- Engine without `playable`: modal offers saving, RLS rejects, user sees the error.
- `playable` without engine: ranking accepts scores from the fake arena's random `setInterval`.

Do both in the same change. Never one without the other.

### 3. Engine contract (`lib/games/types.ts`)

`GameEngineFactory = (canvas, callbacks) => { pause, resume, restart, destroy }`.

- `lib/games/<slug>/` imports NOTHING from `react` or `next/*` (verify with `rg`).
- State lives in the factory closure. No module-level mutable state, no `document.getElementById`.
- `initGame()` (on create and on `restart`) emits `onScore(0)`, `onLevel(1)` and, only if the game has lives, `onLives?.(n)`.
- `onScore/onLives/onLevel` fire only when the value changes. `onGameOver(finalScore)` fires **exactly once**, immediately.
- Scores are **integers** in `1..99_999_999` (DB CHECK). Round fractional scoring. Score `0` is not saved.

### 4. Lifecycle (what Strict Mode and navigation punish)

- Cancelable `requestAnimationFrame`; `dt = min((ts - lastTime)/1000, MAX_DT)`, `dt = 0` on first frame.
- `startLoop()` resets `lastTime = null`; `resume()` also calls `input.clearPressed()`.
- `pause/resume/restart/destroy` guard on `destroyed`; `destroy()` is **idempotent**, cancels rAF and calls `input.detach()`.

### 5. Input

- Listeners on `window`, registered in `attach()`, removed in `detach()`.
- `preventDefault` on game keys **only while** `!paused && state !== "gameover"` (`shouldCapture`). Otherwise the modal's name input can't take Space/arrows.
- Also cancel `Space` on `keyup` (Firefox activates a focused button on keyup).
- "Just pressed" semantics consume on read and ignore auto-repeat.
- Read **only `e.code`** (plus `e.repeat` if needed); never `e.key` or `isTrusted`. The touch panel (`components/player/TouchControls.tsx`) dispatches synthetic `KeyboardEvent`s on `window` with just `code`/`repeat`, so an engine that reads anything else is unplayable on mobile.

### 6. The platform owns the chrome

HUD (score/lives/level), PAUSA/`P`, "FIN DEL JUEGO" modal, save-score and restart live in `GamePlayer`. The canvas draws **only the game** (plus in-game indicators like a power-up timer). No `GAME OVER` text, no Space-to-restart.

### 7. Canvas

Fixed internal 800×600, scaled by CSS; `.crt-screen` forces 4:3. A different aspect ratio needs a platform change, not an engine hack.

### 8. Porting from `started-games/`

Keep rules/constants 1:1 (no balance tweaks). Replace: globals → closure; `getElementById` → `canvas` arg; unremoved listeners → `attach/detach`; endless rAF → cancelable loop; in-canvas HUD/GAME OVER → callbacks. Never edit `resources/`.

### 9. Leaderboard is already wired

`GamePlayer` inserts `{ game_id, player_name, score }` into `scores` with the browser client. RLS only allows insert when `games.playable`. Ranking (`scores_ranked`), `best`/`plays` (`games_with_stats`), detail top 10 and Hall of Fame tabs update by themselves.

### Platform gaps: STOP and propose a spec

`onLives` is optional: if the engine never emits it, `GamePlayer` hides the lives stat (Tetris and Snake work this way), so a game without lives needs no platform change. Level is always shown. A game without levels, non-4:3 canvas, or touch controls requires changing `GameCallbacks`/`GamePlayer`: that's its own spec, not a workaround inside the engine.

## Workflow

### Phase A: Spec (always first, then STOP)

`/spec` has `disable-model-invocation`, so do NOT try to call it. Reproduce its output instead:

0. If `specs/NN-<slug>-game.md` already exists as `Draft` (e.g. promoted from a game jam, `specs/game-jam/`), do NOT rewrite it: read it, check it against the Critical Patterns, fix only what violates them (tell the user what changed), and jump to step 5.
1. Read `.agents/skills/spec/template.md`, `specs/07-tetris-game.md` and the two most recent specs. Match their language (Spanish), headings and state wording exactly.
2. Read the source game (`resources/started-games/<NN>-name/`) and `lib/games/registry.ts`. Decide with the user, via `AskUserQuestion`, only what is genuinely open (new catalog entry vs flipping a placeholder, assets strategy, platform gaps). Gallery rule: a game is a NEW catalog entry; never attach it to an existing placeholder without asking.
3. Next number = highest in `specs/` + 1, two digits; slug `NN-<slug>-game.md`; date from `date +%F`, never guessed.
4. Write `specs/NN-<slug>-game.md` with state `Draft` (never `Approved`): header, scope (with explicit "not included"), data model, numbered implementation plan following Phase B, boolean acceptance criteria, decisions, risks. Do not write code.
5. **STOP.** Announce the path and ask the user to review and approve. Wait. Do not touch `lib/`, `app/`, `supabase/` until they confirm.

### Phase B: Implementation (only after approval)

Create the branch `spec-NN-<slug>-game` (respect `AutoCreateBranch` in `specs/.spec-config.yml`), mark the spec `Implementado` at the end, and follow the spec's plan:

1. **Engine**: copy [assets/engine.ts.tpl](assets/engine.ts.tpl) and [assets/input.ts.tpl](assets/input.ts.tpl) to `lib/games/<slug>/{engine,input}.ts`; add `constants.ts`, `entities.ts`, `utils.ts` as needed. Factory name: `create<Name>Game`.
2. **Register**: add `<slug>: create<Name>Game` to `GAME_ENGINES`.
   - **Touch layout**: create `lib/games/<slug>/touch.ts` exporting `<NAME>_TOUCH_CONTROLS: TouchControlsLayout` (types in `lib/games/touch-controls.ts`; no React/`next`) and register it in `GAME_TOUCH_CONTROLS`. Map only the directions the engine reads (unmapped ones aren't drawn), `repeat: true` only where the engine expects keyboard auto-repeat, `diagonals` only when two directions at once make sense, 0–4 action buttons with Spanish labels. See specs/12-touch-controls.md for the existing layouts.
3. **Migration**: from [assets/migration.sql.tpl](assets/migration.sql.tpl); file `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`, apply with `apply_migration` (same SQL). Inspect existing tables first.
4. **Brand-new game only**: `cover` class in `app/globals.css`; `cat` ∈ ARCADE|PUZZLE|SHOOTER|VERSUS, `color` ∈ cyan|magenta|yellow|green (CHECK constraints), unique `sort_order`.
5. **Verify RLS** with the publishable key (`get_project_url`, `get_publishable_keys`):
   - valid insert for `<slug>` → `201`; invalid (`score` 0, name > 10 chars, unknown `game_id`) → rejected.
   - delete test rows with `execute_sql`.
6. **Manual run** (`npm run dev`): play, die, save, check `/games/<slug>` and `/hall-of-fame`.
7. **Document**: update `GAMES.md` — add a row to the summary table, a section following the existing ones (route, engine, cover, migration, assets, controls table, rules), remove the slug from "Catálogo sin motor" if it was a placeholder, and bump the date and playable count. Take controls and rules from the engine code (`input.ts`, `constants.ts`, `engine.ts`), not from the spec.

## Acceptance Checklist

- [ ] Engine folder has no `react` / `next` imports.
- [ ] Space/arrows don't scroll the page; the modal input still accepts Space and arrows.
- [ ] `onGameOver` opens the modal exactly once, with the right final score.
- [ ] Pause (button and `P`) freezes the game; resume has no position jump.
- [ ] "JUGAR DE NUEVO" → score 0, initial lives, level 1, running.
- [ ] Leave and re-enter (and Strict Mode in dev): one action per key press, no stray listeners.
- [ ] Saved score appears in `/games/<slug>` and in the Hall of Fame tab; `best` and `plays` update.
- [ ] A non-playable game still shows "ESTE JUEGO AÚN NO TIENE RANKING." and writes nothing.
- [ ] `git diff` shows no changes in `lib/session-context.tsx`, `components/nav/`, `resources/`.
- [ ] No new dependencies; no console errors or React warnings.
- [ ] `GAMES.md` lists the game with controls, its **Táctil** line and rules matching the engine.
- [ ] On mobile emulation (`pointer: coarse`) the touch panel shows, no "REQUIERE TECLADO", and every control works.

## Commands

```bash
rg -n 'from "(react|next)' lib/games/<slug>/        # must return nothing
npm run lint                                        # no test runner exists; do not build
git diff --stat -- lib/session-context.tsx components/nav resources

# RLS probe (URL and KEY from the Supabase MCP tools)
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/rest/v1/scores" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=minimal" \
  -d '{"game_id":"<slug>","player_name":"TEST","score":1}'
```

## Resources

- **Templates**: [assets/](assets/) — `engine.ts.tpl`, `input.ts.tpl`, `migration.sql.tpl` (`.tpl` on purpose: keeps them out of ESLint/tsc).
- **Reference code**: `lib/games/asteroids/`, `lib/games/registry.ts`, `components/player/GameCanvas.tsx`, `components/player/GamePlayer.tsx`, `lib/data/`.
- **Specs**: `specs/05-asteroids-game.md`, `specs/06-games-table-and-leaderboard.md`.
