# SPEC 16 — Skins de FROGGER (classic, neón, retro)

> **Status:** Implemented
> **Depends on:** SPEC 15 (frogger-game), SPEC 11 (snake-skins)
> **Date:** 2026-10-09
> **Objective:** Que FROGGER se pueda jugar con tres paletas de canvas (`classic` por defecto, `neon` y `retro`) elegibles desde el selector del player, reutilizando la plataforma de skins de SPEC 11 sin tocarla.

---

## Por qué existe esta spec

Una skin es **solo la paleta del canvas**: fondo, entidades, partículas y barra de tiempo que dibuja el motor. No cambia el HUD, la clase `.cover-frogger`, la jugabilidad ni los assets. Lo no obvio en FROGGER:

- **La plataforma ya existe.** SPEC 11 dejó implementados `lib/games/skins.ts`, `GameEngineOptions` + `setSkin?` en `lib/games/types.ts`, `GAME_SKINS` en el registry y `SkinSelector` conectado en `GamePlayer`/`GameCanvas`. Esta spec **no toca** nada de eso: solo agrega `lib/games/frogger/skins.ts`, conecta el motor y suma `frogger` a `GAME_SKINS`. El selector aparece solo.
- **No hay sprites.** Todo se dibuja con primitivas (`fillRect`, `arc`, `stroke`); no hay `drawImage` ni PNGs. No hace falta tinte de spritesheet.
- **`classic` ya usa glow.** A diferencia de SNAKE, el render actual aplica `shadowBlur` a la rana, la dama, la mosca, los vehículos, la serpiente y la barra de tiempo (`render.ts:151-152`, `161-162`, `220-221`, `350-351`, `391-392`, `418-419`). Como `classic` tiene que verse idéntico, el glow pasa a ser un **dato de la paleta** (blur por entidad, `0` = sin glow): `classic` conserva sus valores, `neon` los define y `retro` los pone todos en `0`.
- **Hay un color mezclado con la lógica de carriles.** `VEHICLE_COLORS` (`render.ts:79-85`) está indexado por **número de fila**, con `COLORS.laneMark` como respaldo (`render.ts:346`). Pasa a indexarse por **sprite del vehículo** (`car`, `digger`, `racer`, `sedan`, `truck`), que hoy es 1:1 con la fila (`lanes.ts:54-58`), así la paleta no depende de la geometría de carriles y el respaldo desaparece.
- **Hay un `rgba` suelto fuera de `COLORS`.** La cabina de los vehículos usa `"rgba(0,0,0,0.35)"` en línea (`render.ts:359`). No puede quedar como overlay neutro igual en todas las skins, porque en `retro` (paleta plana) generaría tonos fuera de la paleta: pasa a la paleta como `cabShade`.
- **`retro` no es Game Boy en este juego.** FROGGER tiene ~10 tipos de entidad sobre 4 zonas de fondo (seto, río, franja, carretera). Con los 4 tonos del DMG no se pueden cumplir a la vez el 3:1 contra el fondo y la separación cocodrilo/tronco/tortuga (ver Decisiones). Se usa un subconjunto de **8 colores de la paleta NES (2C02)**, con la disposición del arcade de 1981: carretera negra, río azul, franjas violetas.

---

## Alcance

**Dentro:**

- `lib/games/frogger/skins.ts` (nuevo): `FroggerPalette`, `FroggerGlow`, `VehicleSprite` y `FROGGER_SKINS` con `classic`, `neon` y `retro`.
- `lib/games/frogger/render.ts`: se borran `COLORS` y `VEHICLE_COLORS`; `drawFrame(ctx, frame, palette)` y cada función de dibujo recibe la paleta; helper `withGlow`.
- `lib/games/frogger/engine.ts`: la factory acepta `options`, resuelve con `resolveSkin` e implementa `setSkin`.
- `lib/games/registry.ts`: `frogger: Object.keys(FROGGER_SKINS)` en `GAME_SKINS`.
- `GAMES.md`: línea `- **Skins:** classic (default), neon, retro` en la sección FROGGER.

**Fuera de alcance:**

