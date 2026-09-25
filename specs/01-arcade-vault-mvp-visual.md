# SPEC 01 — MVP visual de Arcade Vault: biblioteca, detalle, login, jugador y salón de la fama

> **Status:** Implemented
> **Depends on:** Ninguna (primera spec del proyecto)
> **Date:** 2026-09-24
> **Objective:** Implementar las cinco pantallas del prototipo (biblioteca, detalle, login, reproductor y salón de la fama) como rutas reales de Next.js App Router, replicando el diseño visual exacto de `resources/templates/` sin implementar mecánicas de juego reales.

---

## Por qué existe esta spec

El prototipo en `resources/templates/` es una SPA de un solo componente: rutea con `location.hash`, comparte estado (`user`) porque todo vive en el mismo árbol de React, y persiste todo en `localStorage` sin ninguna capa intermedia. Next.js App Router parte eso en archivos de ruta independientes, así que hay tres decisiones de arquitectura que el prototipo no resuelve solas y que ya se cerraron con el usuario:

1. **Rutas:** esquema en inglés (`/`, `/games/[id]`, `/games/[id]/play`, `/login`, `/hall-of-fame`) en vez de los nombres en español de las pantallas.
2. **Sesión compartida:** Context de React + `localStorage`, provisto en el layout raíz — no relectura independiente por página.
3. **Breakpoints:** se mantienen los del prototipo (720/840/900px) por encima de la tabla estándar de la regla global de diseño responsive (768/1024px), porque la fidelidad visual exacta al prototipo fue un pedido explícito anterior.

---

## Scope

**In:**

- Rutas de Next.js App Router reemplazando el hash-router del prototipo: `app/page.tsx` (biblioteca), `app/games/[id]/page.tsx` (detalle), `app/games/[id]/play/page.tsx` (reproductor), `app/login/page.tsx` (login), `app/hall-of-fame/page.tsx` (salón de la fama).
- Chrome compartido portado de `app.jsx`: navbar (`Nav`, con panel móvil hamburguesa), el wrapper `<main className="av-main">` ya presente en `app/layout.tsx`, y el footer de copyright.
- Sesión de usuario compartida entre todas las rutas vía un Context de React respaldado por `localStorage` (clave `av_user`, forma `{ name: string }`), igual que el prototipo.
- Pantalla **Biblioteca** (`app/page.tsx`): hero, buscador, chips de categoría, grilla de cards con tilt al hover, estado vacío "NO HAY RESULTADOS" — portado de `biblioteca.jsx`.
- Pantalla **Detalle** (`app/games/[id]/page.tsx`): cover, tags, franja de stats, botones de acción, leaderboard lateral generado con `seededScores()` — portado de `detalle.jsx`.
- Pantalla **Login** (`app/login/page.tsx`): tabs iniciar sesión/crear cuenta, botón invitado, botones sociales decorativos — portado de `auth.jsx`, 100% falso (sin backend, sin OAuth real).
- Pantalla **Reproductor** (`app/games/[id]/play/page.tsx`): HUD (jugador/puntuación/vidas/nivel), la misma arena CRT decorativa con formas a la deriva, controles de pausa/fin, y el modal de fin de juego con el flujo de guardado de puntaje que escribe en `localStorage` (clave `av_scores`) — portado de `reproductor.jsx`, sin tocar su simulación de puntaje por intervalo (es decorativa, no un juego real).
- Pantalla **Salón de la Fama** (`app/hall-of-fame/page.tsx`): tabs por juego, podio top 3, tabla completa, fila "tu mejor marca" cuando hay sesión — portado de `salon.jsx`.
- Módulo de datos mock (`lib/games.ts`): los 8 juegos, categorías, pool de nombres de jugadores y el generador `seededScores()`, portados 1:1 de `data.jsx` con tipos de TypeScript.
- Breakpoints responsive exactamente como están en `styles.css` del prototipo (720px/840px/900px), ya portados verbatim a `app/globals.css` en una sesión anterior.

**Out of scope (para specs futuras):**

- Mecánicas de juego reales para cualquiera de los 9 títulos (colisiones, controles de teclado/táctiles, renderizado en canvas, reglas de puntuación). El reproductor queda igual de decorativo/simulado que el prototipo.
- Autenticación y backend reales (cuentas reales, OAuth real de Google/GitHub, validación de contraseñas).
- Un sistema de créditos real — el contador "CRÉDITOS · 03" del navbar queda como texto hardcodeado, igual que en el prototipo.
- Leer de vuelta los puntajes guardados (`av_scores`) en cualquier pantalla — el Salón de la Fama sigue usando el generador determinístico `seededScores()`, exactamente como hace el prototipo hoy.
- Tests automatizados de cualquier tipo (unitarios, integración, regresión visual) — el proyecto no tiene test runner configurado.
- Metadata/SEO más allá del `<title>` mínimo por ruta para distinguirlas.

