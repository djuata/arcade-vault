# SPEC 18 — Rendimiento de render: fondo global y glow de los motores

> **Status:** Approved
> **Depends on:** SPEC 10 (croac-game), SPEC 11 (snake-skins), SPEC 14 (site-mobile-first), SPEC 15 (frogger-game), SPEC 16 (frogger-skins)
> **Date:** 2026-10-09
> **Objective:** Medir el costo de render del sitio y de los 6 juegos con un baseline repetible (CPU en desktop, frames en un Android real), y bajarlo hasta los umbrales de esta spec sin cambios visuales perceptibles.

> **Enmienda 2026-10-09 (durante el paso 1):** la métrica original (p95 del delta de rAF ≤ 16,7 ms con CPU 4x) era inalcanzable: el delta oscila alrededor del vsync y su p95 dio **17,6 ms en los 9 escenarios**, porque en desktop todo llega a 60 fps. Tampoco discrimina nada. Se reemplaza por (a) **hilo principal ocupado** (ms/s) y trabajo de rAF por frame en desktop con CPU 4x, y (b) **frames en un Android real** conectado por USB (`adb` + `connectOverCDP`), donde la GPU sí es el cuello de botella. Afecta: *Protocolo de medición*, D1, D7, *Criterios de aceptación* y *Riesgos*.

---

## Por qué existe esta spec

En FROGGER se notan tirones (FPS bajos) en celular (Android / Chrome) y en laptop. También se siente pesado navegar el resto del sitio. Que el sitio entero vaya lento descarta que el culpable sea **solo** el motor de FROGGER, porque ese motor no corre en `/` ni en `/games`.

Lo que sigue sale de una **lectura de código** del 2026-10-09. No es una medición. Por eso el paso 1 de esta spec mide, y cada arreglo se aplica solo si la medición lo justifica.

**Sospechosos globales (todas las páginas, `app/layout.tsx` + `app/globals.css`):**

1. `.av-bg::before` (`globals.css:107-122`) es una grilla en perspectiva de toda la pantalla, con `mask-image`, que anima **`background-position`** (`@keyframes gridscroll`). Esa propiedad no la anima el compositor: el navegador repinta la capa en cada frame, detrás de todo, siempre.
2. `.av-nav` (`globals.css:180`) es `sticky` y tiene `backdrop-filter: blur(8px)` sobre ese fondo animado. Por eso re-desenfoca la franja del nav en cada frame.
3. `.av-bg::after` (`globals.css:127-139`) son scanlines fijas a pantalla completa con `mix-blend-mode: overlay`, encima de una capa que cambia.
4. `.av-noise` (`globals.css:141-148`) es un SVG `feTurbulence` en data URI, fijo a pantalla completa. Es probablemente barato: se rasteriza una vez. Se mide igual.

**Sospechosos del player (todos los juegos):**

5. `.crt-screen::after` (`globals.css:861-867`) son scanlines con `mix-blend-mode: multiply` **encima del canvas**, que cambia 60 veces por segundo.

**Sospechosos de motor:**

6. FROGGER, `lib/games/frogger/render.ts:51-62`: `withGlow` usa `shadowBlur` en cada vehículo (≈20 por frame), la rana, la novia, la mosca, la serpiente y el timer. Está activo en `classic` (blur 8–10, `skins.ts:124`) y en `neon` (blur 8–16). Solo `retro` tiene glow 0. `shadowBlur` es de las operaciones más caras de canvas 2D, más en GPU móviles.
7. FROGGER, `drawBackground` (`render.ts:73-104`): repinta en cada frame el fondo estático (cientos de `fillRect`: hojas, ondas, marcas de carril).
8. CROAC, `lib/games/croac/render.ts:136`, `:242`, `:279`: `shadowBlur` fijo (10 / 8 / 8).
9. Snake, `lib/games/snake/render.ts:17-24`: `withGlow` con el blur de la paleta (SPEC 11), aplicado por segmento.

Tetris, Arkanoid y Asteroids no usan `shadowBlur`. Se miden igual, porque comparten los sospechosos 1–5.

---

## Alcance

**Entra:**

