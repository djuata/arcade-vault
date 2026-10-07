# SPEC 11 — Skins de SNAKE (classic, neón, retro)

> **Status:** Approved
> **Depends on:** SPEC 09 (snake-game)
> **Date:** 2026-10-07
> **Objective:** Que SNAKE se pueda jugar con tres paletas de canvas (`classic` por defecto, `neon` y `retro`) elegibles desde el player, y dejar armada la plataforma de skins (tipos, contrato del motor, registro y selector) que van a reutilizar los demás juegos.

---

## Por qué existe esta spec

Una skin es **solo la paleta del canvas**: fondo, entidades y detalles que dibuja el motor. No cambia el HUD, la clase `.cover-*`, la jugabilidad ni los assets. Hay tres puntos que no son obvios:

- **Es el primer juego con skins, así que no existe la plataforma.** No hay `lib/games/skins.ts`, ni `GameEngineOptions`, ni `setSkin?` en `GameEngine`, ni `GAME_SKINS` en el registry, ni selector en el player. Esta spec los define y los implementa **primero**, de forma retrocompatible: ROCAS, TETRIS y ARKANOID siguen compilando y funcionando igual, y el player no les muestra el selector.
- **Las frutas son sprites, no formas.** El cuerpo de la serpiente se dibuja con canvas (`roundRect`), pero las frutas salen de `public/games/snake/fruits.png` con `drawImage`. Cambiar un `fillStyle` no alcanza para ellas: cada skin define un **tinte del spritesheet**, que se aplica una sola vez en un canvas offscreen y se cachea. No se tocan ni se agregan PNGs.
- **Hay colores sueltos fuera del render.** Además de las 4 constantes de `render.ts`, el color de los ojos está escrito en línea (`render.ts:37`) y los 22 colores de respaldo de las frutas viven en `sprites.ts` (`FALLBACK_COLORS`). Todos pasan a `lib/games/snake/skins.ts`, para que `classic` sea un refactor puro y las otras skins cubran también el caso "el PNG no cargó".

---

## Alcance

**Dentro:**

- Plataforma de skins:
  - `lib/games/skins.ts` (nuevo): `REQUIRED_SKINS`, `SkinId`, `DEFAULT_SKIN`, `GameSkins<Palette>`, `resolveSkin`, `SKIN_LABELS`, `skinLabel` y los helpers de preferencia (`skinStorageKey`, `readStoredSkin`, `storeSkin`).
  - `lib/games/types.ts`: se agregan `GameEngineOptions`, `setSkin?` en `GameEngine` y el tercer parámetro opcional de `GameEngineFactory`. Nada más cambia.
  - `lib/games/registry.ts`: se agrega `GAME_SKINS`.
  - `components/player/SkinSelector.tsx` (nuevo), `components/player/GameCanvas.tsx` y `components/player/GamePlayer.tsx`.
  - `app/globals.css`: solo reglas nuevas con prefijo `.av-skin-*`.
- SNAKE:
  - `lib/games/snake/skins.ts` (nuevo): `SnakePalette` y `SNAKE_SKINS` con `classic`, `neon` y `retro`.
  - `lib/games/snake/tint.ts` (nuevo): tinte del spritesheet en canvas offscreen.
  - `lib/games/snake/render.ts`, `engine.ts` y `sprites.ts`: la paleta reemplaza los literales de color.
- `GAMES.md`: línea `- **Skins:** …` en la sección SNAKE.

**Fuera de alcance:**

- Skins de ROCAS, TETRIS y ARKANOID (cada una va en su propia spec y reutiliza esta plataforma).
- Cambiar el HUD, el marco CRT, el modal, la clase `.cover-snake-fruit` o la página de detalle según la skin.
- Skins extra además de las tres requeridas.
- Nuevos PNGs, spritesheets recoloreados a mano o sprites de serpiente.
- Guardar la skin en Supabase o asociarla al usuario o al puntaje: es una preferencia del navegador.
- Selector de skins fuera del player (galería, detalle, ajustes globales).
- Cambios de velocidad, tamaño de celda, hitboxes, puntaje, niveles o controles.
- Promover `tint.ts` a un módulo compartido (se hará cuando un segundo juego con sprites tenga skins).
- Migraciones, cambios de esquema, `public/`, `resources/`.
- Tests automatizados: el proyecto no tiene test runner.

---

## Auditoría (estado antes de esta spec)

