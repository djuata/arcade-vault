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

- `lint` runs **`eslint` directly**, not `next lint` — `next lint` was removed in Next.js 16.
- **No test runner is configured.** There is no test command, framework, or spec files yet; don't assume Jest/Vitest exist.

## Architecture

- **App Router at the repo root** (`app/`), not under `src/`. `app/layout.tsx` is the root layout; `app/page.tsx` the home route.
- **Path alias**: `@/*` maps to `./*` (repo root), so `@/app/...`, not `@/src/...`.
- **Typed route props (Next 16)**: layouts/pages receive generated global types like `LayoutProps<"/">` and `PageProps<...>`. These come from `.next/types` and are globally available — **do not import them and do not hand-write the props interface.**
- **Tailwind v4, CSS-first**: there is **no `tailwind.config.js`**. Theme and tokens live in `app/globals.css` via `@import "tailwindcss"` + `@theme inline { ... }`. PostCSS wires it through `@tailwindcss/postcss` in `postcss.config.mjs`.
- **ESLint flat config** (`eslint.config.mjs`) composes `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` — subpath configs, not a single `next` preset.
- **Fonts**: `next/font/google` loads Geist / Geist Mono in `app/layout.tsx`, exposed as the CSS vars `--font-geist-sans` / `--font-geist-mono` (referenced by Tailwind's `--font-sans` / `--font-mono`).

## Product context: this is not the create-next-app placeholder

`app/page.tsx` is still the **unmodified `create-next-app` scaffold**. The real product to build lives, as a reference, in `resources/templates/`:

- `resources/templates/Arcade Vault.html` + `*.jsx` is a standalone, buildless prototype (React 18 UMD + in-browser Babel via `<script type="text/babel">`, loaded straight from `unpkg`) of **Arcade Vault**, a Spanish-language retro arcade game portal.
- It defines five screens wired through hand-rolled hash routing in `app.jsx`: `biblioteca` (game library grid, `biblioteca.jsx`), `detalle` (game detail, `detalle.jsx`), `player` (gameplay + HUD, `reproductor.jsx`), `auth` (login/signup, `auth.jsx`), and `salon` (hall of fame, `salon.jsx`) — plus a shared `nav.jsx`, mock catalog data in `data.jsx`, and the neon/pixel visual language in `styles.css`.
- Treat these files as a **design and behavior spec, not code to port as-is**: they rely on globals (`React`, `window.Nav`), `location.hash` string routing, and `localStorage` for session/auth/scores — none of which match the App Router. When implementing a screen, translate its intent (routes, props, interactions) into idiomatic Next.js 16 routes/components and React 19 state, not a copy-paste.