- **Medición** (paso 1): un baseline repetible con Playwright MCP + CDP de los 6 juegos y de las páginas `/` y `/games`, más corridas de **aislamiento** que atribuyen el costo a cada sospechoso. Los números quedan escritos en esta spec (sección *Mediciones*).
- **Fondo global**: misma apariencia, pero usando solo propiedades que anima el compositor. Respeta `prefers-reduced-motion`.
- **Nav**: se quita `backdrop-filter`, si la medición lo señala.
- **Scanlines del CRT**: `multiply` se cambia por blending normal (es matemáticamente idéntico, ver D3).
- **FROGGER**: fondo estático cacheado en un canvas offscreen y glow precalculado para las entidades de tamaño fijo.
- **CROAC y Snake**: el mismo glow precalculado, **solo si** la medición muestra que superan el umbral.
- Un módulo compartido `lib/games/glow-cache.ts`.
- Medición final con el mismo guion, más verificación manual en un Android real.

**Fuera de alcance (para futuras specs):**

- Arreglos de motor en Tetris, Arkanoid o Asteroids. Si alguno no cumple el umbral por causas **propias del motor** (no por el CSS compartido), va a otra spec.
- Overlay de FPS en el player (`?fps=1`). Se descartó (ver D7).
- Optimizar carga, bundle, LCP o data fetching. Esta spec trata **solo** el costo de render por frame.
- Cambiar resolución del canvas, `devicePixelRatio` u `OffscreenCanvas` en worker.
- Rediseñar los efectos visuales (menos grilla, sin scanlines). El look se conserva.
- Verificación en iPhone / Safari.

---

## Modelo de datos

No hay datos persistidos nuevos. Aparecen dos estructuras en memoria.

**1. Cache de glow (`lib/games/glow-cache.ts`):**

```ts
export interface GlowCache {
  /** Dibuja un rect relleno de `color` con su glow, usando un sprite precalculado. */
  rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, blur: number): void;
  /** Vacía los sprites: se llama en setSkin, porque cambian los colores. */
  clear(): void;
}
export function createGlowCache(): GlowCache;
```

- La clave del sprite es `` `${color}|${w}|${h}|${blur}` ``, con `w`/`h` redondeados a entero.
- Cada sprite es un `HTMLCanvasElement` de `(w + 4·blur) × (h + 4·blur)`, dibujado **una vez** con `shadowBlur`.
- Con `blur <= 0` dibuja un `fillRect` plano, sin sprite (igual que hoy `withGlow` con 0).
- La cache vive dentro de cada instancia de motor y no es global. `destroy()` la suelta.

**2. Cache de fondo de FROGGER (`lib/games/frogger/render.ts`):**

```ts
// Un canvas W×H con drawBackground ya pintado para la paleta actual.
let backgroundCache: { palette: FroggerPalette; canvas: HTMLCanvasElement } | null;
```

- Se reconstruye cuando cambia la referencia de la paleta (`setSkin`).
- Cada frame hace un solo `drawImage(cache, 0, 0)`, en lugar de los `fillRect` del fondo.

**Formato de cada medición** (filas de las tablas en *Mediciones*):

| Escenario | Viewport | Variante | hilo principal (ms/s) | estilo (ms/s) | rAF p95 (ms) |
| --------- | -------- | -------- | --------------------- | ------------- | ------------ |

| Escenario (Android) | Variante | fps medio | p50 frame (ms) | p95 frame (ms) | % frames > 33 ms |
| ------------------- | -------- | --------- | -------------- | -------------- | ---------------- |

---

## Protocolo de medición

Hay dos bancos de medición. Los dos corren contra `npm run dev`, en el **mismo** modo antes y después, y ninguno toca el repo: el guion vive en `.playwright-mcp/perf/`, que está gitignoreado.

**Banco A — desktop, CPU (Playwright MCP + CDP):**

- La CPU se limita a 4x (`Emulation.setCPUThrottlingRate { rate: 4 }`).
- Después de cargar la página y esperar 1,5 s, se toman dos lecturas de `Performance.getMetrics` separadas por **5 s**. Se reporta la diferencia de `TaskDuration` y de `RecalcStyleDuration`, normalizada a **ms por segundo**.
- Un `addInitScript` envuelve `requestAnimationFrame` y mide cuánto dura cada callback (update + draw del motor). Se reporta el p95.
- Escenarios:
  - `/games/<slug>/play` para los 6 slugs (`rocas`, `tetris`, `arkanoid`, `snake`, `croac`, `frogger`), con skin `classic`. FROGGER también con `neon`.
  - `/` y `/games` sin scroll: el scroll del usuario no suma trabajo de hilo principal propio; el fondo sí.