- Cualquier cambio en `lib/games/skins.ts`, `lib/games/types.ts`, `components/player/**` o `app/globals.css` (la plataforma de SPEC 11 se usa tal cual).
- Skins de CROAC u otro juego (cada una va en su propia spec).
- Skins extra además de las tres requeridas.
- Cambiar el HUD, el marco CRT, el modal, la clase `.cover-frogger` o la página de detalle según la skin.
- Cambios de velocidades, tamaños, hitboxes, puntaje, niveles, relojes de amenazas o controles.
- Cambiar las transparencias de animación (`globalAlpha` de tortugas hundiéndose y de las animaciones de muerte): son parte de la lectura del juego, no de la paleta (ver Decisiones).
- Migraciones, `supabase/`, `public/`, `resources/`.
- Tests automatizados: el proyecto no tiene test runner.

---

## Auditoría (estado antes de esta spec)

| Chequeo | Estado | Evidencia |
| ------- | ------ | --------- |
| Contrato compartido | ✅ | `lib/games/skins.ts:1-53` (`REQUIRED_SKINS`, `resolveSkin`, `SKIN_LABELS`, helpers de `localStorage`); `lib/games/types.ts:16-29` (`setSkin?`, `GameEngineOptions`, tercer parámetro); `lib/games/registry.ts:28-30` (`GAME_SKINS`). |
| Selector | ✅ | `components/player/SkinSelector.tsx:33-62` (`radiogroup`, `aria-label="Skin"`); `GamePlayer.tsx:47-79,167-172` (estado + `useSyncExternalStore` + `av_skin_<slug>`); `GameCanvas.tsx:37-53` (efecto de skin separado, `options` al crear). |
| Skins del juego | ❌ | `lib/games/frogger/skins.ts` no existe; `frogger` no está en `GAME_SKINS` (`registry.ts:28-30`). |
| El motor las usa | ❌ | `engine.ts:56` la factory recibe solo `(canvas, callbacks)`; no hay `resolveSkin` ni `setSkin` (`engine.ts:289-313`). |
| Sin colores sueltos | ❌ | `render.ts:42-77` (`COLORS`, 34 valores), `render.ts:79-85` (`VEHICLE_COLORS`, 5 hex), `render.ts:359` (`"rgba(0,0,0,0.35)"` en línea). El resto de `lib/games/frogger/` no tiene literales de color. |
| Sprites | ✅ (n/a) | No hay `drawImage` en `lib/games/frogger/`; todo son primitivas. |
| Legibilidad | — | Solo existe `classic` (se deja igual; nota: tronco `#7a4a22` sobre río `#04102e` da ≈ 2,5:1 hoy). Se especifica abajo para `neon` y `retro`. |
| `GAMES.md` | ❌ | La sección FROGGER (`GAMES.md:144-169`) no lista skins. |

---

## Decisiones

**Tomadas:**