| Chequeo | Estado | Evidencia |
| ------- | ------ | --------- |
| Contrato compartido | ❌ | `lib/games/skins.ts` no existe; `lib/games/types.ts:11-21` no tiene `GameEngineOptions`, `setSkin?` ni tercer parámetro; `lib/games/registry.ts:8-13` solo exporta `GAME_ENGINES`. |
| Selector | ❌ | `components/player/SkinSelector.tsx` no existe; `GameCanvas.tsx:26` crea el motor solo con `(canvas, callbacks)`; `GamePlayer.tsx:122-132` no tiene estado de skin. |
| Skins del juego | ❌ | `lib/games/snake/skins.ts` no existe; `snake` no está en ningún `GAME_SKINS`. |
| El motor las usa | ❌ | `engine.ts:24` la factory recibe solo `(canvas, callbacks)`; no hay `resolveSkin` ni `setSkin`. |
| Sin colores sueltos | ❌ | `render.ts:12-15` (`BOARD_DARK`, `BOARD_LIGHT`, `BODY_COLOR`, `HEAD_COLOR`), `render.ts:37` (ojos `#0a0a18` en línea), `sprites.ts:41-64` (`FALLBACK_COLORS`, 22 hex). |
| Sprites | ❌ | `render.ts:73-83` dibuja la fruta con `drawImage` directo desde el PNG; no hay tinte. |
| Legibilidad | — | Solo existe `classic`; se especifica abajo para `neon` y `retro`. |
| `GAMES.md` | ❌ | La sección SNAKE (`GAMES.md:86-102`) no lista skins. |

---

## Decisiones

**Tomadas:**