- Viewports: 1280×800 y 390×844.
- Si aparece el modal "FIN DEL JUEGO" dentro de la ventana, la corrida se invalida y se repite con entradas sintéticas por `e.code`.

**Banco B — Android real (adb + `connectOverCDP`):**

- El celular se conecta por USB con depuración activada. `adb forward tcp:9222 localabstract:chrome_devtools_remote` y Playwright `chromium.connectOverCDP('http://localhost:9222')`, contra `http://<IP-LAN>:3000` (`allowedDevOrigins`).
- Sin throttling: el celular es el dispositivo real.
- Un loop de rAF registra los deltas durante **10 s** y descarta el primer segundo. Se reportan fps medio, p50, p95 y % de deltas > 33 ms. El p50 da el intervalo de refresco real del celular.
- Escenarios: FROGGER (`classic` y `neon`), Tetris (control, sin glow) y `/games` con scroll continuo.

**Variantes de aislamiento** (solo en el baseline): se inyecta CSS o JS.

- `sin-fondo`: `.av-bg, .av-noise { display: none }`.
- `sin-backdrop`: `.av-nav { backdrop-filter: none }`.
- `sin-crt-blend`: `.crt-screen::after { mix-blend-mode: normal }`.
- `sin-glow`: se sobrescribe el setter de `CanvasRenderingContext2D.prototype.shadowBlur` para forzar 0, vía `addInitScript`.

El banco A corre las 4 variantes. El banco B corre `sin-fondo` y `sin-glow`.

---

## Decisiones

- **D1 — Primero medir, después arreglar.** Cada paso de arreglo cita la fila de *Mediciones* que lo justifica. Un paso **aplica** si la variante de aislamiento de su sospechoso mejora en ≥ 10% alguna de estas métricas, en algún escenario:
  - el hilo principal (banco A);
  - el p95 del frame o el % de frames > 33 ms (banco B).

  Si no, se marca **"no necesario"** con el número y no se implementa. *No* se descarta: arreglar a ciegas, porque toca efectos visuales sin evidencia. Los pasos 6–8 (motor y glow) se deciden con el banco B, porque el costo de `shadowBlur` va a la GPU y el banco A no lo ve.
- **D2 — Grilla del fondo animada con `transform`.** Se agrega un hijo `<div className="av-bg-grid" />` dentro de `.av-bg` en `app/layout.tsx`:
  - `.av-bg-grid` lleva la perspectiva, la `mask-image` y la opacidad, todo **estático**.
  - Su `::before` lleva la grilla, 60px más alta, y anima `transform: translateY(0 → 60px)`. Eso lo resuelve el compositor y da el mismo resultado visual que el `background-position` actual.
  - *No* se mueve la máscara junto con la grilla: eso haría "respirar" el fundido cada 8 s.
  - *No* se usa `will-change` en todo: solo en la capa animada.
- **D3 — `.crt-screen::after` pasa de `multiply` a blending normal.** Multiplicar por `rgba(0,0,0,a)` da exactamente lo mismo que pintar negro con alpha `a` en modo normal: el resultado es idéntico píxel a píxel y desaparece el blend sobre el canvas vivo. Este paso es el único que se aplica aunque la medición no lo exija, porque es gratis y sin riesgo visual.
- **D4 — `backdrop-filter` del nav.** Si la medición lo justifica, se quita sin cambiar el gradiente (alpha 0,78–0,92). Lo que se ve a través es poco, y la diferencia se verifica con captura lado a lado. *No* se sube la opacidad del gradiente para compensar: cambiaría el look.
- **D5 — Scanlines globales (`overlay`) y ruido (`feTurbulence`).** Solo se tocan si su variante de aislamiento muestra costo (D1). En ese caso:
  - `overlay` pasa a blending normal, con un alpha ajustado por captura.
  - El ruido pasa a un PNG estático en `public/textures/noise.png`.
- **D6 — Glow precalculado (`glow-cache.ts`) solo para entidades de tamaño fijo.**
  - En FROGGER: vehículos, novia y mosca.
  - La rana (su tamaño cambia con el salto), el timer (ancho variable) y la serpiente (un trazo) **mantienen `shadowBlur`**. Son 3 llamadas por frame contra ≈20 de los vehículos.
  - *No* se cachean sprites para cada ancho del timer, porque se agrandaría sin límite.
  - *No* se dibuja el glow con `filter: blur()` de canvas, porque es igual de caro.