---

## Data model

```ts
// lib/games.ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameAccent = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string; // clase CSS, ej. "cover-bricks"
  color: GameAccent;
  best: number;
  plays: string; // string de display, ej. "12.4K"
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/YYYY"
}
```

`seededScores(seed: number, count = 12): ScoreRow[]` — generador pseudo-aleatorio determinístico (mismo LCG del prototipo), portado 1:1 para que el leaderboard renderice filas idénticas en servidor y cliente sin mismatch de hidratación.

```ts
// lib/session-context.tsx
interface Session {
  name: string;
}
// Valor del contexto: { user: Session | null; login: (u: Session | null) => void; logout: () => void }
```

Persistida bajo la misma clave del prototipo: `av_user`.

```ts
// escrito por el flujo de guardado de puntaje en /games/[id]/play
interface SavedScore {
  game: string; // Game.id
  score: number;
  name: string;
  at: number; // Date.now()
}
```

Se agrega al array en `localStorage` bajo la clave `av_scores`, igual que `handleSaveScore` en el prototipo.

---

## Implementation plan

1. Crear `lib/games.ts` con los tipos `Game`/`ScoreRow`, `GAMES` (9 entradas), `CATS`, `PLAYERS` y `seededScores()`, portados 1:1 de `resources/templates/data.jsx`. Test manual: `npx tsc --noEmit` sin errores.
2. Crear `lib/session-context.tsx` (`SessionProvider` + `useSession()`) respaldado por `localStorage` bajo `av_user`, y envolver con él el contenido de `app/layout.tsx`. Test manual: el dev server sigue renderizando la home actual sin errores de consola.
3. Construir `components/nav/Nav.tsx` (links de escritorio + panel móvil + backdrop) y un `Footer` simple, usando `useSession()` para el botón de login/usuario; integrarlos en `app/layout.tsx` alrededor de `<main className="av-main">`. Test manual: cualquier ruta muestra el navbar sticky y el footer, igual que `Arcade Vault.html`.
4. Construir `app/page.tsx` (Biblioteca): hero, buscador, chips de categoría, grilla de `GameCard` con tilt al hover, y el estado vacío, leyendo de `lib/games.ts`, reemplazando el placeholder de `create-next-app`. Test manual: comparar grilla, búsqueda y chips contra el prototipo en el navegador.
5. Construir `app/games/[id]/page.tsx` (Detalle): cover, tags, franja de stats, botones ("JUGAR AHORA" → `/games/[id]/play`, "VOLVER AL VAULT" → `/`), y el leaderboard vía `seededScores()`. Test manual: navegar desde una card hasta su detalle y comparar leaderboard/stats contra el prototipo.
6. Construir `app/login/page.tsx`: tabs, formulario, botón invitado (llama a `login()` del contexto y redirige a `/`), botones sociales decorativos. Test manual: loguearse con cualquier texto, confirmar que el navbar cambia a mostrar el nombre; salir, confirmar que vuelve a "Iniciar Sesión".
7. Construir `app/games/[id]/play/page.tsx` (Reproductor): HUD, la arena CRT decorativa (animación pura, sin juego real), controles de pausa/fin, y el modal de fin con el guardado de puntaje en `av_scores`. Test manual: jugar hasta "FIN", guardar el puntaje, confirmar el toast y que `av_scores` en devtools creció una entrada.
8. Construir `app/hall-of-fame/page.tsx`: tabs por juego, podio, tabla completa, y la fila "tu mejor marca" con sesión iniciada. Test manual: cambiar de tab entre varios juegos y confirmar que podio/tabla se actualizan; loguearse y confirmar que aparece la fila.
9. Pase final de integración: verificar que cada link del Nav y cada CTA de cada pantalla lleva a la ruta correcta, correr `npm run lint`, y hacer un recorrido manual completo de las cinco rutas comparando lado a lado contra `resources/templates/Arcade Vault.html`.

---

## Acceptance criteria