- **Cambio de skin en vivo, sin reiniciar.** El motor expone `setSkin?(skin)`, que solo reemplaza la paleta (y la hoja activa) en su estado. No toca serpiente, fruta, puntaje, nivel, cola de giros ni acumulador del tick. *Descartada:* reiniciar la partida al cambiar de skin (más simple de implementar, pero castiga a quien quiere probar una paleta a mitad de partida) y recrear el motor con otras `options` (pierde el estado igual).
- **`setSkin` redibuja un cuadro si el loop está detenido.** En pausa o `gameover` el loop de `requestAnimationFrame` está cortado, así que sin esto el canvas mostraría la skin vieja hasta reanudar. Llama una vez a `drawFrame` sin llamar a `update`. *Descartada:* esperar al próximo cuadro (en pausa la persona no ve el cambio).
- **La skin inicial va en `options` al crear el motor y los cambios por `setSkin` en un efecto aparte.** En `GameCanvas`, la skin **no** entra en las dependencias del efecto que crea el motor (eso reiniciaría la partida). El valor actual se guarda en un `ref` que actualiza el efecto de skin; ese efecto se declara **antes** que el de creación, para que en el montaje (y en el remontaje de Strict Mode) el motor nazca con la skin vigente. *Descartada:* pasar `skin` en las dependencias del efecto de creación (reinicia) y escribir el `ref` durante el render (lo marca la regla de refs de React 19).
- **La paleta se resuelve una vez y se pasa al render por parámetro.** `resolveSkin(SNAKE_SKINS, options?.skin)` al crear y en `setSkin`; `drawFrame(ctx, frame, palette)`. Sin lookups por cuadro. *Descartada:* que `render.ts` importe `SNAKE_SKINS` y busque por id en cada cuadro.
- **Ids desconocidos caen a `classic`.** Tanto `resolveSkin` (motor) como `readStoredSkin` (player) validan el id contra las skins disponibles. Una key vieja o manipulada en `localStorage` nunca rompe el juego.
- **Persistencia por juego en `localStorage` (`av_skin_<slug>`), envuelta en `try/catch`.** Es una preferencia visual del navegador, no un dato sensible, y por juego porque cada uno tendrá paletas propias. La lectura usa `useSyncExternalStore` con snapshot de servidor `null` (mismo patrón que `lib/session-context.tsx`), así no hay mismatch de hidratación. *Descartadas:* Supabase o la sesión mock (exceso para una preferencia local) y una key global para todos los juegos (las skins no son las mismas en cada uno).
- **Tinte de sprites en canvas offscreen con `source-atop`, cacheado por skin.** Cuando el PNG carga (o cuando cambia la skin, lo que pase después), `tintSheet(image, tint)` crea un `<canvas>` del tamaño del PNG, dibuja la imagen, pone `globalCompositeOperation = "source-atop"` y `globalAlpha = tint.alpha`, y hace `fillRect` con `tint.color`. Solo se pintan los píxeles opacos, así que la transparencia de cada fruta se conserva. El resultado se guarda en un `Map<string, HTMLCanvasElement>` por id de skin dentro del motor: volver a una skin no re-tiñe algo ya teñido y alternar skins no acumula tintes. `classic` (`spriteTint: null`) dibuja directo desde el `HTMLImageElement`. *Descartadas:* `ctx.filter` (soporte desigual en Safari), teñir en cada cuadro (costo de composición sobre un PNG de 3790×442 a 60 fps) y PNGs recoloreados (fuera de alcance; cada juego tendría que versionar binarios por skin).
- **Se tiñe la hoja completa, no solo la fila pixel-art.** Mantiene las coordenadas de `FRUIT_SPRITES` sin cambios. Cuesta ≈ 6,7 MB de memoria por hoja teñida (3790×442×4 bytes), con un máximo de dos (`neon` y `retro`). *Descartada:* recortar la fila `y = 136..295` (ahorra memoria pero obliga a traducir coordenadas y suma una fuente de errores).
- **Se usa `document.createElement("canvas")` para el offscreen.** El motor solo corre en el navegador. *Descartada:* `OffscreenCanvas` (2D recién desde Safari 16.4).
- **Los colores de respaldo de las frutas pasan a la paleta (`fruitFallback`).** `classic` lleva exactamente los 22 de `FALLBACK_COLORS`; `neon` y `retro` usan un solo color (el del tinte), armado con un helper `uniformFruitColors(color)`, para que el respaldo se vea coherente con la skin. `sprites.ts` queda sin colores. *Descartada:* dejar `FALLBACK_COLORS` en `sprites.ts` (rompe "sin colores sueltos" y en `retro` mostraría 22 colores fuera de la paleta Game Boy).
- **`shadowBlur` solo en `neon`, solo en la cabeza y en la fruta.** El render aplica `headGlow`/`fruitGlow` cuando no son `null` y resetea `shadowBlur = 0` justo después. El cuerpo no brilla: puede tener cientos de segmentos y el glow encadenado ensucia la lectura y cuesta rendimiento.
- **`retro` = Game Boy DMG, con tablero plano.** De las 4 tonalidades del DMG, solo `#0f380f` y `#306230` contrastan ≥ 3:1 contra `#9bbc0f`, y ninguna de las dos lo logra contra `#8bac0f` salvo `#0f380f`. Un damero `#9bbc0f`/`#8bac0f` obligaría a pintar cabeza y cuerpo del mismo color. Se elige tablero plano (`boardDark = boardLight = #9bbc0f`, como el Snake de las portátiles de la época), cuerpo `#306230` y cabeza `#0f380f`. *Descartadas:* damero con cuerpo y cabeza iguales (se pierde la cabeza a simple vista) y fósforo ámbar o CGA (el verde DMG es la referencia más reconocible para Snake).
- **Las frutas de `retro` son siluetas planas (`alpha = 1`).** Con un tinte parcial aparecerían colores intermedios fuera de la paleta de 4. Las frutas siguen reconociéndose por la forma; todas valen lo mismo, así que distinguirlas entre sí no es una necesidad de juego.
- **`neon` tiñe las frutas con magenta al 35 %.** Las acerca a la paleta de marca y las separa del verde de la serpiente sin borrar el pixel-art. *Descartada:* sin tinte (frutas verdes como el brócoli o el kiwi se confunden con el cuerpo neón) y tinte al 100 % (se pierde el detalle).
- **Selector como `radiogroup` presentacional, ubicado en `hud-actions` antes de PAUSA.** Tres botones `role="radio"` con `aria-checked` y tabindex itinerante, `aria-label="Skin"`, touch targets ≥ 44 px. Se renderiza solo si `GAME_SKINS[slug]` tiene más de una skin, así los juegos sin skins no cambian. *Descartada:* un `<select>` nativo (menos coherente con la estética `.btn` y el foco del canvas).
- **El teclado del selector no maneja la serpiente.** El input del motor escucha `keydown` en `window`; React delega los eventos en la raíz de la app, que está por debajo de `window`, así que el selector llama a `stopPropagation()` en las teclas que maneja (flechas, `Home`, `End`, `Espacio`, `Enter`) y el motor no las ve. Sin esto, mover la selección con flechas también giraría la serpiente, y el `preventDefault` del motor sobre `Espacio` impediría activar el botón.
- **Devolución del foco al canvas.** Al elegir con clic o con `Enter`/`Espacio`, el foco vuelve al canvas (mismo patrón que `resume`/`restart`), para que las teclas del juego no queden atrapadas. Con flechas, la selección se mueve **y se aplica**, pero el foco se queda en el grupo hasta `Enter`, `Espacio`, `Escape` o un clic; si el foco volviera en cada flecha, no se podría recorrer el grupo con el teclado. Esto precisa el contrato general ("después de cambiar la skin, el foco vuelve al canvas") para el caso de navegación con flechas.
- **`GameCanvas` expone `focus` en su handle.** `GameCanvasHandle` suma `focus: () => void`, porque el selector vive fuera de `GameCanvas` y `GamePlayer` necesita devolver el foco después del cambio. Es un agregado, no cambia `pause`/`resume`/`restart`.
- **Tinte en `lib/games/snake/tint.ts`, no compartido todavía.** Solo un juego lo usa; promoverlo a `lib/games/` cuando ARKANOID tenga skins evita diseñar la API compartida con un solo caso.
- **Helpers de persistencia en `lib/games/skins.ts`, hook en `GamePlayer.tsx`.** Las funciones puras (`skinStorageKey`, `readStoredSkin`, `storeSkin`) quedan junto al resto del contrato y sin React; el `useSyncExternalStore` con su `subscribe` vive en `GamePlayer`, que es el dueño del estado.