- **D7 — Medición con Playwright + CDP, sin overlay de FPS.** Es repetible por el agente y no deja código para mantener.
  - El banco A mide CPU en desktop. El banco B mide frames en el Android real por `connectOverCDP`.
  - *No* se usa el delta de rAF en desktop: está saturado en el vsync (ver la enmienda).
  - La prueba jugando en el celular sigue siendo el árbitro final.
- **D8 — `classic` tiene que verse igual.** Los cambios D2, D3 y la cache de fondo son pixel-equivalentes. El glow cacheado puede diferir en sub-píxeles (el sprite se dibuja en coordenadas no enteras con interpolación). Se acepta si la comparación de capturas lado a lado no muestra diferencias perceptibles.
- **D9 — `prefers-reduced-motion: reduce`.** Desactiva la animación de la grilla (queda estática). No afecta a los juegos.
- **D10 — La grilla se pausa en el player** (agregada durante el paso 3, por decisión del usuario).
  - Con la grilla animada por `transform`, las páginas quietas ya cuestan casi lo mismo que sin fondo.
  - En el player no: el canvas fuerza un frame del hilo principal en cada rAF, y en cada uno Blink tickea las animaciones CSS vivas. Medido a 1280 con CPU 4x: FROGGER 66 ms/s con animación, 48 sin animación, 49 sin fondo. El recálculo de estilos pasa de 11 a 0.
  - Por eso `body:has(.av-player) .av-bg-grid::before` lleva `animation-play-state: paused`: la grilla se ve, pero quieta, y casi toda queda detrás del CRT.
  - *No* se aceptó el residuo enmendando el criterio.

---

## Plan de implementación

1. **Baseline.** Correr el *Protocolo de medición* completo, con las variantes de aislamiento. Completar la sección *Mediciones → Baseline* de esta spec y, para cada paso 3–8, anotar "aplica" o "no necesario" según D1. No se toca código. Commit: `docs: add baseline measurements (spec 18)`.
2. **Scanlines del CRT (D3).** En `app/globals.css`, `.crt-screen::after` pierde `mix-blend-mode: multiply`. Se verifica con una captura del player (idéntica).
3. **Grilla del fondo (D2, D9).** Agregar `.av-bg-grid` en `app/layout.tsx`, mover la grilla a `.av-bg-grid::before` con animación por `transform`, y borrar el `.av-bg::before` viejo. Agregar el bloque `@media (prefers-reduced-motion: reduce)`. Se verifica con captura de `/` y `/games` a 1280 y 390.
4. **Nav (D4)**, si aplica. Quitar `backdrop-filter` de `.av-nav` y hacer la captura lado a lado.
5. **Scanlines globales y ruido (D5)**, si aplica.
6. **Cache de fondo de FROGGER.** En `lib/games/frogger/render.ts`, `drawFrame` usa la cache de fondo. `setSkin` la invalida, porque cambia la referencia de la paleta. Se verifica con capturas de las 3 skins (idénticas).
7. **`lib/games/glow-cache.ts` + FROGGER (D6).** Crear el módulo. En FROGGER, `drawVehicle`, `drawLadyAt` y `drawFly` usan `glow.rect`. El motor crea la cache, la limpia en `setSkin` y la suelta en `destroy`. Se verifica con capturas `classic` y `neon` lado a lado.
8. **CROAC y Snake con `glow-cache`**, solo si su fila del baseline supera el umbral **y** la variante `sin-glow` lo baja (D1). Un commit por juego.
9. **Medición final.** Mismo protocolo, sin variantes de aislamiento. Completar *Mediciones → Después*. Documentar `glow-cache.ts` en la sección *Game engines* de `CLAUDE.md` (una línea).

---

## Mediciones

### Baseline

Medido el 2026-10-09 contra `npm run dev`, con Playwright MCP en Chromium **con interfaz** (no headless) y la GPU del Mac. Guion en `.playwright-mcp/perf/` (gitignoreado).

**Primer intento (métrica original, descartada por la enmienda):** a 1280×800 con CPU 4x, los 9 escenarios dieron 54–60 fps con un p95 del delta de rAF de **17,6 ms** en todos. Es el piso del vsync: esa métrica no discrimina nada.

#### Banco A — fondo (corridas `base` y `sin-fondo`, CPU 4x)

Columnas: hilo principal (ms/s) · recálculo de estilos (ms/s) · p95 del callback de rAF (ms).