- [x] La ruta `/` muestra la Biblioteca: hero, buscador, chips de categoría y grilla de 8 juegos.
- [x] Buscar por texto en la Biblioteca filtra la grilla en tiempo real; una búsqueda sin resultados muestra "NO HAY RESULTADOS".
- [x] Cada chip de categoría (TODOS, ARCADE, PUZZLE, SHOOTER, VERSUS) filtra correctamente la grilla.
- [x] Click en una card o en su botón "JUGAR" navega a `/games/[id]` con el detalle correspondiente.
- [x] `/games/[id]` muestra cover, tags, stats y un leaderboard de 10 filas generado con `seededScores()`.
- [x] El botón "JUGAR AHORA" en el detalle navega a `/games/[id]/play`.
- [x] `/games/[id]/play` muestra el HUD (jugador/puntuación/vidas/nivel), la pantalla CRT decorativa, y el puntaje incrementándose solo mientras el juego no está en pausa ni terminado.
- [x] El botón "PAUSA" detiene el incremento de puntaje y muestra el overlay "EN PAUSA"; "REANUDAR" lo continúa.
- [x] El botón "FIN" abre el modal de fin de juego con el puntaje final.
- [x] Guardar el puntaje en el modal agrega una entrada nueva en `localStorage` bajo la clave `av_scores` y muestra el toast "PUNTUACIÓN GUARDADA".
- [x] `/login` permite alternar entre "INICIAR SESIÓN" y "CREAR CUENTA", y cualquier texto en el campo usuario inicia sesión al enviar el formulario.
- [x] "JUGAR COMO INVITADO" inicia sesión sin usuario y redirige a `/`.
- [x] Tras iniciar sesión, el navbar muestra el nombre del usuario en vez de "Iniciar Sesión" en cualquier ruta.
- [x] `/hall-of-fame` muestra podio (top 3), tabla completa y tabs por juego; cambiar de tab actualiza podio y tabla.
- [x] Con sesión iniciada, `/hall-of-fame` agrega la fila "TU MEJOR MARCA EN [juego]" al final de la tabla.
- [x] El menú hamburguesa funciona por debajo de 840px de ancho, mostrando el panel lateral con backdrop.
- [x] `npm run lint` no reporta errores.
- [x] Ninguna ruta muestra errores en la consola del navegador al navegar entre las cinco pantallas.

---

## Decisions

- **Sí:** rutas en inglés (`/games/[id]`, `/games/[id]/play`, `/login`, `/hall-of-fame`). Decisión explícita del usuario.
- **Sí:** sesión compartida vía Context de React + `localStorage` en el layout raíz. Evita releer `localStorage` en cada página y el parpadeo del estado "invitado" al navegar.
- **No:** Zustand u otra librería de estado. Un Context alcanza para un único valor (`user`) compartido entre pocos componentes.
- **Sí:** datos mock en un módulo TypeScript estático (`lib/games.ts`), portado 1:1 de `data.jsx`. No existe backend todavía; una Route Handler agregaría indirección sin beneficio real.
- **No:** servir los juegos vía `app/api/games/route.ts`. Mismo motivo.
- **Sí:** mantener el guardado de puntaje en `localStorage` (`av_scores`) aunque hoy no se lea en ningún otro screen. Preserva el flujo visual completo (toast de confirmación) sin costo adicional.
- **Sí:** mantener los breakpoints originales del prototipo (720/840/900px) en vez de la tabla estándar del proyecto (768/1024px). La fidelidad visual exacta al prototipo fue un pedido explícito anterior, y esos breakpoints ya están andando en `app/globals.css`.
- **Sí:** login 100% decorativo/falso (sin backend, sin OAuth real), igual que el prototipo. Coincide con "solamente la parte visual".
- **No:** tooling de testing nuevo (Vitest/RTL) para este MVP. El proyecto no tiene test runner hoy; agregarlo es scope no pedido. Verificación por QA visual manual + lint.
- **Sí:** el reproductor mantiene exactamente la simulación decorativa del prototipo (arena CRT animada + puntaje incrementando por intervalo aleatorio) — no es un juego real ni en el prototipo ni acá, así que no viola "no implementar ningún juego".

---

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Hydration mismatch entre servidor y cliente al leer `localStorage` (`av_user`) en el primer render | `SessionProvider` inicializa `user` en `null` durante el render de servidor y sincroniza desde `localStorage` recién en un `useEffect` client-side. |
| `seededScores()` debe dar el mismo resultado en cada render para no generar hydration mismatch | Es determinística (LCG con seed fija), portada 1:1 — no usa `Math.random()` en el árbol de render. |
| `localStorage` deshabilitado (modo privado del navegador) | El login y el guardado de puntaje degradan sin crashear: si el acceso tira excepción, se ignora y la sesión/puntaje simplemente no persisten entre recargas — mismo comportamiento (`try/catch`) que el prototipo. |
| Breakpoints del prototipo (720/840/900) no calzan con la tabla estándar de la regla global de diseño responsive | Documentado como decisión explícita en la sección Decisions — no es un descuido. |

---

## What is **not** in this spec

- Mecánicas de juego reales para ninguno de los 9 títulos.
- Autenticación real, backend real, u OAuth real de Google o GitHub.
- Sistema de créditos real (el contador "CRÉDITOS · 03" queda hardcodeado).
- Lectura de los puntajes guardados (`av_scores`) en el Salón de la Fama u otra pantalla.
- Tests automatizados de cualquier tipo.
- Cambiar los breakpoints responsive a la tabla estándar del proyecto.

Cada uno de estos, si se necesita, va en su propia spec.