**Descartadas (resumen):** reiniciar al cambiar de skin; skin en las dependencias del efecto de creación; `ctx.filter`; PNGs por skin; `OffscreenCanvas`; persistir en Supabase; key global de skin; damero en `retro`; glow en el cuerpo; `<select>` nativo; devolver el foco en cada flecha; `tint.ts` compartido desde ya.

---

## Paletas

Roles de `SnakePalette` (`lib/games/snake/skins.ts`):

```ts
import type { FruitKey } from "./sprites";

export interface SpriteTint { color: string; alpha: number }
export interface Glow { color: string; blur: number }

export interface SnakePalette {
  boardDark: string;   // base fill of the board
  boardLight: string;  // checkerboard cells
  body: string;
  head: string;
  eyes: string;
  fruitFallback: Readonly<Record<FruitKey, string>>; // used while/if fruits.png fails
  spriteTint: SpriteTint | null; // null = draw the PNG as is
  headGlow: Glow | null;
  fruitGlow: Glow | null;
}
```

| Rol | `classic` (hoy) | `neon` | `retro` (Game Boy DMG) |
| --- | --------------- | ------ | ---------------------- |
| `boardDark` | `#0a0a18` (`render.ts:12`) | `#05050f` — casi negro, más oscuro que classic para que el glow resalte | `#9bbc0f` — tono más claro del DMG, fondo de la pantalla |
| `boardLight` | `#10102a` (`render.ts:13`) | `#0d0d24` — damero apenas visible (≈ 1,1:1), solo como guía de grilla | `#9bbc0f` — igual a `boardDark`: tablero plano (ver Decisiones) |
| `body` | `#2bff88` (`render.ts:14`) | `#39ff14` — verde neón, mantiene la identidad de serpiente; ≈ 14:1 | `#306230` — segundo tono más oscuro; 3,3:1 contra `#9bbc0f` |
| `head` | `#b6ffd0` (`render.ts:15`) | `#00f0ff` — cyan de marca, otro tono que el cuerpo; ≈ 13:1 | `#0f380f` — tono más oscuro; 6:1, la cabeza se lee primero |
| `eyes` | `#0a0a18` (`render.ts:37`) | `#05050f` — el fondo, ojos "recortados" en la cabeza | `#9bbc0f` — el fondo, ojos claros sobre la cabeza oscura |
| `fruitFallback` | los 22 de `FALLBACK_COLORS` (`sprites.ts:41-64`) | todos `#ff2bd6` — magenta, el color del tinte; ≈ 6:1 | todos `#0f380f` — misma silueta que el tinte; 6:1 |
| `spriteTint` | `null` | `{ color: "#ff2bd6", alpha: 0.35 }` — acerca las frutas a la marca y las separa del verde del cuerpo | `{ color: "#0f380f", alpha: 1 }` — siluetas planas, sin colores fuera de la paleta de 4 |
| `headGlow` | `null` | `{ color: "#00f0ff", blur: 12 }` | `null` |
| `fruitGlow` | `null` | `{ color: "#ff2bd6", blur: 16 }` | `null` |

Contraste (luminancia relativa WCAG, entidades jugables contra el fondo más claro del tablero):

