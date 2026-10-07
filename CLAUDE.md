# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Read this before writing code

`AGENTS.md` (imported above) is not boilerplate: this project runs **Next.js 16 + React 19 + Tailwind v4**, and several APIs, conventions, and file layouts differ from older Next.js. Before writing app code, consult the version-bundled guides in `node_modules/next/dist/docs/` — that directory (and the whole `node_modules/`) only appears **after installing deps and running `next dev`**. If it's missing, install first.

## Commands

| Task | Command |
| ---- | ------- |
| Install deps | `npm install` (project uses npm — `package-lock.json` is the lockfile) |
| Dev server | `npm run dev` → http://localhost:3000 |
| Production build | `npm run build` |
| Serve build | `npm start` |
| Lint | `npm run lint` |
| Supabase health check | `curl localhost:3000/api/health/supabase` → `{ ok: true }` |

- `lint` runs **`eslint` directly**, not `next lint` — `next lint` was removed in Next.js 16.
- **No test runner is configured.** There is no test command, framework, or spec files yet; don't assume Jest/Vitest exist. Verification is manual (`npm run dev`) plus RLS probes against Supabase.

## Product

**Arcade Vault** is a Spanish-language retro arcade portal: a game gallery that keeps **growing**, where users play in the browser and compete on per-game leaderboards. UI copy is Spanish (`<html lang="es">`).

| Route | File | What it does |
| ----- | ---- | ------------ |
| `/` | `app/page.tsx` → `components/home/Home.tsx` | Landing page (spec 02) |
| `/games` | `app/games/page.tsx` → `components/library/` | Library grid with category filters |
| `/games/[id]` | `app/games/[id]/page.tsx` → `components/detail/` | Game detail + top 10 |
| `/games/[id]/play` | `app/games/[id]/play/page.tsx` → `components/player/` | Player: canvas engine + HUD + save score |
| `/hall-of-fame` | `app/hall-of-fame/page.tsx` → `components/hall-of-fame/` | Top 10 per game, tabbed |
| `/login` | `app/login/page.tsx` → `components/auth/` | Mock login/signup (localStorage) |
| `/about` | `app/about/page.tsx` → `components/about/` | About + contact form (spec 03) |
| `POST /api/contact` | `app/api/contact/route.ts` | Zod-validated contact form → Resend email (honeypot field) |
| `GET /api/health/supabase` | `app/api/health/supabase/route.ts` | Supabase connectivity check |

Pages are thin async Server Components that fetch data and hand it to a component in `components/<feature>/`; interactive pieces are Client Components inside those folders.

## Architecture

- **App Router at the repo root** (`app/`), not under `src/`. Path alias `@/*` → `./*` (`@/lib/...`, `@/components/...`).
- **Typed route props (Next 16)**: layouts/pages use the global `LayoutProps<"/">` / `PageProps<"/games/[id]">` generated in `.next/types`. **Don't import them or hand-write props interfaces.** `params` is a Promise: `const { id } = await props.params`.
- **Tailwind v4, CSS-first**: no `tailwind.config.js`. Tokens live in `app/globals.css` (`@import "tailwindcss"` + `@theme inline`). Most of the neon/pixel look is plain CSS classes in `globals.css` (`.av-*`, `.crt-screen`, and one `.cover-<name>` class per catalog game).
- **Fonts**: `next/font/google` in `app/layout.tsx` loads Press Start 2P, JetBrains Mono and Courier Prime as `--font-press-start`, `--font-jetbrains-mono`, `--font-courier-prime`.
- **ESLint flat config** (`eslint.config.mjs`) composes `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`.

### Data layer (Supabase)

- Clients: `lib/supabase/server.ts` (async, cookie-aware, for Server Components/route handlers) and `lib/supabase/client.ts` (browser). Both typed with `lib/supabase/database.types.ts` (generated — regenerate with the Supabase MCP `generate_typescript_types` **only** when the schema changes).
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key only — never a secret/service key). See `.env.example`.
- Schema (`supabase/migrations/`): tables `games` (catalog; `cat`/`color` have CHECK constraints, `sort_order`, `playable`) and `scores` (`player_name` 1–10 chars, `score` 1–99,999,999). Views `games_with_stats` (adds `best_score`, `plays_count`) and `scores_ranked` (adds `rank`), both `security_invoker`.
- **RLS**: everything is publicly readable; `scores` insert is only allowed for games with `playable = true`. No other writes.
- Readers: `lib/data/games.ts` (`getGames`, `getGameById`, wrapped in React `cache`) and `lib/data/scores.ts` (`getTopScores`, `getTopScoresByGame`). Domain types (`Game`, `ScoreRow`, `GameCategory`, `GameAccent`) and helpers (`toPlayerName`, `formatBest`) live in `lib/games.ts`. Errors thrown to the UI are generic Spanish messages — never leak Supabase details.
- Migrations: one file per change, `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`, applied with the Supabase MCP `apply_migration` using the same SQL. Project ref is in `.mcp.json`.