- **Reutilizar la plataforma de SPEC 11 sin cambios.** Cambio en vivo con `setSkin`, persistencia `av_skin_frogger`, selector junto a PAUSA y devolución de foco al canvas ya están resueltos y probados con SNAKE. *Descartada:* ajustar el selector o los tipos para este juego (no hace falta y rompería la regla de un juego por spec).
- **Cambio de skin en vivo, sin reiniciar.** `setSkin(id)` solo reemplaza `palette` en el estado del motor; no toca rana, carriles, bahías, amenazas, cola de saltos, temporizador, puntaje, vidas ni nivel. *Descartada:* reiniciar la partida o recrear el motor (pierde el estado).
- **`setSkin` redibuja un cuadro si el loop está detenido.** En pausa `rafId === null`; sin redibujar, el canvas mostraría la skin vieja detrás de "EN PAUSA". Se llama a `render()` sin `update`. En `gameover` el loop sigue corriendo (`engine.ts:252-257`), así que no hace falta caso especial. *Descartada:* esperar al próximo cuadro.
- **La paleta se resuelve una vez y se pasa al render por parámetro.** `resolveSkin(FROGGER_SKINS, options?.skin)` al crear y en `setSkin`; `drawFrame(ctx, frame, palette)`. Sin lookups por cuadro. *Descartada:* poner la paleta dentro de `Frame` (mezcla estado del juego con presentación) o que `render.ts` importe `FROGGER_SKINS` y busque por id cada cuadro.
- **El glow es un dato de la paleta (`glow: FroggerGlow`, blur en px por entidad).** El color de la sombra sigue siendo el color de relleno de la entidad, como hoy. Un helper `withGlow(ctx, color, blur, draw)` hace `save` → `shadowColor`/`shadowBlur` → `draw` → `restore` solo si `blur > 0`; con `0` dibuja directo, sin sombra. `classic` lleva los valores de hoy (rana 10, resto 8), `neon` refuerza los de las entidades clave y `retro` los pone en `0`. *Descartadas:* quitar el glow de `classic` (cambia su aspecto) y `Glow | null` con color propio como en SNAKE (acá el color de sombra siempre coincide con el relleno; un número alcanza).
- **`VEHICLE_COLORS` pasa a indexarse por sprite (`vehicles: Record<VehicleSprite, string>`).** Hoy fila y sprite son 1:1 (`lanes.ts:54-58`), así que `classic` queda idéntico; la paleta deja de depender de los números de fila y el respaldo `?? COLORS.laneMark` desaparece porque el tipo es exhaustivo. `drawVehicle` estrecha `lane.def.sprite` con un guard `isVehicleSprite`. *Descartada:* mantener la clave por fila (acopla la paleta a `LANE_DEFS`; mover un carril cambiaría su color).
- **La sombra de cabina (`cabShade`) entra en la paleta.** `classic` y `neon` llevan `"rgba(0,0,0,0.35)"`; `retro` un color sólido de su paleta. *Descartada:* dejarla como overlay neutro igual en todas (en `retro` mezclaría tonos fuera de los 8 colores).
- **Las transparencias de animación quedan fuera de la paleta.** `globalAlpha` 0,55 de las tortugas hundiéndose (`render.ts:331`) y los fundidos de chapuzón/aplastamiento (`render.ts:172,183`) son avisos de juego (SPEC 15: "las tortugas que se sumergen avisan hundiéndose"). Se mantienen iguales en las tres skins; en `retro` producen tonos intermedios transitorios, que se aceptan. *Descartada:* opacidad 1 en `retro` (la tortuga que se hunde solo se distinguiría por el radio 10 vs 15 px, y el aviso es jugabilidad).
- **Los colores con alpha de agua (`wave`, `ripple`, `flyWing`) siguen siendo roles de la paleta.** `classic` y `neon` usan `rgba`; `retro` usa colores sólidos de la paleta (plana).
- **`retro` = 8 colores de la paleta NES (2C02), disposición arcade.** Negro `#000000` (carretera), azul `#0000bc` (río y bahías), violeta `#6844fc` (franjas seguras, como el arcade), verde `#00a800` (seto, cocodrilos, nenúfares), lima `#b8f818` (rana), marrón `#ac7c00` (troncos), rojo `#f83800` (tortugas, peligro), blanco `#fcfcfc` (marcas, dientes, ojos, dama, mosca). Se descartó el amarillo: la mosca y los ojos de cocodrilo pasan a blanco y el aviso de tiempo a blanco. *Descartadas:* **Game Boy DMG** (solo hay dos pares de tonos con ≥ 3:1; cocodrilo `#306230` sobre río `#0f380f` da 1,8:1, y tronco, tortuga y cocodrilo quedarían todos en el tono claro, separados solo por forma), **fósforo ámbar** (monocromo: peor aún para separar amenazas) y **CGA** (4 colores, mismo problema que el DMG).
- **`neon` codifica el riesgo por color.** Verde neón `#39ff14` = la rana (y solo la rana, para que se vea primero); magenta `#ff2bd6` = peligro (cocodrilo, tiempo crítico); cyan `#00f0ff` = tortugas (plataforma que puede fallar); naranja `#e05a00` = troncos (plataforma firme). Fondo casi negro con un matiz por zona (violeta el seto, azul el río, verde la franja, gris la carretera) para que las zonas se lean sin competir con las entidades.
- **Las mandíbulas del cocodrilo de bahía (`crocDark`) deben contrastar ≥ 3:1 con el agua de la bahía** porque son la fase mortal. En `classic` se deja como está; en `neon` se usa `#b0189a` (≈ 3,3:1 sobre `#000814`) y en `retro` el rojo `#f83800` (≈ 3,1:1 sobre `#0000bc`) con dientes blancos.

**Descartadas (resumen):** tocar la plataforma de SPEC 11; reiniciar al cambiar de skin; paleta dentro de `Frame`; quitar el glow de `classic`; colores de vehículos por fila; `cabShade` neutro común; opacidad 1 en tortugas de `retro`; Game Boy, ámbar y CGA para `retro`.