| Escenario | Viewport | `base` | `sin-fondo` | Δ hilo principal |
| --------- | -------- | ------ | ----------- | ---------------- |
| `/games/rocas/play` | 1280×800 | 68 · 8 · 0,70 | 34 · 0 · 0,70 | −50 % |
| `/games/tetris/play` | 1280×800 | 61 · 6 · 0,60 | 29 · 0 · 0,30 | −52 % |
| `/games/arkanoid/play` | 1280×800 | 87 · 5 · 0,40 | 53 · 0 · 0,50 | −39 % |
| `/games/croac/play` | 1280×800 | 74 · 6 · 0,80 | 52 · 0 · 1,10 | −30 % |
| `/games/frogger/play` | 1280×800 | 74 · 6 · 0,80 | 49 · 0 · 1,10 | −34 % |
| `/games/frogger/play` (`neon`) | 1280×800 | 83 · 10 · 0,90 | 49 · 0 · 0,90 | −41 % |
| `/` | 1280×800 | 101 · 43 · — | 13 · 5 · — | −87 % |
| `/games` | 1280×800 | 46 · 8 · — | 2 · 0 · — | −96 % |
| `/games/rocas/play` | 390×844 | 49 · 5 · 0,40 | 32 · 0 · 0,60 | −35 % |
| `/games/tetris/play` | 390×844 | 58 · 6 · 0,50 | 36 · 0 · 0,40 | −38 % |
| `/games/arkanoid/play` | 390×844 | 80 · 7 · 0,50 | 48 · 0 · 0,50 | −40 % |
| `/games/croac/play` | 390×844 | 78 · 7 · 0,90 | 44 · 0 · 0,60 | −44 % |
| `/games/frogger/play` | 390×844 | 74 · 8 · 0,90 | 41 · 0 · 0,70 | −45 % |
| `/games/frogger/play` (`neon`) | 390×844 | 74 · 8 · 0,90 | 45 · 0 · 0,80 | −39 % |
| `/` | 390×844 | 108 · 48 · — | 15 · 6 · — | −86 % |
| `/games` | 390×844 | 33 · 5 · — | 1 · 0 · — | −97 % |

`/games/snake/play` terminó en game over en todas las corridas, incluso con teclas sintéticas cada 180 ms. Cuando el modal aparece, el loop se detiene, así que **sus filas no son válidas** y no se listan. Snake se evalúa en el banco B.

#### Banco A — nav (`sin-backdrop`, CPU 4x)

Hilo principal en ms/s, `base` → `sin-backdrop`:

| Escenario | 1280×800 | 390×844 |
| --------- | -------- | ------- |
| `/games/rocas/play` | 68 → 62 (−9 %) | 49 → 52 (+6 %) |
| `/games/tetris/play` | 61 → 56 (−8 %) | 58 → 62 (+7 %) |
| `/games/frogger/play` | 74 → 76 (+3 %) | 74 → 69 (−7 %) |
| `/` | 101 → 112 (+11 %) | 108 → 102 (−6 %) |
| `/games` | 46 → 41 (−11 %) | 33 → 37 (+12 %) |

Las variaciones van en las dos direcciones, dentro del ruido. **Sin señal.**

#### Banco A — CRT y glow (corridas pareadas, CPU 4x)

La primera corrida de `sin-crt-blend` quedó **contaminada**: `/` y `/games`, que no tienen `.crt-screen`, bajaron de 46 a 14 ms/s, así que cambió el entorno a mitad del batch. Se repitió con corridas pareadas (`base` → `sin-crt-blend` → `sin-glow`, una al lado de la otra y por escenario). Hilo principal en ms/s:

| Escenario | Viewport | `base` | `sin-crt-blend` | `sin-glow` |
| --------- | -------- | ------ | --------------- | ---------- |
| `/games/rocas/play` | 1280×800 | 72 | 88 | 74 |
| `/games/tetris/play` | 1280×800 | 70 | 75 | 64 |
| `/games/arkanoid/play` | 1280×800 | 95 | 88 | 95 |
| `/games/croac/play` | 1280×800 | 84 | 80 | 83 |
| `/games/frogger/play` | 1280×800 | 87 | 83 | 78 |
| `/games/frogger/play` (`neon`) | 1280×800 | 90 | 82 | 75 |
| `/games/rocas/play` | 390×844 | 73 | 59 | 53 |
| `/games/tetris/play` | 390×844 | 60 | 68 | 60 |
| `/games/arkanoid/play` | 390×844 | 91 | 86 | 84 |
| `/games/croac/play` | 390×844 | 87 | 100 | 94 |
| `/games/frogger/play` | 390×844 | 119 | 159 | 99 |
| `/games/frogger/play` (`neon`) | 390×844 | 89 | 81 | 89 |