- `classic`: sin cambios respecto de hoy.
- `neon`: cuerpo ≈ 14:1, cabeza ≈ 13:1, respaldo de fruta ≈ 6:1 contra `#0d0d24`. Las frutas teñidas mantienen sus tonos propios al 65 % más el glow magenta.
- `retro`: cuerpo 3,3:1, cabeza 6:1, fruta 6:1 contra `#9bbc0f`. Usa 3 de los 4 tonos del DMG (≤ 8 colores).
- Distinguir entre sí: en `neon` cabeza (cyan) ≠ cuerpo (verde) ≠ fruta (magenta); en `retro` cuerpo (`#306230`) ≠ cabeza/fruta (`#0f380f`), y cabeza y fruta se separan por forma (cuadrado redondeado con ojos vs. silueta de fruta) y porque la cabeza siempre está pegada al cuerpo.

Etiquetas visibles (`SKIN_LABELS` en `lib/games/skins.ts`): `classic` → `CLÁSICO`, `neon` → `NEÓN`, `retro` → `RETRO`. Un id extra sin label se muestra en mayúsculas.

---

## Contratos

`lib/games/skins.ts`:

```ts
export const REQUIRED_SKINS = ["classic", "neon", "retro"] as const;
export type SkinId = (typeof REQUIRED_SKINS)[number];
export const DEFAULT_SKIN: SkinId = "classic";
export type GameSkins<Palette> = Readonly<Record<SkinId, Palette>> & Readonly<Record<string, Palette>>;
export function resolveSkin<Palette>(skins: GameSkins<Palette>, id?: string): Palette;

export const SKIN_LABELS: Readonly<Record<SkinId, string>>;
export function skinLabel(id: string): string; // SKIN_LABELS or id.toUpperCase()

export function skinStorageKey(slug: string): string;                          // "av_skin_<slug>"
export function readStoredSkin(slug: string, available: readonly string[]): string; // try/catch, falls back to DEFAULT_SKIN
export function storeSkin(slug: string, id: string): void;                       // try/catch, no-op if storage is disabled
```

`lib/games/types.ts` (solo se agrega):

```ts
export interface GameEngineOptions {
  /** Skin id; unknown or missing ids fall back to the default skin. */
  skin?: string;
}

export interface GameEngine {
  // ...existing methods
  /** Optional: swaps the palette live, without restarting the run. */
  setSkin?: (skin: string) => void;
}

export type GameEngineFactory = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
  options?: GameEngineOptions,
) => GameEngine;
```

`lib/games/registry.ts`:

```ts
// Slug → available skin ids, `classic` first. Games without an entry have no skins.
export const GAME_SKINS: Readonly<Record<string, readonly string[] | undefined>> = {
  snake: Object.keys(SNAKE_SKINS),
};
```

`components/player/SkinSelector.tsx` (presentacional, sin estado propio):

```ts
interface SkinSelectorProps {
  skins: readonly string[];
  value: string;
  onChange: (skin: string) => void;
  /** Called when the choice is committed (click, Enter, Space, Escape): GamePlayer refocuses the canvas. */
  onCommit: () => void;
}
```

`lib/games/snake/tint.ts`:

```ts
export function tintSheet(image: HTMLImageElement, tint: SpriteTint): HTMLCanvasElement;
```

---

## Plan de implementación

Antes de escribir código, consultar en `node_modules/next/dist/docs/` lo necesario de React 19 / Next 16 (según `AGENTS.md`). Cada paso deja la app compilando y los cuatro juegos funcionando. Verificación estática por paso: `npm run lint` y `npx tsc --noEmit` (sin build).