---

## Paletas

Roles de `FroggerPalette` (`lib/games/frogger/skins.ts`):

```ts
import type { GameSkins } from "../skins";
import type { LaneSprite } from "./lanes";

export type VehicleSprite = Exclude<LaneSprite, "turtles" | "log">;

/** shadowBlur in px per entity; 0 = no glow. The shadow color is the entity's fill. */
export interface FroggerGlow {
  frog: number;
  lady: number;
  fly: number;
  vehicle: number;
  snake: number;
  timer: number;
}

export interface FroggerPalette {
  hedge: string;
  hedgeLeaf: string;
  bayWater: string;
  lily: string;
  river: string;
  wave: string;
  grass: string;
  grassEdge: string;
  road: string;
  laneMark: string;
  log: string;
  logRing: string;
  turtle: string;
  turtleShell: string;
  ripple: string;
  croc: string;
  crocDark: string;     // river croc scutes + bay croc jaws
  crocTeeth: string;
  crocEye: string;
  fly: string;
  flyWing: string;
  lady: string;
  snake: string;
  snakeDark: string;    // snake head
  frog: string;
  frogEye: string;      // pupils (frog and lady)
  frogEyeWhite: string;
  splash: string;
  squash: string;
  timerTrack: string;
  timerOk: string;
  timerWarn: string;
  timerDanger: string;
  headlight: string;
  cabShade: string;
  vehicles: Readonly<Record<VehicleSprite, string>>;
  glow: FroggerGlow;
}

export const FROGGER_SKINS: GameSkins<FroggerPalette> = { classic, neon, retro };
```

### Colores