**El ruido del banco A ronda ±10–30 %.** Asteroids no usa `shadowBlur` y aun así bajó 27 % con `sin-glow`. Ni el blend del CRT ni el glow se separan del ruido en CPU. Era lo esperable: su costo va a la GPU. El trabajo del motor por frame es chico en los 6 juegos (rAF p95 ≤ 1,5 ms con CPU 4x).

#### Banco B — Android real

_Pendiente: no había ningún dispositivo conectado por `adb` al cerrar el banco A._

#### Decisión por paso (D1)

| Paso | Decisión | Evidencia |
| ---- | -------- | --------- |
| 2 — CRT (D3) | **aplica** (siempre, por D3) | Pixel-equivalente. En CPU, sin señal. |
| 3 — grilla del fondo | **aplica** | `sin-fondo`: de −30 % a −52 % en el player y de −86 % a −97 % en `/` y `/games`. El recálculo de estilos cae a 0. |
| 4 — nav | **no necesario** | `sin-backdrop` está dentro del ruido (de −11 % a +12 %). |
| 5 — scanlines globales y ruido | **no necesario** | Medido después del paso 3, con corridas pareadas a 1280: FROGGER `base` 66 / `sin-scan` 69 / `sin-noise` 70 ms/s; Tetris 54 / 59 / 62. Ninguno baja: todo el residuo era la animación de la grilla (`sin-anim`: 48 y 35), que resolvió D10. |
| 6–7 — fondo de FROGGER y glow de FROGGER | **aplica por decisión del usuario (excepción a D1)** | El banco A no ve la GPU, y el Android no estaba conectado para el banco B. El 2026-10-09 el usuario pidió aplicar los pasos 6 y 7 igual. |
| 8 — glow de CROAC y Snake | **pendiente del banco B** | Sin evidencia ni pedido explícito, sigue sujeto a D1. |

### Después

#### Pasos 2, 3 y D10 (banco A, corridas pareadas `base` / `sin-fondo`, CPU 4x)

Hilo principal en ms/s. El recálculo de estilos queda en **0** en todos los escenarios.

| Escenario | Viewport | después | `sin-fondo` | límite del criterio | ¿Cumple? |
| --------- | -------- | ------- | ----------- | ------------------- | -------- |
| `/games/frogger/play` | 1280×800 | 50 | 47 | 57 | sí |
| `/games/tetris/play` | 1280×800 | 40 | 37 | 47 | sí |
| `/games/croac/play` | 1280×800 | 58 | 59 | 69 | sí |
| `/` | 1280×800 | 15 | 11 | 21 | sí |
| `/games` | 1280×800 | 7 | 3 | 13 | sí |
| `/games/frogger/play` | 390×844 | 46 | 38 | 48 | sí |
| `/games/tetris/play` | 390×844 | 38 | 33 | 43 | sí |
| `/games/croac/play` | 390×844 | 76 | 64 | 74 | se repite en el paso 9 (+2, dentro del ruido) |
| `/` | 390×844 | 14 | 12 | 22 | sí |
| `/games` | 390×844 | 3 | 2 | 12 | sí |

`/` y `/games` se midieron después del paso 3 y antes de D10. D10 solo afecta al player.

**Verificaciones:**

- **Reduced motion:** con `reducedMotion: 'reduce'` emulado, `.av-bg-grid::before` queda con `animation: none` y su `transform` no cambia en 700 ms. Sin reduced motion, se mueve.
- **D10:** en `/games/frogger/play`, la grilla queda con `animation-play-state: paused`.
- **`background-position`:** ninguna regla `@keyframes` lo anima. `.game-arena .grid-floor` (solo para juegos sin motor) también pasó a `transform` con `floorscroll`. Su loop ahora avanza 40px, una baldosa completa: antes avanzaba 60px sobre baldosas de 40px y saltaba al reiniciar.
- **Capturas** (`.playwright-mcp/perf/shots/`, `before-*` contra `after3-*`, con las animaciones CSS congeladas): `/` y `/games` a 1280 y 390 tienen diferencia máxima ≤ 6/255, sin píxeles por encima de 8, así que son idénticas. En el player, las diferencias aparecen solo en las entidades del juego (posición de autos, troncos, piezas y timer, por el tiempo de carga). El marco del CRT, las scanlines (D3) y el fondo coinciden.