1. **Tipos compartidos.** Crear `lib/games/skins.ts` con todo lo de "Contratos" (sin React, sin `next/*`). Prueba: lint y `tsc --noEmit`.
2. **Contrato del motor.** En `lib/games/types.ts` agregar `GameEngineOptions`, `setSkin?` y el tercer parámetro opcional de `GameEngineFactory`. No cambiar nada más. Prueba: `tsc --noEmit` pasa sin tocar ningún motor (una función de 2 parámetros sigue siendo asignable).
3. **Registro vacío.** En `lib/games/registry.ts` agregar `GAME_SKINS = {}` con su tipo. Prueba: lint y `tsc --noEmit`.
4. **Selector.** Crear `components/player/SkinSelector.tsx` (`"use client"`): `div role="radiogroup" aria-label="Skin"` con un `button role="radio"` por skin, `aria-checked`, tabindex itinerante (solo el seleccionado tiene `tabIndex=0`), etiquetas de `skinLabel`. Teclado: `←`/`↑` y `→`/`↓` mueven y aplican (con vuelta al principio/fin), `Home`/`End` van al primero/último, `Enter`/`Espacio`/`Escape` llaman a `onCommit`; todas esas teclas hacen `preventDefault()` y `stopPropagation()`. El clic llama a `onChange` y `onCommit`. Retorna `null` si `skins.length <= 1`. Agregar en `app/globals.css` las reglas `.av-skin-group`, `.av-skin-option` y `.av-skin-option[aria-checked="true"]`: mobile-first, alto mínimo `2.75rem` (44 px), fuente `var(--font-press-start)` o la de `.btn`, borde y color con los tokens existentes, foco visible con `:focus-visible`, `flex-wrap` para que no desborde en 375 px. Prueba: lint y `tsc --noEmit`.
5. **`GameCanvas`.** Agregar la prop `skin: string`. Declarar primero un efecto `[skin]` que guarda `skin` en `skinRef` y llama a `engineRef.current?.setSkin?.(skin)`; después el efecto existente, que ahora crea el motor con `createEngine(canvas, callbacks, { skin: skinRef.current })` y conserva sus dependencias `[createEngine, callbacks]`. Sumar `focus` a `GameCanvasHandle` (`canvasRef.current?.focus({ preventScroll: true })`). Prueba: lint y `tsc --noEmit`.
6. **`GamePlayer`.** Leer `const skins = GAME_SKINS[game.id]`. Con un `useSyncExternalStore` (subscribe a un `Set` de listeners locales + evento `storage`, snapshot `readStoredSkin(game.id, skins ?? [])`, snapshot de servidor `DEFAULT_SKIN`), obtener `skin`. `changeSkin(id)` llama a `storeSkin` y notifica. Pasar `skin` a `GameCanvas`. Renderizar `<SkinSelector>` dentro de `.hud-actions`, antes de PAUSA, solo si hay motor y `skins`; `onCommit` llama a `canvasRef.current?.focus()`. Prueba manual: en este punto ningún juego está en `GAME_SKINS`, así que `/games/rocas/play`, `/games/tetris/play`, `/games/arkanoid/play` y `/games/snake/play` se ven y se juegan exactamente igual que antes, sin selector.
7. **Extraer `classic` (refactor puro).** Crear `lib/games/snake/skins.ts` con `SpriteTint`, `Glow`, `SnakePalette`, `uniformFruitColors(color)` y `SNAKE_SKINS` con **solo** `classic` completo (valores de la tabla, `fruitFallback` = los 22 hex movidos tal cual desde `sprites.ts:41-64`), y `neon`/`retro` provisoriamente iguales a `classic` para que el tipo compile. Borrar `FALLBACK_COLORS` de `sprites.ts`. En `render.ts`, borrar las constantes de color y cambiar la firma a `drawFrame(ctx, frame, palette)`; `drawBoard`, `drawEyes`, `drawSnake` y `drawFruit` reciben la paleta. `BODY_INSET`, `FRUIT_MARGIN`, radio `8` y tamaño de ojos no cambian. En `engine.ts`, la factory acepta `options`, guarda `let palette = resolveSkin(SNAKE_SKINS, options?.skin)` y la pasa a `drawFrame`. Prueba: `rg '#[0-9a-fA-F]{3,8}|rgba?\(|hsl' lib/games/snake --glob '!skins.ts'` sin resultados; prueba manual: el juego se ve idéntico a antes (comparar captura).
8. **Tinte de sprites.** Crear `lib/games/snake/tint.ts` con `tintSheet` según Decisiones (resetear `globalCompositeOperation` y `globalAlpha` al terminar). En `engine.ts`: `let image` (el PNG cargado o `null`), `const tintCache = new Map<string, HTMLCanvasElement>()`, `let skinId` y `let activeSheet: HTMLImageElement | HTMLCanvasElement | null`. Una función `refreshSheet()` calcula `activeSheet` (sin imagen → `null`; `spriteTint === null` → la imagen; si no, el canvas cacheado para `skinId`, creándolo una sola vez) y se llama en `onload` y en `setSkin`. `Frame.sheet` pasa a `HTMLImageElement | HTMLCanvasElement | null`. `destroy()` además vacía `tintCache`. Prueba: lint y `tsc --noEmit`; con `classic`, sin cambios visuales.
9. **`setSkin` y glow.** En `engine.ts`, `setSkin(id)`: si `destroyed` no hace nada; resuelve con `resolveSkin` (un id inválido queda en `classic`), guarda `skinId` y `palette`, llama a `refreshSheet()` y, si `rafId === null` (pausa o `gameover`), dibuja un cuadro con `drawFrame` sin `update`. En `render.ts`, una función `withGlow(ctx, glow, draw)` aplica `shadowColor`/`shadowBlur` solo si `glow` no es `null` y resetea `shadowBlur = 0` después; se usa al dibujar la cabeza y la fruta. Prueba: lint y `tsc --noEmit`.
10. **`neon` y `retro`.** Completar `SNAKE_SKINS.neon` y `SNAKE_SKINS.retro` con los valores de la tabla (`fruitFallback` con `uniformFruitColors`). Prueba manual: las tres skins según los criterios de aceptación.
11. **Registro.** En `lib/games/registry.ts`, `GAME_SKINS = { snake: Object.keys(SNAKE_SKINS) }`. Prueba manual: aparece el selector solo en `/games/snake/play`.
12. **`GAMES.md`.** En la sección SNAKE, debajo de **Assets**, agregar `- **Skins:** classic (default), neon, retro`.
13. **Pase final.** Recorrer los criterios de aceptación en `npm run dev` (incluido Strict Mode y la navegación de ida y vuelta), revisar la consola y correr `npm run lint` y `npx tsc --noEmit`.

