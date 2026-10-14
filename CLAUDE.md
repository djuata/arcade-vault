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
| `/login` | `app/login/page.tsx` → `components/auth/` | Supabase Auth sign-in/sign-up + Google/GitHub buttons (Server Actions in `app/login/actions.ts`); redirects to `/games` with a session (specs 19, 20) |
| `/login/nombre` | `app/login/nombre/page.tsx` → `components/auth/ChooseUsername.tsx` | Mandatory "ELIGE TU NOMBRE" for a session without a profile (new OAuth player) (spec 20) |
| `GET /auth/callback` | `app/auth/callback/route.ts` | OAuth return: exchanges the PKCE `code`, then `/games` or `/login/nombre`; failures → `/login?error=oauth` (spec 20) |
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
- **Security headers (spec 21)**: `next.config.ts` sends `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (camera/mic/geo off) and HSTS (1 year, no preload) on every route (`/(.*)`), and `poweredByHeader: false`. No CSP yet (needs proxy nonces; its own spec). `allowedDevOrigins` in that file is a local-only change: stage `next.config.ts` with `git add -p`.

### Data layer (Supabase)

- Clients: `lib/supabase/server.ts` (async, cookie-aware, for Server Components/route handlers) and `lib/supabase/client.ts` (browser). Both typed with `lib/supabase/database.types.ts` (generated — regenerate with the Supabase MCP `generate_typescript_types` **only** when the schema changes).
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key only — never a secret/service key), plus server-only `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` for `/api/contact` (`lib/resend.ts`, `lib/contact.ts`). See `.env.example`.
- Schema (`supabase/migrations/`): tables `games` (catalog; `cat`/`color` have CHECK constraints, `sort_order`, `playable`), `profiles` (`id` = `auth.users.id`, unique `username` `^[A-Z0-9_]{3,10}$`, `INVITADO` reserved; created by the `handle_new_user` trigger on `auth.users` (whose `EXECUTE` is revoked) when the sign-up carries a `username`; OAuth sign-ups carry none, so the player inserts their own row on `/login/nombre`) and `scores` (`player_name` 1–10 chars, `score` 1–99,999,999, nullable `user_id` → `profiles`). Views `games_with_stats` (adds `best_score`, `plays_count`) and `scores_ranked` (adds `rank`, `user_id`), both `security_invoker`.
- **RLS**: everything is publicly readable. `scores` insert only for `playable` games, and: `authenticated` must use `user_id = auth.uid()` and `player_name` = its profile username; `anon` must use `user_id` null and a `player_name` that isn't a registered username. `profiles` insert only for `authenticated` with `id = auth.uid()` (once, by PK; policy "players create their own profile"). No updates or deletes anywhere: usernames are permanent.
- **`ensure_rls` event trigger**: created by the dashboard's "auto-enable RLS" option (not in migrations); its `SECURITY DEFINER` function `public.rls_auto_enable()` enables RLS on every new `public` table. `EXECUTE` is revoked from `public`/`anon`/`authenticated` (migration `restrict_rls_auto_enable`, spec 21). Still enable RLS explicitly in each migration. The only expected security advisor is `auth_leaked_password_protection` (see *Session*).
- Readers: `lib/data/games.ts` (`getGames`, `getGameById`, wrapped in React `cache`) and `lib/data/scores.ts` (`getTopScores`, `getTopScoresByGame`). Domain types (`Game`, `ScoreRow`, `GameCategory`, `GameAccent`) and helpers (`toPlayerName`, `formatBest`) live in `lib/games.ts`. Errors thrown to the UI are generic Spanish messages — never leak Supabase details.
- Migrations: one file per change, `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`, applied with the Supabase MCP `apply_migration` using the same SQL. Project ref is in `.mcp.json`.

### Game engines

- Every game is a **pure-TS canvas engine** in `lib/games/<slug>/` (no React), exposing a factory `create<Name>Game(canvas, callbacks): GameEngine`. Contracts in `lib/games/types.ts`: `GameEngine` (`pause/resume/restart/destroy`) and `GameCallbacks` (`onScore`, `onLevel`, `onGameOver`, optional `onLives` — when an engine never emits it, the HUD hides lives).
- `lib/games/registry.ts` → `GAME_ENGINES` maps slug → factory. Currently playable: `rocas` (Asteroids), `tetris`, `arkanoid`, `snake`, `croac`, `frogger` — the whole catalog (spec 13 removed the engine-less placeholders). **`GAMES.md`** documents every playable game (controls, rules, files) — keep it in sync when adding one. Candidate games live in **`GAMES-TODO.md`** (maintained by the `game-planner` agent).
- `components/player/GameCanvas.tsx` mounts the engine (fixed 800×600, CSS-scaled to 4:3) and destroys it on unmount; `callbacks` must be referentially stable. `components/player/GamePlayer.tsx` owns the chrome: HUD, pause (`P`), "FIN DEL JUEGO" modal, and inserting the score into `scores` via the browser client. Engines draw only the game.
- **Invariant**: slug = `games.id` = route segment = `GAME_ENGINES` key = `scores.game_id` = engine folder (one legacy exception: `rocas` lives in `lib/games/asteroids/`; new games must match). And `GAME_ENGINES[slug]` exists **⇔** `games.playable = true` — always change both together.
- **Touch controls (spec 12)**: `components/player/TouchControls.tsx` renders a D-pad + action buttons inside `.crt`, below the canvas, only on `@media (pointer: coarse)`. It dispatches synthetic `KeyboardEvent`s on `window`, so engines must read **only `e.code`** (never `e.key`/`isTrusted`). Each game's layout lives in `lib/games/<slug>/touch.ts` and is registered in `GAME_TOUCH_CONTROLS` (`lib/games/registry.ts`); types and the D-pad math are in `lib/games/touch-controls.ts`. An engine without a layout shows "REQUIERE TECLADO".
- **Skins (specs 11, 16)**: optional palette skins (`classic` default, `neon`, `retro`) via `lib/games/skins.ts`, per-game `lib/games/<slug>/skins.ts`, `GAME_SKINS` in the registry and `components/player/SkinSelector.tsx` (persists `av_skin_<slug>`). Engines take `options.skin` and may expose `setSkin?` (live swap). Today only `snake` and `frogger` have skins.
- **Glow (spec 18)**: `shadowBlur` is expensive on mobile GPUs. For fixed-size glowing rects use `createGlowCache()` from `lib/games/glow-cache.ts` (one sprite per color+size+blur, `clear()` on `setSkin` and `destroy`); keep `shadowBlur` only for shapes whose size changes every frame. Static backgrounds go in an offscreen canvas (see `lib/games/frogger/render.ts`). Don't add CSS animations that keep running behind the player: the canvas forces a main-thread frame every rAF, which ticks every live animation.
- Sprite assets live in `public/games/<slug>/`. Original sources in `resources/started-games/` are reference only — never edit `resources/`.

### Session

Real auth since **spec 19**: Supabase Auth with email + password (no email confirmation, min 8 chars — dashboard settings, not in migrations). **Spec 21** dashboard settings: sign-ups + sign-ins rate limit 30 per 5 min per IP — but auth runs in Server Actions, so Supabase sees the Next server's IP and the limit is effectively **global** (CAPTCHA or a per-client limiter is needed before deploy). Leaked password protection (HaveIBeenPwned) is **off**: the project is on the Free plan, which doesn't offer it (accepted risk). Password requirements: lower + upper + digit + symbol (dashboard), mirrored by `passwordSchema` in `lib/auth/schemas.ts` (sign-up only; `signInSchema` keeps `min(8)` so older passwords still sign in) — keep both in sync. **Spec 20** adds Google and GitHub (OAuth apps and redirect URLs live in the provider consoles + Supabase dashboard, localhost only; secrets never go in the repo).

- **Cookies are HttpOnly** (`lib/supabase/session-cookies.ts`, passed as `cookieOptions` to the server client and the proxy). The browser client never sees the session, so **anything that needs the user runs on the server**: `app/login/actions.ts` (`signIn`/`signUp`/`signOut`, Zod in `lib/auth/schemas.ts`, Spanish messages in `lib/auth/messages.ts`) and `app/games/[id]/play/actions.ts` (`saveScore`). The browser client is only for public reads.
- `proxy.ts` (Next 16's renamed middleware) → `lib/supabase/proxy.ts` `updateSession` refreshes the token on every request, and **redirects a session without a profile to `/login/nombre`** from every path except `/login/nombre`, `/auth/*` and `/api/*`. The gate lives in the proxy because the root layout doesn't re-render on client navigations.
- **Route access (spec 22)**: `lib/auth/route-access.ts` (pure) lists `PROTECTED_PATHS` (need a session → `/login`; match path + subtree) and `GUEST_ONLY_PATHS` (with a session → `/games`; exact match). `updateSession` applies them in this order: protected check, profile gate, guest-only check. This is an **optimistic** check (Next's proxy is not an authorization layer): every protected page and its Server Actions must check the session again, and RLS stays the real boundary. A new private route = add it to `PROTECTED_PATHS` **and** check in its page/actions.
- **OAuth (spec 20)**: `signInWithOAuth` (Server Action) starts PKCE — the code verifier stays in an HttpOnly cookie — and `app/auth/callback/route.ts` exchanges the code. `chooseUsername` (`app/login/nombre/actions.ts`) creates the profile, with a suggestion from `lib/auth/username.ts`. Profile lookups shared by actions, callback and proxy are in `lib/auth/profiles.ts` (a plain module, so they never become callable actions). Supabase **automatic identity linking** is on: same email → same user. ⚠️ With email confirmation off this allows pre-account takeover; it must be fixed (email confirmation or linking off) before any production deploy.
- `lib/auth/session.ts` `getSessionUser()` (React `cache`) reads claims + profile; `app/layout.tsx` passes it to `SessionProvider` (`lib/session-context.tsx`), which exposes `{ user: { id, name } | null, logout }`. No `onAuthStateChange`: auth actions set cookies and the layout re-renders. `logout` = `signOut` + full navigation to `/`.
- No product route is protected; login stays optional. Logged in, the score name is the username (not editable); guests type a free name.

## Workflow: spec-driven development

Every feature goes through a spec in `specs/NN-<slug>.md` (Spanish, `> **Status:** Draft → Approved → Implemented`). Specs 01–18 are all Implemented (games: 05 Asteroids, 07 Tetris, 08 Arkanoid, 09 Snake, 10 Croac, 15 Frogger; skins 11/16; touch 12; mobile-first 14/17; render performance 18). `specs/game-jam/` keeps the jam proposals as history.

- One branch per spec: `spec-NN-<slug>` (`specs/.spec-config.yml` → `AutoCreateBranch: true`), merged via PR.
- Conventional commits: `docs: add spec NN ...` → `feat: ... (spec NN)` → `docs: mark spec NN as implemented`.

### Project skills (`.agents/skills/`, symlinked into `.claude/skills/`)

| Skill | Use |
| ----- | --- |
| `/spec` | Guided spec designer; writes `specs/NN-*.md` as Draft. User-invoked only. |
| `/spec-impl <NN-spec>` | Implements an **Approved** spec: creates the branch and goes step by step pausing for diffs. User-invoked only. |
| `/spec-impl-game <NN-slug-game>` | `/spec-impl` for **game specs** (`specs/NN-<slug>-game.md`): follows `spec-impl`'s phases by reference (not a copy), then runs `skin-designer` and **then** `mobile-porter` (`/games/<slug>` + `/games/<slug>/play`) sequentially, since both take "highest spec + 1". Both only write Draft specs. User-invoked only. |
| `arcade-vault-game` | Create or port a game (engine + registry + migration + cover CSS + RLS check). **Spec-first**: writes the Draft spec, then STOPS before touching `lib/`, `app/` or `supabase/`. Templates in `assets/` (`engine.ts.tpl`, `input.ts.tpl`, `migration.sql.tpl`). |

`spec` and `spec-impl` come from `Klerith/fernando-skills`, pinned in `skills-lock.json`. Also use the **global** `/frontend-design` skill (not in this repo) whenever designing UI.

### Project subagents (`.claude/agents/`)

All run on **Opus**; only `game-planner` has memory. The five "spec-first" agents work in **two runs**: Phase A audits and writes `specs/NN-<slug>-<kind>.md` (Draft) and STOPS; Phase B implements once the spec is Approved. One target per run.

| Agent | Input → output | Scope / never touches |
| ----- | -------------- | --------------------- |
| `game-planner` | Decides **which game to add next**: scores 2–4 candidates against the real state (`GAMES.md`, registry, `specs/`, migrations, `resources/started-games/`) and recommends ONE → hands off to `arcade-vault-game`. | Writes only `GAMES-TODO.md` and its memory. No code, specs or migrations. |
| `game-jam` | One brief (theme, slug, name, `cat`, `color`, angle) → ONE spec in `specs/game-jam/<slug>/<slug>-game.md` (format of specs 07–09). Launched 3× in parallel, see *Game jam*. | Nothing else. |
| `skin-designer` | Game id → `-skins` spec; ensures `classic`/`neon`/`retro` + the skin selector (contract in *Skins* above). | No `supabase/`, no gameplay. |
| `mobile-porter` | Route, `components/` folder or `todo` → `-mobile` spec. Playwright audit at 375/390 (+ player landscape), 768, 1280: overflow, touch ≥ 44px, text ≥ 14px, inputs ≥ 16px; static audit if `npm run dev` is down. New CSS mobile-first (`min-width: 768/1024px`). | Writes only `app/globals.css`, `components/**`, `app/layout.tsx` (`viewport`) and the target's pages. Never `lib/games/**`, data, `supabase/`, `public/`. |
| `game-performance` | Game id → `-performance` spec with baseline, built on spec 18. Bench A: Playwright + CDP CPU 4x, main-thread ms/s, **paired runs only** (rAF delta is vsync-saturated, never used). Bench B: Android via `adb` — the only judge for GPU costs like `shadowBlur`. A fix ships only if its isolation variant improves ≥ 10%; deterministic canvas captures prove no visual change. Harness in gitignored `.playwright-mcp/perf/`. | Writes only the game's `render.ts`/`engine.ts` (caches), `glow-cache.ts` and player CSS. Never gameplay, `touch.ts`, data, `supabase/`, `public/`. |
| `security-auditor` | `db`, `app`, `todo` or one area (`/login`, `scores`) → `-security` spec, built on specs 21–22. DB: advisors, RLS, `pg_policies`, grants, `SECURITY DEFINER` + `EXECUTE`, migration drift, role probes **inside a `DO` block that raises to roll back** (never real writes). App: Server Actions re-check session + Zod, route handlers, proxy lists, HttpOnly cookies, secrets, headers (`curl -sI`), `npm audit`. Accepted risks (leaked passwords, global auth rate limit, pre-account takeover, no CSP) are reported as `ACEPTADO`, not new findings; with no new findings it writes nothing. | Writes only migrations, `lib/auth/`, `lib/supabase/`, `proxy.ts`, `app/**/actions.ts`/`route.ts` named by the spec. Never games, UI, `public/`, real `.env`, dashboard settings (manual steps). |

**`GAMES-TODO.md`** is the committed **source of truth** for game ideas: *Pendientes de decisión* → *Aceptados* → *Implementados*, or *Descartados* (with reason); each game appears once and manual edits count as decisions. `game-planner`'s memory (`.claude/agent-memory/game-planner/MEMORY.md`) only holds preferences and longer reasons, and it never re-suggests a discarded game unless asked. When a game is accepted or implemented, move it in `GAMES-TODO.md` (or tell `game-planner`).

### Game jam (main thread orchestrates)

Triggered when the user asks for a "game jam sobre <tema>". Subagents can't spawn subagents, so **the main thread is the orchestrator** and `game-jam` is only the designer:

1. **Prepare**: read `GAMES-TODO.md`, `lib/games/registry.ts` and `supabase/migrations/` (taken slugs and `sort_order`, under-represented `cat`/`color`). Get the date with `date +%F`.
2. **Write 3 distinct briefs**: unique slug (not in `games`, not in *Descartados*), `nombre`, varied `cat`/`color`, a different **angle** each (e.g. acción/reflejos, puzzle/estrategia, shooter/esquivar), `fecha`, a suggested `sort_order` (distinct per brief) and the list of taken slugs. Show the 3 briefs, one line each.
3. **Launch** 3 `Agent` calls with `subagent_type: "game-jam"` **in a single message** (parallel).
4. **Compare**: table with name, `cat`/`color`, pitch, effort and main risk, linking the 3 specs. Ask with `AskUserQuestion` which one wins (or none), then STOP.
5. **Promote the winner**: NN = highest number in `specs/` + 1. Copy it to `specs/NN-<slug>-game.md` with title `# SPEC NN — …` (drop "(game jam)"), keep `Status: Draft` and the `Game jam:` line as provenance. Leave the 3 `specs/game-jam/` folders untouched as history.
6. **To-do**: in `GAMES-TODO.md`, the winner goes to *Aceptados* and the losers to *Descartados* with reason `perdió el game jam "<tema>" YYYY-MM-DD`.
7. **Next step**: "Revisá `specs/NN-…` y, si lo aprobás, invocá `arcade-vault-game`" (it reuses the existing Draft instead of rewriting it).

### Gallery rule

Arcade Vault **adds** games: a new game is a new catalog row with its own slug, `sort_order` and `.cover-*` class, created already `playable` together with its engine. The catalog only holds playable games — no placeholder rows (spec 13 deleted them).

### MCP servers

`.mcp.json` configures the Supabase MCP for this project (migrations, SQL, type generation, advisors, publishable keys). Playwright MCP output directories are gitignored.

## Reference material

`resources/templates/` (the original `Arcade Vault.html` + `*.jsx` buildless prototype, and `home-about/`) is a **design and behavior spec, not code to port**: it uses globals, `location.hash` routing and `localStorage` scores. Translate intent into App Router routes, Server/Client Components and Supabase data. `resources/started-games/` holds the original vanilla-JS games that the engines in `lib/games/` were ported from.