| Rol | `classic` (hoy) | `neon` | `retro` (NES 2C02) |
| --- | --------------- | ------ | ------------------ |
| `hedge` | `#06240f` (`render.ts:43`) | `#1a0638` — violeta casi negro, zona mortal distinta del agua | `#00a800` — seto verde del arcade |
| `hedgeLeaf` | `#0f4d22` (`render.ts:44`) | `#4b1a8a` — textura apenas visible | `#000000` — hojas planas oscuras |
| `bayWater` | `#020b1f` (`render.ts:45`) | `#000814` — casi negro azulado; las bahías se recortan contra el seto violeta | `#0000bc` — mismo agua que el río |
| `lily` | `#2fbf5a` (`render.ts:46`) | `#1a8c3a` — verde apagado (≈ 4,7:1), para no confundirse con la rana `#39ff14` | `#00a800` — ≈ 3,8:1 sobre el azul |
| `river` | `#04102e` (`render.ts:47`) | `#00101f` — casi negro azulado | `#0000bc` — río azul del arcade |
| `wave` | `rgba(120,200,255,0.12)` (`render.ts:48`) | `rgba(0,240,255,0.15)` — reflejo cyan tenue | `#6844fc` — trazos planos violeta (decorativo) |
| `grass` | `#0a2a12` (`render.ts:49`) | `#03140a` — casi negro verdoso | `#6844fc` — franjas violetas del arcade |
| `grassEdge` | `#39ff14` (`render.ts:50`) | `#00f0ff` — borde cyan; el verde queda reservado a la rana | `#fcfcfc` — borde blanco |
| `road` | `#141416` (`render.ts:51`) | `#08080d` — casi negro | `#000000` — carretera negra |
| `laneMark` | `#e6e9ff` (`render.ts:52`) | `#7a7aa8` — lavanda apagado, guía sin competir con los vehículos | `#fcfcfc` |
| `log` | `#7a4a22` (`render.ts:53`) | `#e05a00` — naranja, plataforma firme; ≈ 5,2:1 sobre el río | `#ac7c00` — ≈ 3,3:1 sobre el azul |
| `logRing` | `#5a3416` (`render.ts:54`) | `#6b2a00` | `#000000` |
| `turtle` | `#c2412d` (`render.ts:55`) | `#00f0ff` — cyan, plataforma que puede hundirse; ≈ 11,8:1 | `#f83800` — tortugas rojas del arcade; ≈ 3,1:1 |
| `turtleShell` | `#8e2a1c` (`render.ts:56`) | `#006b73` | `#000000` |
| `ripple` | `rgba(120,200,255,0.55)` (`render.ts:57`) | `rgba(0,240,255,0.6)` | `#fcfcfc` — burbujas blancas donde se sumergió |
| `croc` | `#2f9e44` (`render.ts:58`) | `#ff2bd6` — magenta = peligro, distinto del tronco naranja; ≈ 6:1 | `#00a800` — ≈ 3,8:1; se separa del tronco marrón por color |
| `crocDark` | `#16602a` (`render.ts:59`) | `#b0189a` — mandíbulas de bahía ≈ 3,3:1 sobre `#000814` | `#f83800` — mandíbulas rojas ≈ 3,1:1 sobre el azul |
| `crocTeeth` | `#ffffff` (`render.ts:60`) | `#ffffff` | `#fcfcfc` |
| `crocEye` | `#f5ff00` (`render.ts:61`) | `#ffe600` | `#fcfcfc` |
| `fly` | `#f5ff00` (`render.ts:62`) | `#ffe600` — amarillo de marca; ≈ 15:1 | `#fcfcfc` — ≈ 11,8:1 sobre el azul, 3,1:1 sobre el nenúfar |
| `flyWing` | `rgba(230,233,255,0.8)` (`render.ts:63`) | `rgba(255,255,255,0.7)` | `#fcfcfc` |
| `lady` | `#ff6ec7` (`render.ts:64`) | `#ffffff` — ≈ 3,7:1 sobre el tronco `#e05a00` | `#fcfcfc` — ≈ 3,6:1 sobre el tronco `#ac7c00` |
| `snake` | `#c6ff00` (`render.ts:65`) | `#ffe600` — distinta de la rana; ≈ 15:1 sobre la franja | `#000000` — ≈ 3,8:1 sobre el violeta |
| `snakeDark` | `#5c7a00` (`render.ts:66`) | `#8a7a00` | `#f83800` — cabeza roja sobre el cuerpo negro |
| `frog` | `#a6ff00` (`render.ts:67`) | `#39ff14` — único verde neón del juego; ≈ 14:1 | `#b8f818` — único lima; ≈ 16:1 sobre la carretera, 4,3:1 sobre la franja |
| `frogEye` | `#020b1f` (`render.ts:68`) | `#000814` | `#000000` |
| `frogEyeWhite` | `#ffffff` (`render.ts:69`) | `#ffffff` | `#fcfcfc` |
| `splash` | `#78c8ff` (`render.ts:70`) | `#00f0ff` | `#fcfcfc` |
| `squash` | `#a6ff00` (`render.ts:71`) | `#39ff14` | `#b8f818` |
| `timerTrack` | `#0a0a12` (`render.ts:72`) | `#0a0a14` | `#000000` |
| `timerOk` | `#00ff88` (`render.ts:73`) | `#39ff14` | `#b8f818` |
| `timerWarn` | `#f5ff00` (`render.ts:74`) | `#ffe600` | `#fcfcfc` — sin amarillo en la paleta; blanco ≠ lima ≠ rojo |
| `timerDanger` | `#ff006e` (`render.ts:75`) | `#ff2bd6` | `#f83800` |
| `headlight` | `#fff6b0` (`render.ts:76`) | `#ffffff` | `#fcfcfc` |
| `cabShade` | `rgba(0,0,0,0.35)` (`render.ts:359`) | `rgba(0,0,0,0.35)` | `#000000` — cabina sólida |
| `vehicles.car` | `#f5ff00` (`render.ts:80`, fila 12) | `#ffe600` | `#6844fc` — ≈ 3,8:1 sobre negro |
| `vehicles.digger` | `#00ff88` (`render.ts:81`, fila 11) | `#00f0ff` | `#00a800` |
| `vehicles.racer` | `#ff006e` (`render.ts:82`, fila 10) | `#ff2bd6` | `#f83800` |
| `vehicles.sedan` | `#e6e9ff` (`render.ts:83`, fila 9) | `#ffffff` | `#fcfcfc` |
| `vehicles.truck` | `#00f5ff` (`render.ts:84`, fila 8) | `#e05a00` | `#ac7c00` |

### Glow (`shadowBlur`, px)