---

## Criterios de aceptación

**Plataforma y retrocompatibilidad**

- [ ] Con `classic`, SNAKE se ve idéntico a antes de esta spec (tablero, damero, serpiente, ojos, frutas y círculos de respaldo).
- [ ] `/games/rocas/play`, `/games/tetris/play` y `/games/arkanoid/play` no muestran selector y se juegan igual que antes.
- [ ] Los juegos sin motor (p. ej. `/games/serpentina/play`) no muestran selector.
- [ ] `git diff` no muestra cambios en `lib/games/asteroids/`, `lib/games/tetris/`, `lib/games/arkanoid/`, `supabase/`, `public/`, `resources/`, `lib/supabase/` ni `package.json`; en `lib/games/types.ts` solo hay agregados.
- [ ] `rg '#[0-9a-fA-F]{3,8}|rgba?\(|hsl' lib/games/snake --glob '!skins.ts'` no devuelve resultados.
- [ ] `lib/games/skins.ts` y `lib/games/snake/` no importan React ni `next/*`.

**Selector**

- [ ] En `/games/snake/play` aparece un grupo con `CLÁSICO`, `NEÓN` y `RETRO` en la barra de acciones, junto a PAUSA, con `CLÁSICO` marcado la primera vez.
- [ ] Un lector de pantalla lo anuncia como grupo de radio "Skin" con la opción marcada.
- [ ] Con el teclado: `Tab` entra al grupo en la opción marcada; las flechas mueven y aplican la skin **sin girar la serpiente**; `Enter`, `Espacio` o `Escape` devuelven el foco al canvas y las flechas vuelven a manejar la serpiente.
- [ ] Al elegir con un clic, el foco vuelve al canvas y las flechas manejan la serpiente de inmediato (sin un clic extra).
- [ ] En 375 px el selector no causa scroll horizontal y cada opción mide al menos 44×44 px.

**Cambio en vivo**

- [ ] Cambiar de skin en mitad de la partida no la reinicia: serpiente, fruta, puntaje, nivel y velocidad siguen igual, y el HUD no cambia.
- [ ] Cambiar de skin en pausa actualiza el canvas detrás del cartel "EN PAUSA"; al reanudar, la serpiente no da pasos extra.
- [ ] Alternar `classic → neon → retro → neon → classic` varias veces no acumula tinte: cada skin se ve siempre igual.
- [ ] "JUGAR DE NUEVO" conserva la skin elegida.

**Persistencia**

- [ ] La skin elegida persiste al recargar `/games/snake/play` (key `av_skin_snake` en `localStorage`).
- [ ] Con `av_skin_snake` = `"inexistente"` o borrada, el juego arranca en `classic` sin errores.
- [ ] Con `localStorage` bloqueado (modo privado estricto o `setItem` que lanza), el selector funciona durante la sesión y no hay errores no capturados.
- [ ] La consola no muestra errores de hidratación al cargar con una skin guardada distinta de `classic`.

**Paletas**