#### Pasos 6 y 7 (aplicados por decisión del usuario, sin banco B)

**Método:** captura determinista del canvas, con `Math.random` sembrado, timestamps de rAF fijos a 1/60 s y la ejecución detenida en el frame 1 y en el 90. Dos corridas del mismo código dan diferencia 0, así que la captura es reproducible. Se compara `before67` (antes del paso 6) con cada paso.

| Skin · frame | Paso 6 (fondo cacheado) | Paso 7 (+ glow cacheado) |
| ------------ | ----------------------- | ------------------------ |
| `classic` · f1 | máx 11/255, 0 px > 8 | máx 12, 0 px > 8 |
| `classic` · f90 | máx 29, 1 px > 8 | máx 12, 0 px > 8 |
| `neon` · f1 | máx 12, 0 px > 8 | máx 12, 0 px > 8 |
| `neon` · f90 | máx 35, 4 px > 8 | máx 14, 2 px > 8 |
| `retro` · f1 | máx 15, 0 px > 8 | máx 15, 0 px > 8 |
| `retro` · f90 | máx 38, 1 px > 8 | máx 38, 1 px > 8 |

Sobre 480.000 píxeles, a lo sumo 4 difieren en más de 8/255: es antialiasing de la GPU en los bordes de las entidades. **No es pixel-idéntico**, pero no tiene diferencias perceptibles (D8).

**Cambio de skin en vivo:** a mitad de partida (puntaje 10) se pasó de `classic` a `neon`. El puntaje siguió en 10, y los píxeles del fondo (calle y pista del timer) tomaron la paleta nueva en el siguiente frame. 0 errores.

**Desviación de D6:** la mosca **mantiene `shadowBlur`**, porque su cuerpo es un círculo (`arc` de radio 4) y `GlowCache.rect` la habría dibujado cuadrada, un cambio visible que viola D8. Es como mucho 1 llamada por frame, y solo mientras hay mosca. Vehículos y novia sí usan `glow.rect`.

#### Paso 9 — banco A final (corridas pareadas `base` / `sin-fondo`, CPU 4x)

Hilo principal en ms/s, con el código final (pasos 2, 3, D10, 6 y 7). El recálculo de estilos queda en 0 en todo el player. En `/` queda en 4–8 ms/s, igual con o sin fondo: es la propia página.

| Escenario | 1280×800 (después / `sin-fondo`) | 390×844 (después / `sin-fondo`) | ¿Cumple? |
| --------- | -------------------------------- | ------------------------------- | -------- |
| `/games/rocas/play` | 33 / 31 | 14 / 17 | sí |
| `/games/tetris/play` | 18 / 29 | 16 / 16 | sí |
| `/games/arkanoid/play` | 35 / 33 | 41 / 33 | sí |
| `/games/croac/play` | 26 / 30 | 27 / 25 | sí |
| `/games/frogger/play` | 26 / 25 | 40 / 26 → repetida 3 veces: 24/22, 30/20, 24/24 | sí (el 40 fue ruido) |
| `/games/frogger/play` (`neon`) | 22 / 22 | 26 / 25 | sí |
| `/` | 9 / 7 | 17 / 14 | sí |
| `/games` | 3 / 2 | 5 / 2 | sí |

**Notas:**

- Los valores absolutos de esta sesión son más bajos que los del baseline, incluso en `sin-fondo` (FROGGER a 1280: 47 → 25). El entorno cambió (carga de la máquina), así que **solo valen las comparaciones pareadas**. Por eso el criterio se evalúa contra el `sin-fondo` de la misma corrida, no contra el del baseline.
- Snake sigue terminando en game over con teclas sintéticas, así que su fila no es válida. Queda para el banco B o la prueba manual.
- `npm run lint`: 0 errores. Las advertencias vienen de `resources/` y de los guiones de `.playwright-mcp/perf/` (gitignoreado); ninguna de `app/` ni de `lib/`. `tsc --noEmit` pasa sin errores.

#### Pendiente