| Entidad | `classic` (hoy) | `neon` | `retro` |
| ------- | --------------- | ------ | ------- |
| `frog` | 10 (`render.ts:152`) | 16 — la entidad clave | 0 |
| `lady` | 8 (`render.ts:162`) | 10 | 0 |
| `fly` | 8 (`render.ts:221`) | 12 — bonus visible de lejos | 0 |
| `vehicle` | 8 (`render.ts:351`) | 8 | 0 |
| `snake` | 8 (`render.ts:392`) | 10 | 0 |
| `timer` | 8 (`render.ts:419`) | 8 | 0 |

Troncos, tortugas, cocodrilos, nenúfares y fondo no tienen glow en ninguna skin (como hoy).

### Contraste y distinción

Luminancia relativa WCAG, entidad contra el fondo sobre el que se mueve:

- `classic`: sin cambios respecto de hoy (incluido el tronco ≈ 2,5:1, que no se corrige porque `classic` debe quedar idéntico).
- `neon`: rana ≈ 14:1 (franja/carretera); troncos ≈ 5,2:1, tortugas ≈ 11,8:1, cocodrilo ≈ 6:1 sobre el río; vehículos ≥ 6:1 sobre la carretera (el más bajo, `racer` magenta); serpiente ≈ 15:1; mosca ≈ 15:1; dama ≈ 3,7:1 sobre su tronco; mandíbulas de bahía ≈ 3,3:1.
- `retro`: rana ≈ 16:1 (carretera), 4,3:1 (franja); tronco ≈ 3,3:1, tortuga ≈ 3,1:1, cocodrilo ≈ 3,8:1 sobre el río; vehículos ≥ 3,8:1 sobre negro; serpiente ≈ 3,8:1 sobre el violeta; nenúfar ≈ 3,8:1; mandíbulas ≈ 3,1:1; dama ≈ 3,6:1. Exactamente 8 colores.
- Distinguir entre sí: en el río, tronco ≠ tortuga ≠ cocodrilo por color en las dos skins nuevas (`neon`: naranja / cyan / magenta; `retro`: marrón / rojo / verde). La rana tiene un color exclusivo en cada skin. El cocodrilo de bahía asomando (cuerpo + ojos, seguro) se distingue de la boca abierta (V con dientes, mortal) por forma y por color (`croc` vs `crocDark`). Colores repetidos solo entre zonas que no se cruzan (p. ej. `neon`: `digger` cyan en la carretera y tortugas cyan en el río; serpiente amarilla en la franja y `car` amarillo en la carretera).

---

## Contratos

`lib/games/frogger/render.ts`:

```ts
export function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame, palette: FroggerPalette): void;
```

`lib/games/frogger/engine.ts`:

```ts
export const createFroggerGame: GameEngineFactory = (canvas, callbacks, options) => { /* ... */
  // returns { pause, resume, restart, destroy, setSkin }
};
```

`lib/games/registry.ts`:

```ts
export const GAME_SKINS = {
  snake: Object.keys(SNAKE_SKINS),
  frogger: Object.keys(FROGGER_SKINS),
};
```

---

## Plan de implementación

Cada paso deja la app compilando y FROGGER jugable. Verificación estática por paso: `npm run lint` y `npx tsc --noEmit` (sin build).