- [ ] `neon`: fondo casi negro, cuerpo verde neón, cabeza cyan con glow, frutas con tinte magenta y glow; el cuerpo no tiene glow.
- [ ] `retro`: fondo `#9bbc0f` plano, cuerpo `#306230`, cabeza `#0f380f` con ojos claros, frutas como siluetas `#0f380f`; sin glow y sin colores fuera de esos 3 tonos.
- [ ] En las tres skins, la fruta se distingue de la serpiente y la cabeza se distingue del cuerpo.
- [ ] Con el PNG bloqueado en las herramientas del navegador, cada skin dibuja los círculos de respaldo con sus colores (22 colores en `classic`, magenta en `neon`, `#0f380f` en `retro`) y el juego sigue jugable.

**Ciclo de vida**

- [ ] Bajo Strict Mode y al salir con SALIR y volver a entrar, el motor arranca con la skin guardada, cada tecla gira una sola vez y no quedan listeners activos fuera de `/games/snake/play`.
- [ ] La consola no muestra errores ni warnings de React durante una partida completa con cambios de skin.
- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.

---

## Verificación manual

Con `npm run dev`, en `http://localhost:3000/games/snake/play`:

1. Antes de tocar nada, sacar una captura con `classic`. Después del paso 7 y al final, comparar: debe ser idéntica.
2. Jugar unas frutas, cambiar a `NEÓN` y a `RETRO` con el mouse y seguir jugando: el puntaje y el largo no cambian y las flechas siguen manejando la serpiente sin clic extra.
3. `Tab` hasta el selector, recorrerlo con flechas (la serpiente no gira), `Enter` y seguir jugando con flechas.
4. Pausar con `P`, cambiar de skin, ver el cambio detrás del cartel y reanudar.
5. Recargar: la última skin queda aplicada desde el arranque, sin errores de hidratación en la consola.
6. En DevTools → Application, poner `av_skin_snake` en `"xyz"` y recargar: arranca en `classic`.
7. En DevTools → Network, bloquear `/games/snake/fruits.png` y recargar en cada skin: círculos de respaldo con los colores de la skin.
8. Emular 375 px: sin scroll horizontal y con las opciones del selector de al menos 44 px.
9. Abrir `/games/rocas/play`, `/games/tetris/play`, `/games/arkanoid/play` y `/games/serpentina/play`: sin selector y sin cambios.

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Agregar `skin` a las dependencias del efecto que crea el motor reinicia la partida en cada cambio | Efecto de skin separado con `ref`, declarado antes del de creación; criterio de aceptación "no la reinicia". |
| En la hidratación el motor nace con `classic` y un cuadro después pasa a la skin guardada (parpadeo de un cuadro) | Aceptado: el efecto de skin corre en el mismo commit que la lectura del cliente; evitarlo obligaría a diferir la creación del motor. |
| Las flechas en el selector también giran la serpiente, o `Espacio` no activa la opción por el `preventDefault` del motor | `stopPropagation()` en las teclas que maneja el selector; criterios de aceptación de teclado explícitos. |
| Teñir sobre una hoja ya teñida acumula color al alternar skins | Se tiñe siempre desde el `HTMLImageElement` original y se cachea por id; criterio de aceptación de alternancia. |
| Memoria: cada hoja teñida pesa ≈ 6,7 MB | Máximo dos hojas teñidas por motor; `destroy()` vacía la caché. |
| `setSkin` llega antes de que cargue el PNG | `refreshSheet()` también corre en `onload`, con la skin vigente. |
| `retro` queda justo en el límite de contraste del cuerpo (3,3:1) | Valor calculado y documentado; la cabeza (6:1) guía la lectura. Si en pantalla no alcanza, ajustar en la spec, no en la implementación. |
| Frutas oscuras (berenjena, uva) se pierden en `neon` | El tinte magenta al 35 % las aclara y el `fruitGlow` las recorta contra el fondo. |
| `shadowBlur` queda activo y ensucia el resto del cuadro | `withGlow` resetea `shadowBlur = 0` siempre después de dibujar. |
| Un id de skin manipulado en `localStorage` rompe el motor | `readStoredSkin` y `resolveSkin` validan y caen a `classic`. |
| La regla de refs de React 19 marca la escritura del `ref` | El `ref` se escribe dentro del efecto de skin, no durante el render. |

---

## Lo que **no** está en esta spec

- Skins de cualquier otro juego.
- Cambios al HUD, al CRT, al modal, a los covers o a la página de detalle según la skin.
- Skins extra, editor de paletas o skins por usuario en Supabase.
- PNGs nuevos o recoloreados y sprites de serpiente.
- Cambios de jugabilidad, controles, puntaje o niveles.
- Un módulo compartido de tinte o de input.
- Migraciones o cambios de esquema.
- Tests automatizados de cualquier tipo.

Cada uno de estos, si se necesita, va en su propia spec.