- **Banco B** (Android real): sin dispositivo conectado. Quedan abiertos el criterio del banco B y el paso 8 (glow de CROAC y Snake, sujeto a D1).
- **Verificación manual del usuario:** revisar las capturas (`.playwright-mcp/perf/shots/`) y jugar 60 s de FROGGER en el Android.

---

## Criterios de aceptación

- [ ] La sección *Mediciones → Baseline* tiene el banco A (una fila por escenario × viewport, más las 4 variantes) y el banco B (escenarios más `sin-fondo` y `sin-glow`).
- [ ] Cada paso 3–8 dice "aplica" o "no necesario", con la fila del baseline que lo justifica.
- [ ] **Banco A** (CPU 4x, 1280×800 y 390×844): en cada escenario, el hilo principal después del arreglo es ≤ **máx(1,1 × `sin-fondo` del baseline, `sin-fondo` + 10 ms/s)**. Es decir: el fondo arreglado cuesta casi lo mismo que no tener fondo.
- [ ] **Banco B** (Android): en FROGGER `classic`, FROGGER `neon`, Tetris y `/games` con scroll, el p95 del frame es ≤ **1,1 × p50** (sin tirones por encima del refresco del celular) y hay **< 1% de frames > 33 ms**. Excepción: si Tetris no cumple por causas propias de su motor, queda registrado como fuera de alcance, con el número.
- [ ] `.crt-screen::after` no tiene `mix-blend-mode`.
- [ ] Ninguna regla de `app/globals.css` anima `background-position`.
- [ ] Con `prefers-reduced-motion: reduce` emulado, la grilla del fondo no se mueve.
- [ ] `lib/games/frogger/render.ts` no llama a `drawBackground` en cada frame: lo hace solo al reconstruir la cache.
- [ ] Al cambiar de skin en FROGGER en plena partida, el fondo y los glows pasan a la paleta nueva en el siguiente frame, sin reiniciar la partida.
- [ ] Las capturas lado a lado (antes / después) de `/`, `/games` y el player de FROGGER (`classic`, `neon`, `retro`) fueron revisadas y aprobadas por el usuario.
- [ ] El usuario jugó FROGGER 60 s en su Android / Chrome sin tirones visibles, y navegó `/` → `/games` con scroll fluido.
- [ ] `npm run lint` termina sin errores.
- [ ] Gameplay sin cambios: mismas reglas, puntajes, velocidades y controles (teclado y táctil) en los 6 juegos.

---

## Riesgos identificados

| Riesgo | Mitigación |
| ------ | ---------- |
| El modo dev (React dev, HMR) infla los números y no representa producción. | El antes y el después se miden en el mismo modo. El umbral es relativo a ese entorno. Si dev queda cerca del límite, se anota sin cambiar el umbral. |
| El throttling 4x de CDP solo limita la CPU, no la GPU, y `shadowBlur` y los blends pesan en la GPU móvil. | Banco B en el Android real. Los pasos de glow se deciden con él (D1). |
| El Android no se puede conectar por USB (cable, depuración, autorización). | Los pasos 6–8 se deciden con la prueba manual: se aplican si FROGGER sigue con tirones después de los arreglos del fondo. Se anota en *Mediciones*. |
| El banco B mide el Chrome del celular con DevTools conectado, lo que agrega algo de overhead. | Antes y después se miden en las mismas condiciones. |
| El glow cacheado se ve distinto en sub-píxeles (D8). | Captura lado a lado aprobada por el usuario. Si no se aprueba, el sprite se dibuja en coordenadas redondeadas. |
| La cache de glow crece sin límite si aparece un tamaño nuevo en cada frame. | Solo entidades de tamaño fijo (D6). Las de tamaño variable siguen con `shadowBlur`. |
| Snake u otro juego termina antes de los 10 s y la muestra queda vacía. | Entradas sintéticas por `e.code` y corrida invalidada si aparece el modal (*Protocolo*). |
| El celular necesita llegar al dev server por la LAN. | `allowedDevOrigins` en `next.config.ts` ya existe localmente y **no se commitea**. |

---

## Lo que **no** está en esta spec

- Arreglos de motor en Tetris, Arkanoid o Asteroids.
- Overlay de FPS en el player.
- Performance de carga (bundle, LCP, fetching).
- Cambios de resolución, DPR o workers para el canvas.
- Rediseño o eliminación visible de efectos (grilla, scanlines, glow, ruido).
- Verificación en iPhone / Safari.

Cada uno de esos, si llega, va en su propia spec.