1. **Extraer `classic` (refactor puro).** Crear `lib/games/frogger/skins.ts` con `VehicleSprite`, `FroggerGlow`, `FroggerPalette` y `FROGGER_SKINS` con `classic` completo (valores exactos de las tablas, incluido `cabShade` y `glow`), y `neon`/`retro` provisoriamente iguales a `classic` para que el tipo compile.
2. **Render con paleta.** En `lib/games/frogger/render.ts`: borrar `COLORS` y `VEHICLE_COLORS`; cambiar la firma a `drawFrame(ctx, frame, palette)` y pasar `palette` (o la parte que necesite) a cada `draw*`; reemplazar cada `COLORS.x` por `palette.x`, el `rgba` de cabina por `palette.cabShade` y `VEHICLE_COLORS[row]` por `palette.vehicles[sprite]` con un guard `isVehicleSprite(sprite): sprite is VehicleSprite`. Agregar `withGlow(ctx, color, blur, draw)` (si `blur > 0`: `save`, `shadowColor`, `shadowBlur`, `draw`, `restore`; si no, solo `draw`) y usarlo en los 6 lugares que hoy hacen `save`/`shadow*`/`restore`, con `palette.glow.<entidad>`. No cambiar tamaños, radios, offsets, `globalAlpha` ni el orden de dibujo. Prueba: `rg '#[0-9a-fA-F]{3,8}|rgba?\(|hsl' lib/games/frogger --glob '!skins.ts'` sin resultados.
3. **Motor.** En `lib/games/frogger/engine.ts`: la factory recibe `options`; `let palette = resolveSkin(FROGGER_SKINS, options?.skin)`; `render()` pasa `palette` a `drawFrame`. Agregar `setSkin(id)` al objeto devuelto: si `destroyed` no hace nada; `palette = resolveSkin(FROGGER_SKINS, id)`; si `rafId === null`, llama a `render()` una vez. Prueba manual: con `classic` el juego se ve idéntico a antes (comparar capturas en nivel 1 y en nivel 3, con cocodrilos y serpiente).
4. **`neon` y `retro`.** Completar `FROGGER_SKINS.neon` y `FROGGER_SKINS.retro` con los valores de las tablas. Constantes con nombre para los colores repetidos (p. ej. `NES_WHITE`, `NEON_MAGENTA`), como en `lib/games/snake/skins.ts`.
5. **Registro.** En `lib/games/registry.ts`, importar `FROGGER_SKINS` y sumar `frogger: Object.keys(FROGGER_SKINS)` a `GAME_SKINS`. Prueba manual: el selector aparece en `/games/frogger/play`.
6. **`GAMES.md`.** En la sección FROGGER, debajo de **Assets**, agregar `- **Skins:** classic (default), neon, retro`.
7. **Pase final.** Recorrer los criterios de aceptación con `npm run dev`, revisar la consola y correr `npm run lint` y `npx tsc --noEmit`.

---

## Criterios de aceptación

**Refactor y alcance**

- [ ] Con `classic`, FROGGER se ve idéntico a antes de esta spec: fondo, bahías, nenúfares, troncos, tortugas (incluida la que se hunde), cocodrilos, mosca, dama, serpiente, vehículos con cabina y faros, rana, animaciones de muerte, barra de tiempo y glows.
- [ ] `rg '#[0-9a-fA-F]{3,8}|rgba?\(|hsl' lib/games/frogger --glob '!skins.ts'` no devuelve resultados.
- [ ] `lib/games/frogger/` no importa React ni `next/*`.
- [ ] `git diff` de esta spec solo toca `lib/games/frogger/skins.ts`, `render.ts`, `engine.ts`, `lib/games/registry.ts` (solo `GAME_SKINS` y su import) y la sección FROGGER de `GAMES.md`; no hay cambios en `constants.ts`, `lanes.ts`, `hazards.ts`, `rules.ts`, `input.ts`, `touch.ts`, en la plataforma de skins ni en `components/player/`.
- [ ] Los juegos sin skins (`/games/rocas/play`, `/games/tetris/play`, `/games/arkanoid/play`, `/games/croac/play`) siguen sin selector; `/games/snake/play` sigue igual.

**Selector y cambio en vivo**

- [ ] En `/games/frogger/play` aparece el selector con `CLÁSICO`, `NEÓN` y `RETRO` junto a PAUSA, con `CLÁSICO` marcado la primera vez.
- [ ] Cambiar de skin en mitad de la partida no la reinicia: posición de la rana, carriles, bahías ocupadas, amenazas, tiempo restante, puntaje, vidas y nivel siguen igual.
- [ ] Al elegir con un clic, las flechas vuelven a mover la rana de inmediato; recorrer el selector con flechas no hace saltar a la rana.
- [ ] Cambiar de skin en pausa actualiza el canvas detrás de "EN PAUSA"; al reanudar no hay saltos encolados.
- [ ] Cambiar de skin durante una animación de muerte o con el modal "FIN DEL JUEGO" abierto no emite callbacks extra (`onGameOver` sigue llegando una sola vez).
- [ ] "JUGAR DE NUEVO" conserva la skin elegida.

**Persistencia**

- [ ] La skin elegida persiste al recargar (key `av_skin_frogger` en `localStorage`).
- [ ] Con `av_skin_frogger` = `"inexistente"` o borrada, el juego arranca en `classic` sin errores.
- [ ] No hay errores de hidratación al cargar con una skin guardada distinta de `classic`.

**Paletas**