### Game engines

- Every game is a **pure-TS canvas engine** in `lib/games/<slug>/` (no React), exposing a factory `create<Name>Game(canvas, callbacks): GameEngine`. Contracts in `lib/games/types.ts`: `GameEngine` (`pause/resume/restart/destroy`) and `GameCallbacks` (`onScore`, `onLevel`, `onGameOver`, optional `onLives` — when an engine never emits it, the HUD hides lives).
- `lib/games/registry.ts` → `GAME_ENGINES` maps slug → factory. Currently playable: `rocas` (Asteroids), `tetris`, `arkanoid`, `snake`. Catalog entries without an engine render the mock arena. **`GAMES.md`** documents every playable game (controls, rules, files) — keep it in sync when adding one.
- `components/player/GameCanvas.tsx` mounts the engine (fixed 800×600, CSS-scaled to 4:3) and destroys it on unmount; `callbacks` must be referentially stable. `components/player/GamePlayer.tsx` owns the chrome: HUD, pause (`P`), "FIN DEL JUEGO" modal, and inserting the score into `scores` via the browser client. Engines draw only the game.
- **Invariant**: slug = `games.id` = route segment = `GAME_ENGINES` key = `scores.game_id` = engine folder. And `GAME_ENGINES[slug]` exists **⇔** `games.playable = true` — always change both together.
- Sprite assets live in `public/games/<slug>/`. Original sources in `resources/started-games/` are reference only — never edit `resources/`.

### Session

`lib/session-context.tsx` is a **mock** session (`SessionProvider` / `useSession`) backed by `localStorage` key `av_user` via `useSyncExternalStore`. There is no real auth yet; the player name comes from it or from the save-score modal.

## Workflow: spec-driven development

Every feature goes through a spec in `specs/NN-<slug>.md` (Spanish, `> **Status:** Draft → Approved → Implemented`). Specs 01–09 are implemented: MVP visual, home, about/contact, Supabase connection, Asteroids, games table + leaderboard, Tetris, Arkanoid, Snake.

- One branch per spec: `spec-NN-<slug>` (`specs/.spec-config.yml` → `AutoCreateBranch: true`), merged via PR.
- Conventional commits: `docs: add spec NN ...` → `feat: ... (spec NN)` → `docs: mark spec NN as implemented`.

### Project skills (`.agents/skills/`, symlinked into `.claude/skills/`)

| Skill | Use |
| ----- | --- |
| `/spec` | Guided spec designer; writes `specs/NN-*.md` as Draft. User-invoked only (from `Klerith/fernando-skills`, pinned in `skills-lock.json`). |
| `/spec-impl <NN-spec>` | Implements an **Approved** spec: creates the branch and goes step by step pausing for diffs. User-invoked only. |
| `arcade-vault-game` | Create or port a game (engine + registry + migration + cover CSS + RLS check). **Spec-first**: writes the Draft spec, then STOPS for approval before touching `lib/`, `app/` or `supabase/`. Includes templates in `assets/` (`engine.ts.tpl`, `input.ts.tpl`, `migration.sql.tpl`). |
| `/frontend-design` | Use it always when designing UI. |

### Gallery rule

Arcade Vault **adds** games; it never repurposes existing catalog placeholders (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) without asking. A new game is a new catalog row with its own slug, `sort_order` and `.cover-*` class.

### MCP servers

`.mcp.json` configures the Supabase MCP for this project (migrations, SQL, type generation, advisors, publishable keys). Playwright MCP output directories are gitignored.

## Reference material

`resources/templates/` (the original `Arcade Vault.html` + `*.jsx` buildless prototype, and `home-about/`) is a **design and behavior spec, not code to port**: it uses globals, `location.hash` routing and `localStorage` scores. Translate intent into App Router routes, Server/Client Components and Supabase data. `resources/started-games/` holds the original vanilla-JS games that the engines in `lib/games/` were ported from.