- [ ] `neon`: fondo casi negro por zonas, rana verde neón con glow, troncos naranjas, tortugas cyan, cocodrilos magenta, vehículos saturados con glow; troncos, tortugas y cocodrilos sin glow.
- [ ] `retro`: carretera negra, río y bahías azules, franjas violetas, seto verde, rana lima, troncos marrones, tortugas rojas, cocodrilos verdes; sin glow y sin colores fuera de los 8 de la tabla (salvo los tonos transitorios de la tortuga que se hunde y de las animaciones de muerte).
- [ ] En las tres skins se distinguen a simple vista: tronco / tortuga / cocodrilo; cocodrilo de bahía asomando / con la boca abierta; mosca en la bahía; dama sobre el tronco; serpiente en la franja; los tres estados de la barra de tiempo.

**Ciclo de vida**

- [ ] Bajo Strict Mode y al salir con SALIR y volver a entrar, el motor arranca con la skin guardada y cada tecla produce un solo salto.
- [ ] La consola no muestra errores ni warnings durante una partida completa con cambios de skin.
- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.

---

## Verificación manual

Con `npm run dev`, en `http://localhost:3000/games/frogger/play`:

1. Antes de implementar, sacar capturas con el juego actual en nivel 1 (mosca y dama visibles) y, si se puede, en nivel 3 (cocodrilos y serpiente). Después del paso 3 y al final, comparar con `classic`: deben ser idénticas.
2. Jugar unos saltos, cambiar a `NEÓN` y a `RETRO` con el mouse y seguir jugando: puntaje, tiempo y posición no cambian y las flechas mueven la rana sin clic extra.
3. `Tab` hasta el selector, recorrerlo con flechas (la rana no salta), `Enter` y seguir jugando.
4. Pausar con `P`, cambiar de skin, ver el cambio detrás del cartel y reanudar.
5. En cada skin, esperar una tortuga que se sumerge (filas 3 y 6) y verificar que se ve el aviso de hundimiento y las burbujas.
6. En cada skin, morir por vehículo (aplastamiento) y por agua (chapuzón); terminar la partida y cambiar de skin con el modal abierto.
7. Recargar: la última skin queda aplicada desde el arranque, sin errores de hidratación. En DevTools → Application, poner `av_skin_frogger` en `"xyz"` y recargar: arranca en `classic`.
8. Abrir `/games/croac/play` y `/games/snake/play`: CROAC sin selector, SNAKE con el suyo sin cambios.

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| El refactor altera `classic` (un color o un glow mal copiado) | Valores citados con `archivo:línea`; comparación de capturas antes/después; `withGlow` reproduce el mismo `save`/`restore`. |
| Cambiar la clave de `VEHICLE_COLORS` de fila a sprite cambia algún color | Hoy fila y sprite son 1:1 (`lanes.ts:54-58`); la tabla mapea cada sprite al color de su fila. |
| `retro` queda cerca del límite de 3:1 (tortuga ≈ 3,1:1, mandíbulas ≈ 3,1:1) | Valores calculados y documentados; la forma (círculos, V con dientes blancos) refuerza la lectura. Si en pantalla no alcanza, ajustar en la spec, no en la implementación. |
| La dama sobre la rana tiene poco contraste en `neon` y `retro` (blanco sobre verde/lima) | Igual que hoy en `classic` (rosa sobre lima); la dama conserva ojos oscuros y se ve sobre el tronco antes de recogerla. |
| `globalAlpha` genera tonos fuera de la paleta en `retro` | Aceptado y explícito en los criterios: es el aviso de hundimiento de SPEC 15. |
| `shadowBlur` queda activo y ensucia el resto del cuadro | `withGlow` usa `save`/`restore`; con blur `0` ni siquiera toca la sombra. |
| `setSkin` en pausa no se ve | `setSkin` dibuja un cuadro si `rafId === null`. |

---

## Lo que **no** está en esta spec

- Cambios a la plataforma de skins, al selector o a los estilos `.av-skin-*`.
- Skins de CROAC u otros juegos.
- Skins extra o editor de paletas.
- Cambios de jugabilidad, controles, puntaje, niveles o relojes de amenazas.
- Cambios al HUD, al CRT, al modal, al cover o a la página de detalle.
- Migraciones o cambios de esquema.
- Tests automatizados de cualquier tipo.

Cada uno de estos, si se necesita, va en su propia spec.
