# SPEC — CROAC (game jam)

> **Status:** Draft
> **Depends on:** SPEC 05 (asteroids-game), SPEC 06 (games-table-and-leaderboard)
> **Date:** 2026-10-07
> **Objective:** Agregar CROAC como juego nuevo de la galería (entrada propia en `games`, motor TypeScript escrito desde cero): un Frogger clásico y fiel con carretera, río, cinco nenúfares, temporizador por rana y tres vidas, con su ranking en Supabase y sin tocar RANARIA.
> **Game jam:** "Cruza la carretera y el río sin convertirte en papilla" — ángulo: acción / reflejos

---

## Por qué existe esta spec

Arcade Vault es una galería que crece: cada juego nuevo **suma** una entrada. El tema del jam pide cruzar una carretera y un río sin morir, y el ángulo es acción y reflejos. Frogger es el juego que inventó esa consigna, así que la propuesta es un Frogger clásico y fiel. El tema está en la mecánica: la carretera castiga quedarse quieta en el lugar equivocado (te pisan), el río castiga lo contrario (si no estás sobre algo que flota, te ahogás), y el temporizador te obliga a decidir rápido. Si se cambiara el tema, las reglas dejarían de tener sentido.

Cinco puntos de esta spec no son obvios:

- **No hay código fuente que portar.** No existe `resources/started-games/` de Frogger. Las reglas, los carriles, las velocidades, el puntaje y las colisiones se **definen en esta spec** con números concretos, como en la SPEC 09. Por eso la sección de Decisiones es larga.
- **RANARIA no se toca.** `ranaria` es un placeholder del catálogo (`cover-rana`, `playable = false`, `sort_order = 7`) cuya descripción es un Frogger. Sigue siendo un placeholder con arena falsa. Se aplica la regla de galería, igual que con CAÍDA (SPEC 07), BLOQUE BUSTER (SPEC 08) y SERPENTINA (SPEC 09). A cambio, la galería va a tener dos juegos de ranas: uno jugable y un placeholder.
- **La rana tiene dos sistemas de movimiento.** En tierra salta por una grilla de 40 px. En el río la arrastra el tronco o la tortuga, así que su `x` deja de estar alineada con la grilla. Por eso la `x` de la rana es continua (en px) y su fila es entera, y las bahías de meta aceptan un margen de tolerancia.
- **Es el primer juego de la galería con vidas y un temporizador dibujado en el canvas.** Las vidas usan `onLives` (que ya existe y el HUD muestra). El temporizador es un indicador dentro del juego, igual que el timer de power-up de ROCAS: es una barra en la fila inferior del canvas, sin texto. El HUD de la plataforma no cambia.
- **El juego es totalmente determinista.** No hay azar: las posiciones iniciales de los carriles, los ciclos de las tortugas que se sumergen y las velocidades son fijos. Dos partidas con las mismas teclas en los mismos momentos dan el mismo resultado. Eso hace justo el ranking y no hace falta un generador con semilla.

Criterios elegidos por el diseñador (no hubo preguntas, según las reglas del jam):

1. **Entrada nueva** `croac` en `games`. RANARIA queda intacta.
2. **Todo se dibuja con canvas.** No hay assets binarios ni nada en `public/`.
3. **Frogger clásico y sin agregados**: sin mosca bonus, sin rana dama, sin cocodrilos ni serpientes. Ver Descartadas.

---

## Scope

**In:**

- Migración de datos `supabase/migrations/<version>_add_croac_game.sql`, que inserta la fila `croac` en `games` con `playable = true`. Sin cambios de esquema ni de `lib/supabase/database.types.ts`.
- `lib/games/croac/`, en TypeScript puro y sin React, con `constants.ts`, `input.ts`, `lanes.ts`, `rules.ts`, `render.ts` y `engine.ts` (`createCroacGame`).
- Registro en `lib/games/registry.ts`: `croac: createCroacGame`.
- `app/globals.css`: clase de cover `.cover-croac` en CSS puro, visualmente distinta de `.cover-rana`.
- `GAMES.md`: fila en la tabla resumen y sección del juego (controles y reglas tomados del código), según el paso 7 de la Fase B de la skill.
- Verificación de RLS contra la API REST con la publishable key, y limpieza de las filas de prueba.

**Out of scope (para specs futuras):**

- Cualquier cambio a RANARIA (`ranaria` sigue con arena falsa y `playable = false`) o a otro juego del catálogo.
- Motores para los demás placeholders (Bloque Buster, Caída, Serpentina, Glotón, Invasores, Ranaria, Duelo Pixel).
- Sonido, música y control de mute.
- Sprites o imágenes: rana, autos, camiones, troncos, tortugas y nenúfares se dibujan con primitivas de canvas.
- Agregados del Frogger de arcade: mosca bonus en las bahías, rana dama sobre los troncos, cocodrilos (en los troncos o en las bahías), serpiente en la franja media, nutrias en el río.
- Vida extra por puntaje.
- Animación de "rana en casa" con pausa, pantalla de nivel completado o pantalla de victoria. Al llenar las 5 bahías, el nivel sube sin interrumpir el juego.
- Más carriles, diseños de carriles distintos por nivel o un tope de niveles. A partir del nivel 2 solo cambia la velocidad, que tiene un techo.
- Salto continuo manteniendo la tecla (auto-repeat): cada salto es una pulsación.
- Control con mouse, controles táctiles o un gamepad. El aviso "REQUIERE TECLADO" de `GameCanvas` cubre el caso táctil.
- Texto dentro del canvas: el canvas no dibuja puntaje, nivel, vidas, `PAUSA`, `GAME OVER`, "TIEMPO" ni los puntos ganados.
- Cambios en `GamePlayer`, `GameCanvas` o `GameCallbacks`.
- Soporte HiDPI/retina, pantalla completa y canvas con proporción distinta de 4:3.
- Mover `createInput` a un módulo compartido `lib/games/input.ts` (sería la quinta copia).
- Cambios de esquema, tablas nuevas, validación del puntaje en el servidor o regenerar `database.types.ts`.
- Tests automatizados: el proyecto sigue sin test runner.

---

## Data model

**Fila nueva en `public.games`** (la inserta la migración; el resto de columnas toma sus valores por defecto):

```sql
insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order) values
('croac', 'CROAC',
 'Cruza la carretera y el río sin convertirte en papilla.',
 'Guía a la rana con las flechas o con WASD a través de cinco carriles de tráfico y un río de troncos y tortugas que se sumergen. Llena los cinco nenúfares antes de que se acabe el tiempo para pasar de nivel: todo se moverá más rápido. Tienes tres vidas.',
 'ARCADE', 'cover-croac', 'magenta', true, 12);
```

Estado esperado antes de la migración: 11 juegos, con `rocas`, `tetris`, `arkanoid` y `snake` en `playable = true` y `sort_order` del 1 al 11 sin huecos. Después: 12 juegos, con `croac` también jugable. `sort_order = 12` se confirma contra la base antes de aplicar, porque la columna es única.

**Constantes del motor (`lib/games/croac/constants.ts`)**, definidas en esta spec:

- Canvas: `W = 800`, `H = 600`, `MAX_DT = 0.05` s. El origen está arriba a la izquierda.
- Grilla: `CELL = 40`, `COLS = 20`, `ROWS = 15`. La fila `r` ocupa `y ∈ [r·40, r·40 + 40)`.
- Filas:
  - `HEDGE_ROW = 0`: seto superior decorativo, no se puede pisar.
  - `GOAL_ROW = 1`: seto con las 5 bahías.
  - `RIVER_ROWS = 2..6`: río.
  - `MEDIAN_ROW = 7`: franja segura del medio.
  - `ROAD_ROWS = 8..12`: carretera.
  - `START_ROW = 13`: vereda de salida.
  - `TIMER_ROW = 14`: barra de tiempo, no se puede pisar.
- Rana: aparece en `START_X = 400` (centro), `START_ROW = 13`. `HOP = 40` px por salto, horizontal o vertical. Hitbox horizontal de `FROG_HALF_W = 14` (28 px de ancho). Un salto horizontal se ignora si el centro resultante queda fuera de `[FROG_MIN_X = 20, FROG_MAX_X = 780]`. `HOP_ANIM_MS = 90` es solo visual (estiramiento): el salto es lógicamente instantáneo.
- Cola de saltos: `MAX_QUEUED_HOPS = 2`, y se consume un salto por cuadro.
- Bahías: `BAY_CENTERS = [80, 240, 400, 560, 720]` (todas alcanzables desde `START_X` con saltos de 40 px), `BAY_WIDTH = 64` (lo que se dibuja) y `BAY_TOLERANCE = 24` (la rana entra si `|x − centro| ≤ 24`).
- Vehículos: hitbox recortada `VEHICLE_INSET = 4` px por lado.
- Tortugas que se sumergen, con un ciclo `DIVE_CYCLE_S = 5.4` dividido en fases: `DIVE_SURFACED_S = 3.0` (pisable), `DIVE_SINKING_S = 0.6` (pisable, se dibuja hundiéndose), `DIVE_UNDER_S = 1.2` (**no** pisable, se dibuja solo como ondas) y `DIVE_RISING_S = 0.6` (pisable).
- Tiempo: `TIME_PER_FROG = 30` s, que se reinicia con cada rana nueva. La barra se dibuja verde por encima de 10 s, amarilla entre 10 y 5 s, y magenta por debajo de 5 s (`TIME_WARN_S = 10`, `TIME_DANGER_S = 5`).
- Vidas: `LIVES = 3` (tres ranas por partida).
- Muerte: `DEATH_MS = 1000` de animación (aplastada o salpicón) antes de reaparecer.
- Puntaje:
  - `STEP_POINTS = 10` por cada fila nueva alcanzada por la rana actual, en las filas 12 a 2.
  - `HOME_POINTS = 50` por entrar a una bahía.
  - `TIME_BONUS_PER_HALF_S = 10` por cada medio segundo entero que quede en el temporizador al entrar a una bahía: `floor(timeLeft · 2) · 10`, con un máximo de 600.
  - `LEVEL_CLEAR_POINTS = 1000` al llenar las 5 bahías.
- Velocidad por nivel: `speedMultiplierFor(level) = 1 + LEVEL_SPEED_STEP · (min(level, LEVEL_SPEED_CAP) − 1)`, con `LEVEL_SPEED_STEP = 0.12` y `LEVEL_SPEED_CAP = 9` (techo de ×1,96 en el nivel 9). El número de nivel sigue subiendo sin tope.

**Carriles (`LANE_DEFS` en `lanes.ts`)**, con velocidades base en px/s y `dir` igual a `+1` (derecha) o `−1` (izquierda). Cada carril tiene `count` objetos separados `spacing` px. El período `count · spacing` siempre es ≥ `W + width`, así que un objeto nunca aparece o desaparece dentro del canvas.

| Fila | Tipo | Dibujo | `width` | `dir` | `speed` | `count` | `spacing` | `offset` | Sumergible |
| ---- | ---- | ------ | ------- | ----- | ------- | ------- | --------- | -------- | ---------- |
| 12 | road | auto amarillo | 48 | −1 | 70 | 4 | 240 | 0 | — |
| 11 | road | tractor verde | 48 | +1 | 55 | 3 | 320 | 100 | — |
| 10 | road | auto deportivo magenta | 48 | −1 | 110 | 3 | 300 | 200 | — |
| 9 | road | auto cian | 48 | +1 | 80 | 4 | 230 | 50 | — |
| 8 | road | camión blanco | 112 | −1 | 60 | 3 | 340 | 150 | — |
| 6 | river | 3 tortugas | 120 | −1 | 50 | 4 | 260 | 0 | grupo `1`, fase inicial 0 s |
| 5 | river | tronco corto | 120 | +1 | 45 | 3 | 330 | 80 | — |
| 4 | river | tronco largo | 240 | +1 | 80 | 2 | 520 | 0 | — |
| 3 | river | 2 tortugas | 80 | −1 | 65 | 4 | 240 | 120 | grupo `2`, fase inicial 2,7 s |
| 2 | river | tronco medio | 160 | +1 | 60 | 3 | 340 | 40 | — |

El objeto `i` de un carril arranca en `x = offset + i · spacing`, normalizado al período. La velocidad efectiva es `dir · speed · speedMultiplierFor(level)`.

**Estado del motor (en el closure de `createCroacGame`):**

```ts
type Direction = "up" | "down" | "left" | "right";
type GameState = "playing" | "dying" | "gameover"; // más un flag interno `paused`
type LaneKind = "road" | "river";
type LaneSprite = "car" | "tractor" | "racer" | "truck" | "turtles" | "log";
type DeathCause = "vehicle" | "water" | "edge" | "time" | "bay";
type DivePhase = "surfaced" | "sinking" | "under" | "rising";

interface LaneDef {
  row: number; kind: LaneKind; sprite: LaneSprite;
  width: number; dir: 1 | -1; speed: number;
  count: number; spacing: number; offset: number;
  divingIndex?: number; diveStartS?: number;
}
interface LaneObject { x: number; diving: boolean; diveClock: number } // x = borde izquierdo
interface Lane { def: LaneDef; vx: number; period: number; objects: LaneObject[] }
interface Frog { x: number; row: number; facing: Direction; hopAnimMs: number }

// Además, en el closure: lanes: Lane[], bays: boolean[5], frog, bestRow (fila mínima
// alcanzada por la rana actual), timeLeft, lives, score, level, deathCause,
// deathTimerMs, hopQueue: Direction[].
```

**Reglas del juego:**

- La partida arranca con la rana en `(400, fila 13)` mirando hacia arriba, 30 s en el temporizador, 3 vidas, nivel 1, 5 bahías vacías y los carriles en sus posiciones iniciales.
- Cada flecha (o `WASD`) recién apretada encola un salto, con un máximo de 2. En estado `playing` se consume un salto por cuadro. En `dying` y en `gameover` la cola se descarta.
- Un salto hacia abajo desde la fila 13 se ignora. Un salto horizontal que deja el centro fuera de `[20, 780]` se ignora.
- Saltar hacia arriba a una fila `r` con `2 ≤ r < bestRow` suma `10` y fija `bestRow = r`. Volver a una fila ya alcanzada, o retroceder, no suma.
- Saltar desde la fila 2 hacia la fila 1:
  - Si `x` está a ≤ 24 px del centro de una bahía **vacía**, la rana entra: la `x` se ajusta al centro, la bahía queda ocupada y se suman `50 + floor(timeLeft · 2) · 10`.
  - Si cae sobre el seto, o sobre una bahía ya ocupada, muere (causa `bay`).
- Tras entrar a una bahía, aparece de inmediato una rana nueva en la salida, con 30 s y `bestRow = 13`. No se pierde una vida.
- Si con esa entrada las 5 bahías quedan ocupadas:
  - Se suman `1000` y el nivel sube en 1 (`onLevel`).
  - Las bahías se vacían y los carriles se recrean en sus posiciones iniciales con el multiplicador del nivel nuevo.
- Orden de actualización en cada cuadro de `playing`:
  1. Se aplica un salto de la cola.
  2. Se mueven todos los carriles `vx · dt` y se aplica el wrap.
  3. Avanzan los relojes de las tortugas que se sumergen.
  4. Si la rana está en una fila de río, se desplaza `vx · dt` del carril.
  5. Se evalúan las muertes.
  6. Se descuenta `dt` del temporizador.
- Wrap: con `dir > 0`, si `x ≥ W` entonces `x −= period`. Con `dir < 0`, si `x + width ≤ 0` entonces `x += period`.
- Muerte por vehículo (`vehicle`): la rana está en una fila de carretera y `[x − 14, x + 14]` se superpone con `[obj.x + 4, obj.x + width − 4]` de algún vehículo de esa fila. También cuenta si la rana salta hacia el vehículo.
- Muerte por agua (`water`): la rana está en una fila de río y su centro `x` no está dentro de `[obj.x, obj.x + width]` de ningún objeto **pisable** de esa fila. Una tortuga del grupo sumergible en fase `under` no es pisable.
- Muerte por arrastre (`edge`): la rana está en una fila de río y su centro sale de `[0, W]`.
- Muerte por tiempo (`time`): `timeLeft` llega a 0.
- Las filas 7 y 13 son seguras: ahí solo se puede morir por tiempo.
- Al morir:
  - El estado pasa a `dying` y se descuenta una vida (`onLives`).
  - La rana queda congelada en el lugar con la animación de su causa: aplastada (`vehicle`) o salpicón (`water`, `edge`, `bay`, `time` en el río; `time` en tierra se dibuja aplastada).
  - Los carriles siguen moviéndose y el temporizador se congela.
- Tras `DEATH_MS`, si quedan vidas, reaparece una rana nueva en la salida (30 s, `bestRow = 13`) y el estado vuelve a `playing`.
- Si la vida descontada era la última, se emite `onLives(0)` y luego, **en el mismo cuadro**, `onGameOver(score)`. El estado pasa a `gameover` y se dibuja la animación de muerte, pero ya no se aceptan saltos.
- En cada cuadro se evalúa como máximo una muerte (la primera que se cumpla en el orden vehicle → water → edge → time). Una vez en `dying`, no se evalúan más muertes hasta reaparecer.
- El puntaje siempre es entero. Una partida en la que la rana muere sin avanzar ni una fila termina con 0, y el modal no ofrece guardar porque la plataforma ya filtra el 0.

**Teclado (`lib/games/croac/input.ts`)**: copia de la `createInput(shouldCapture, onPress, captureKeys)` de `lib/games/snake/input.ts`. Cada `keydown` sin `repeat` llama a `onPress(code)`, y el motor traduce `ArrowUp`/`KeyW`, `ArrowDown`/`KeyS`, `ArrowLeft`/`KeyA` y `ArrowRight`/`KeyD` a saltos. `captureKeys`: las cuatro flechas, `Space` (sin acción, solo evita el scroll) y `WASD`. `preventDefault` se aplica solo mientras `!paused && state !== "gameover"`. `Space` también se cancela en `keyup`.

**Layout del canvas (800×600):**

- Fila 0: seto verde oscuro.
- Fila 1: el mismo seto, con 5 bahías de 64 px de ancho (agua oscura y un nenúfar). Una bahía ocupada dibuja una rana sentada.
- Filas 2–6: agua azul muy oscura con ondas cian sutiles, más los troncos marrones y las tortugas rojizas (las sumergibles se dibujan hundiéndose o como ondas, según la fase).
- Fila 7: franja segura violeta oscuro con bordes magenta.
- Filas 8–12: asfalto gris oscuro con líneas discontinuas amarillas entre carriles, más los vehículos con faros orientados según `dir`.
- Fila 13: vereda violeta como la del medio.
- Fila 14: barra de tiempo alineada a la derecha. Ocupa `timeLeft / 30` del ancho útil (`x` de 20 a 780, 16 px de alto, centrada en la fila) y cambia de color según los umbrales.

La rana es un cuadrado verde neón de 32×32 con ojos orientados según `facing`, y se estira durante `HOP_ANIM_MS`. El canvas **no** dibuja puntaje, nivel, vidas, `PAUSA`, `GAME OVER` ni textos.

**Contrato de eventos del motor:**

- Al crearse y en cada `restart()`, el motor emite `onScore(0)`, `onLevel(1)` y `onLives(3)`.
- `onScore`, `onLevel` y `onLives` se emiten solo cuando el valor cambia. `onLives` se emite en cada muerte, incluida la que deja `0`.
- `onGameOver(finalScore)` se emite **exactamente una vez** por partida, de inmediato, en el cuadro en que se pierde la última vida. Lo protege `if (state === "gameover") return` antes de emitir.

---

## Implementation plan

Antes de escribir código, consultar la guía de Next.js 16 en `node_modules/next/dist/docs/` (según `AGENTS.md`) y la skill `arcade-vault-game`. Si `node_modules/` no existe, instalar dependencias primero. Cada paso deja la app compilando y las pantallas existentes funcionando. Verificaciones estáticas por paso: `npm run lint` y `npx tsc --noEmit`. No se ejecuta ningún build.

1. **Constantes.** Crear `lib/games/croac/constants.ts` con todas las constantes del Data model (canvas, filas, rana, bahías, tortugas, tiempo, vidas, puntaje, velocidad por nivel). Prueba: lint y `tsc --noEmit`.
2. **Input.** Crear `lib/games/croac/input.ts` copiando `createInput` de `lib/games/snake/input.ts`, con el mismo `DEFAULT_CAPTURE_KEYS` (flechas, `Space`, `WASD`). `attach` registra `keydown`/`keyup` en `window` y `detach` los remueve. Prueba: lint y `tsc --noEmit`.
3. **Carriles.** Crear `lib/games/croac/lanes.ts` con funciones puras y sin canvas:
   - `LANE_DEFS` (la tabla del Data model).
   - `createLanes(level)`: objetos en `offset + i · spacing`, `vx` con el multiplicador y `period = count · spacing`.
   - `moveLanes(lanes, dt)` con el wrap.
   - `divePhaseOf(obj)`, que devuelve `DivePhase` a partir de `diveClock mod 5.4`.
   - `isStandable(obj)` y `speedMultiplierFor(level)`.
   - Sin estado de módulo.

   Prueba: lint y `tsc --noEmit`; además, comprobar a mano que cada fila de `LANE_DEFS` cumple `count · spacing ≥ W + width`.
4. **Reglas.** Crear `lib/games/croac/rules.ts` con funciones puras:
   - `tryHop(frog, dir)`, que devuelve la rana nueva o `null` si el salto se ignora.
   - `laneAt(lanes, row)`, `hitsVehicle(frog, lane)` y `platformUnder(frog, lane)`.
   - `isOffEdge(frog)`.
   - `bayIndexAt(x, bays)`, que devuelve el índice de la bahía vacía dentro de la tolerancia, o `null`.
   - `timeBonusFor(timeLeft)` y `deathCauseFor(frog, lanes, timeLeft)`.

   Prueba: lint y `tsc --noEmit`.
5. **Render.** Crear `lib/games/croac/render.ts` con `drawFrame(ctx, frame)`, en este orden: fondos por zona, bahías y ranas en casa, carriles (troncos, tortugas según la fase, vehículos), la rana (normal, estirada, aplastada o salpicón) y la barra de tiempo. Sin textos. Prueba: lint y `tsc --noEmit`.
6. **Motor.** Crear `lib/games/croac/engine.ts` con `createCroacGame` (`GameEngineFactory`):
   - Estado en el closure.
   - `initGame`: carriles del nivel 1, bahías vacías, rana en la salida, 30 s, 3 vidas, cola vacía, estado `playing`. Emite `onScore(0)`, `onLevel(1)` y `onLives(3)`.
   - `enqueueHop` desde `onPress` del input, con un máximo de 2.
   - `update(dt)` con el orden de reglas del Data model.
   - `killFrog(cause)`: estado `dying`, `onLives`, y `endGame()` si llega a 0.
   - `homeFrog(bayIndex)`: puntaje y nivel.
   - `respawnFrog()`.
   - `endGame()`, protegido para que se emita una sola vez.
   - Loop de `requestAnimationFrame` cancelable, con `dt` capado a `MAX_DT` y `dt = 0` en el primer cuadro.
   - `pause()`.
   - `resume()`: vacía la cola de saltos y reinicia `lastTime`.
   - `restart()`.
   - `destroy()`: idempotente, cancela el rAF y llama a `input.detach()`.

   Prueba: lint y `tsc --noEmit`.
7. **Cover.** Agregar `.cover-croac` en `app/globals.css`, en CSS puro y con los tokens existentes:
   - Fondo en tres franjas: arriba agua azul oscuro con dos troncos marrones (`linear-gradient` con `background-size`), en el medio una franja violeta con un cuadrado verde neón (la rana), y abajo asfalto con línea discontinua amarilla y un auto magenta.
   - Cinco nenúfares verdes en el borde superior.
   - `drop-shadow` magenta.

   Tiene que ser visualmente distinto de `.cover-rana` (franjas cian horizontales con un círculo verde). Prueba manual: asignar la clase de forma temporal a un elemento `.cover-bg` y revisarla en 375 px y en desktop. El elemento temporal no se commitea.
8. **Registro y migración, en este orden.**
   1. Agregar `croac: createCroacGame` en `lib/games/registry.ts`.
   2. Consultar `select id, sort_order from public.games order by 2`.
   3. Aplicar con `apply_migration` el insert del Data model (nombre `add_croac_game`).
   4. Leer la versión real asignada (`select version, name from supabase_migrations.schema_migrations order by version desc limit 1`) y guardar el mismo SQL en `supabase/migrations/<version>_add_croac_game.sql`.
   5. Verificar con `execute_sql`: 12 filas en `games`, `croac` jugable y `ranaria` con `playable = false`.

   Prueba manual: `/games` muestra 12 tarjetas y `/games/croac/play` muestra el juego.
9. **Verificación de RLS por REST.** Con `curl` y la publishable key (`apikey` + `Authorization: Bearer`):
   - Un `POST /rest/v1/scores` válido para `croac` responde `201`.
   - Se rechazan un `score` `0`, un `player_name` de 11 caracteres, un `game_id` inexistente y `game_id = 'ranaria'`.
   - Al terminar, borrar las filas de prueba con `execute_sql`.
10. **Documentación y pase final.**
    - Agregar CROAC a `GAMES.md`, con los controles y las reglas tomados de `input.ts`, `constants.ts` y `engine.ts`.
    - Recorrer los criterios de aceptación en `npm run dev`, incluidos el doble montaje de Strict Mode, la navegación de ida y vuelta y la pestaña en segundo plano.
    - Revisar la consola del navegador.
    - Correr `npm run lint` y `npx tsc --noEmit`.

---

## Acceptance criteria

**Plataforma y datos**

- [ ] `games` tiene 12 filas; `croac` tiene `title = 'CROAC'`, `cat = 'ARCADE'`, `color = 'magenta'`, `cover = 'cover-croac'`, `sort_order = 12` y `playable = true`.
- [ ] `ranaria` y los demás placeholders (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `duelo-pixel`) conservan exactamente sus valores anteriores con `playable = false`; solo `rocas`, `tetris`, `arkanoid`, `snake` y `croac` tienen `playable = true`.
- [ ] `list_migrations` muestra `add_croac_game` y `supabase/migrations/` contiene su SQL con la misma versión.
- [ ] `/games` muestra 12 tarjetas, con CROAC en último lugar y su cover distinto del de RANARIA; los filtros por categoría siguen funcionando.
- [ ] `/games/croac` muestra el título y la descripción de la base, `—` como mejor marca y `0` como partidas cuando no hay puntajes.
- [ ] `/games/croac/play` muestra un `<canvas>` de 800×600 dentro del marco CRT y no contiene los elementos `.enemy` ni `.player-ship` de la arena falsa.
- [ ] `/games/ranaria/play` sigue mostrando la arena falsa y su modal dice "ESTE JUEGO AÚN NO TIENE RANKING." sin ofrecer guardar.

**Juego**

- [ ] La partida arranca con la rana centrada en la vereda inferior, la barra de tiempo llena, 5 bahías vacías y el HUD en puntaje `0`, nivel `01` y 3 vidas.
- [ ] Cada pulsación de una flecha o de `WASD` mueve la rana exactamente una celda (40 px); mantener la tecla apretada no la hace saltar de nuevo.
- [ ] Saltar hacia abajo desde la vereda inicial o hacia afuera por un costado no mueve la rana.
- [ ] Cada fila nueva alcanzada (de la 12 a la 2) suma exactamente 10; volver a una fila ya pisada por la misma rana no suma.
- [ ] Tocar un vehículo mata a la rana, descuenta una vida en el HUD y, tras ~1 s, aparece una rana nueva en la salida con el tiempo lleno.
- [ ] En el río, la rana sobre un tronco o una tortuga se desplaza con él; saltar al agua mata a la rana.
- [ ] Quedarse sobre un tronco hasta que la rana sale del canvas la mata.
- [ ] Las tortugas sumergibles (filas 3 y 6) se hunden de forma visible y, mientras están bajo el agua, la rana que está encima muere.
- [ ] Dejar que la barra de tiempo se vacíe mata a la rana; la barra cambia a amarillo por debajo de 10 s y a magenta por debajo de 5 s.
- [ ] Entrar a una bahía vacía suma `50` más el bonus de tiempo (`10` por cada medio segundo restante), dibuja una rana en esa bahía y reaparece una rana nueva sin perder vidas.
- [ ] Saltar sobre el seto o sobre una bahía ya ocupada mata a la rana.
- [ ] Llenar las 5 bahías suma `1000`, sube el HUD a nivel `02`, vacía las bahías y los carriles se mueven visiblemente más rápido; desde el nivel 9 la velocidad ya no aumenta.
- [ ] Perder la tercera vida abre el modal "FIN DEL JUEGO" exactamente una vez, con el puntaje final correcto, y el HUD muestra `0` vidas.
- [ ] Dos partidas jugadas con las mismas pulsaciones muestran el mismo tráfico (no hay azar).
- [ ] El canvas no dibuja puntaje, nivel, vidas, `PAUSA`, `GAME OVER` ni textos.

**Ciclo de vida e input**

- [ ] Presionar flechas o `Espacio` mientras el juego corre no hace scroll de la página.
- [ ] Con el modal abierto, escribir iniciales (incluidos espacios, flechas y las letras `W`, `A`, `S`, `D`) funciona y no mueve la rana.
- [ ] El botón PAUSA y la tecla `P` congelan el juego (carriles, rana y temporizador); al reanudar no hay saltos de posición, ni saltos encolados de antes de la pausa, ni pérdida de tiempo.
- [ ] El botón FIN detiene el juego y abre el modal con el puntaje actual.
- [ ] "JUGAR DE NUEVO" deja la partida en puntaje 0, nivel 1, 3 vidas, bahías vacías, carriles en su posición y velocidad iniciales, y el juego corriendo.
- [ ] Al salir con SALIR y volver a entrar (y bajo Strict Mode en `npm run dev`), cada tecla mueve la rana una sola vez y no quedan listeners de teclado activos fuera de `/games/croac/play`.
- [ ] Volver a la pestaña tras tenerla en segundo plano no teletransporta los carriles, no arrastra a la rana fuera del canvas de golpe ni consume varios segundos del temporizador.
- [ ] En un ancho de 375 px el canvas escala sin scroll horizontal y mantiene la proporción 4:3; en emulación `pointer: coarse` aparece "REQUIERE TECLADO".

**Ranking y calidad**

- [ ] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'croac'`, el nombre en mayúsculas y el puntaje final, y el modal muestra "PUNTUACIÓN GUARDADA".
- [ ] Tras guardar, `/games/croac` y la pestaña CROAC de `/hall-of-fame` muestran ese puntaje, y `best` y `plays` se actualizan.
- [ ] ROCAS, TETRIS, ARKANOID y SNAKE se juegan igual que antes.
- [ ] Con la publishable key, un `POST /rest/v1/scores` válido para `croac` responde `201`, y se rechazan `score` `0`, `player_name` de 11 caracteres, un `game_id` inexistente y `game_id = 'ranaria'`; las filas de prueba quedan borradas.
- [ ] `rg -n 'from "(react|next)' lib/games/croac/` no devuelve resultados.
- [ ] `git diff` no muestra cambios en `lib/supabase/`, `lib/session-context.tsx`, `components/`, `resources/` ni `package.json`, y `database.types.ts` no cambió.
- [ ] `GAMES.md` lista CROAC con controles y reglas que coinciden con el motor.
- [ ] La consola del navegador no muestra errores ni warnings de React durante una partida completa.
- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.

---

## Decisions taken and discarded

**Tomadas:**

- **CROAC como entrada nueva (`croac`), no sobre RANARIA.** La galería suma juegos. A cambio, el catálogo muestra dos juegos de ranas (uno jugable y un placeholder), igual que pasó con Snake y SERPENTINA.
- **Frogger clásico y fiel.** El ángulo del brief es acción/reflejos, y Frogger es el original del tema. Las reglas conocidas (carretera, franja media, río, 5 bahías, tiempo, 3 vidas) evitan explicaciones. A cambio, el diseño no es original: su valor está en la ejecución.
- **Grilla 20×15 de 40 px.** Divide exactamente el canvas 800×600, como en Snake. Las 15 filas alcanzan para seto, meta, 5 carriles de río, franja media, 5 de carretera, salida y la barra de tiempo, sin bordes sobrantes.
- **`x` continua y fila entera.** Es la única forma de que el río arrastre a la rana con suavidad. A cambio, la rana queda desalineada de la grilla después de pasar por el río, y eso se compensa con la tolerancia de ±24 px de las bahías.
- **Bahías en `80, 240, 400, 560, 720`.** Están a 160 px entre sí, alineadas con la grilla desde `START_X = 400`, así que una rana que no pisó el río (o que se alineó con saltos laterales) entra justo al centro.
- **Salto lógicamente instantáneo, con animación solo visual.** Las colisiones son fáciles de razonar (la rana está en una sola fila a la vez) y el control responde en el mismo cuadro, que es lo que pide un juego de reflejos. A cambio, no hay "salto en el aire" que esquive un auto.
- **Un salto por pulsación, sin auto-repeat, con una cola de 2.** Cada salto es una decisión, como en el arcade. La cola de 2 conserva un doble toque rápido sin acumular teclas viejas. Mantener la tecla apretada no hace nada, y eso puede sorprender al principio.
- **Hitbox de vehículos recortada 4 px y plataformas medidas desde el centro de la rana.** Los dos criterios favorecen a quien juega: un roce visual con un auto no mata y medio cuerpo sobre un tronco alcanza. Es la sensación "justa" que se espera de un Frogger.
- **Tortugas que se sumergen en un ciclo fijo de 5,4 s con 0,6 s de aviso.** El aviso visible (`sinking`) convierte la trampa en un desafío de lectura y no en una lotería. Solo un grupo por fila de tortugas se sumerge, así que siempre existe una ruta.
- **Carriles con período ≥ `W + width`.** Evita que los objetos aparezcan o desaparezcan dentro de la pantalla y deja el wrap como una suma o resta del período.
- **Juego determinista, sin `Math.random`.** El ranking es más justo y no hace falta un RNG con semilla. A cambio, quien practica puede memorizar los patrones, lo cual es fiel al original.
- **Velocidad +12 % por nivel con techo en el nivel 9 (×1,96).** Sube la presión sin volver imposible el tráfico, porque a ×2 el auto deportivo cruza el canvas en ~3,6 s. El número de nivel sigue subiendo para que el HUD siga informando.
- **El temporizador se reinicia con cada rana (30 s).** Es el modelo del arcade. 30 s permiten un cruce prudente, y el bonus de 10 por medio segundo premia a quien va rápido.
- **Puntaje: 10 por fila nueva, 50 por bahía, bonus de tiempo y 1000 por nivel.** Son los valores del Frogger original y siempre dan enteros. Una partida buena de 5 niveles ronda los 20.000 puntos, muy lejos del techo de 99.999.999.
- **Tres vidas con `onLives`.** `onLives` ya existe y el HUD muestra vidas. `onLives(0)` se emite antes de `onGameOver` para que el HUD no quede mostrando 1.
- **Barra de tiempo dibujada en el canvas, sin texto.** Es un indicador del juego (como el timer de power-up de ROCAS), no HUD de plataforma. La fila 14 se reserva para ella, así que no tapa el juego.
- **Animación de muerte de 1 s con el tráfico en movimiento.** Se lee qué pasó y el mundo no se congela. El `onGameOver` de la última vida se emite en el momento, sin esperar la animación, como exige el contrato.
- **Al subir de nivel, los carriles se recrean en las posiciones iniciales.** Así cada nivel arranca con un patrón conocido. Mantener las posiciones con otro multiplicador generaba saltos visuales de velocidad a mitad de un cruce.
- **Todo dibujado con canvas, sin assets.** No hay licencias que revisar, ni carga asíncrona, ni respaldo que mantener. Es coherente con ROCAS y TETRIS.
- **`WASD` además de flechas.** Igual que en Snake. El modal sigue aceptando esas letras porque `preventDefault` solo se aplica con el juego corriendo.
- **Copia propia de `input.ts`.** Promoverlo a un módulo compartido refactorizaría juegos ya implementados, y eso queda fuera de esta spec.
- **Separar `lanes.ts` (mundo que se mueve) de `rules.ts` (rana y colisiones).** Son funciones puras sin canvas, fáciles de revisar a mano, y el motor queda como orquestador.
- **Versión de la migración tomada de Supabase** y **registro antes que migración**, por las mismas razones de las SPEC 07 a 09.
- **Cover en CSS puro** con los tokens existentes.
- **`sort_order = 12`**, el que sugiere el brief y el siguiente libre después de `snake = 11`.

**Descartadas:**

- **Activar `ranaria`:** es el atajo más barato, pero reemplaza una entrada existente y viola la regla de galería.
- **Mosca bonus, rana dama, cocodrilos, serpiente en la franja media y nutrias:** son fieles al arcade, pero cada uno agrega estado, colisiones y reglas de puntaje. Duplican el esfuerzo de un primer Frogger. Quedan para una spec de "CROAC deluxe".
- **Vida extra por puntaje:** cambia el ritmo de las partidas largas y abre la pregunta del tope de vidas. Se puede sumar después sin tocar la plataforma.
- **Salto con auto-repeat al mantener la tecla:** hace que la rana "corra" sin control hacia los autos y va contra el ángulo de reflejos (una decisión por salto).
- **Salto con duración física (la rana en el aire durante ~100 ms):** obliga a decidir en qué fila está durante el vuelo y complica las colisiones sin mejorar la sensación.
- **Grilla horizontal estricta (volver a alinear la `x` al bajar del río):** produce un "teletransporte" lateral de hasta 20 px que se siente como un bug.
- **Diseños de carriles distintos por nivel:** multiplica el balanceo manual. Por ahora, la velocidad alcanza como progresión.
- **Pantalla de "nivel completado" o de victoria:** necesitaría pausar el juego y dibujar texto, y la plataforma ya muestra el nivel. Un modal de victoria sería un cambio de `GameCallbacks`.
- **Mostrar el tiempo en el HUD de la plataforma:** exigiría un callback nuevo (`onTime`) y cambiar `GamePlayer`. Según las reglas del jam, se simplifica con una barra dentro del canvas.
- **Controles táctiles (botones en pantalla o swipe):** son un cambio de plataforma. Se mantiene el aviso "REQUIERE TECLADO".
- **Mouse para saltar (clic en la dirección):** no aporta a un juego de reflejos con cuatro direcciones y duplica el input.
- **Sprites PNG de rana y vehículos:** habría que revisar licencias y agregar carga asíncrona y respaldo. Las primitivas de canvas alcanzan para la estética neón.
- **Tráfico aleatorio (huecos sorteados):** el ranking sería menos justo y no se podría reproducir un bug.
- **Iframe a una página suelta o un script en un `useEffect`:** mismas razones que en las SPEC 05 a 09.

---

## Identified risks

| Riesgo | Mitigación |
| --- | --- |
| `croac` queda `playable = true` sin motor en el registro (o al revés): el ranking acepta puntajes de la arena falsa, o el modal ofrece guardar y RLS lo rechaza | El paso 8 fija el orden (registro primero, migración después). Hay criterios de aceptación sobre las dos condiciones. |
| `sort_order = 12` ya está ocupado (por ejemplo, porque otro ganador del jam se aplicó antes) y la migración falla por unicidad | El paso 8 consulta los `sort_order` antes de aplicar y ajusta el valor y los criterios si hace falta. |
| La rana que vuelve del río queda desalineada y no puede entrar a ninguna bahía | Tolerancia de ±24 px. Desde cualquier `x`, un salto lateral de 40 px siempre deja la rana a ≤ 20 px de una posición alineada. Hay un criterio de aceptación sobre la entrada a las bahías. |
| Las tortugas se sumergen justo cuando la rana salta encima y la muerte se siente injusta | Fase `sinking` visible de 0,6 s, en la que todavía son pisables. Solo un grupo por fila se sumerge. Hay un criterio sobre el aviso visible. |
| Alguna fila del río queda sin una ruta posible (huecos demasiado grandes respecto de las filas vecinas) en algún nivel | Las velocidades relativas entre carriles no cambian con el nivel (el multiplicador es común), así que si el nivel 1 es cruzable, todos lo son. Se prueba a mano en el pase final llegando a cada bahía. |
| Un objeto aparece o desaparece a la vista al hacer el wrap | Invariante `count · spacing ≥ W + width`, verificado a mano en el paso 3 para cada fila de `LANE_DEFS`. |
| Errores de punto flotante al arrastrar la rana durante mucho tiempo (la `x` acumula decimales) | Las colisiones usan rangos con desigualdades, no igualdades. Al entrar a una bahía, la `x` se ajusta al centro. Al reaparecer, vuelve a `400` exacto. |
| En el mismo cuadro la rana muere por dos causas (por ejemplo, agua y tiempo), o pierde la última vida dos veces, y se emiten `onLives` u `onGameOver` duplicados | Se evalúa una sola muerte por cuadro y solo en estado `playing`. `endGame()` sale si el estado ya es `gameover`. Hay un criterio de "exactamente una vez". |
| Entrar a la última bahía y morir en el mismo cuadro | El salto se aplica primero: si entra a la bahía, la rana reaparece en la salida (segura) antes de evaluar muertes. |
| Al volver de otra pestaña, un `dt` enorme mueve los carriles cientos de píxeles, arrastra a la rana fuera del canvas y vacía el temporizador | `dt` capado a `MAX_DT = 0.05`. `startLoop()` reinicia `lastTime`. Hay un criterio de aceptación explícito. |
| React Strict Mode monta, desmonta y vuelve a montar el efecto, y deja dos loops o listeners duplicados (cada tecla hace saltar dos celdas) | `destroy()` cancela el rAF, llama a `input.detach()` y es idempotente. `GameCanvas` lo invoca en el cleanup. Hay un criterio explícito. |
| Saltos encolados antes de pausar o durante la animación de muerte se disparan al reanudar o al reaparecer | `resume()`, `respawnFrog()` y el estado `dying` vacían la cola. Hay un criterio de aceptación. |
| Las letras `W`, `A`, `S`, `D` no se pueden escribir en el modal de guardado | `preventDefault` solo mientras `!paused && state !== "gameover"`. Hay un criterio explícito. |
| Una partida termina en 0 (la rana muere sin avanzar) y el modal falla | La plataforma ya no ofrece guardar con puntaje 0 (`CHECK` 1..99.999.999). Es un comportamiento esperado, no un error. |
| El puntaje se calcula en el cliente y se puede falsificar | Mismo riesgo aceptado en la SPEC 06: la base solo valida la forma. El determinismo, al menos, permite reproducir partidas a mano si hiciera falta. |
| Dos juegos de ranas en el catálogo (CROAC y RANARIA) confunden a quien juega | Aceptado por la regla de galería. El cover y la descripción de CROAC son distintos, y RANARIA sigue marcada como no jugable. |
| La versión de la migración se ordena antes que las existentes si se toma de la hora local | La versión se lee de `supabase_migrations.schema_migrations` después de aplicar. |
| Canvas borroso en pantallas grandes o retina | Aceptado como límite conocido: HiDPI queda fuera de alcance. |

---

## What is **not** in this spec

- Cambios a RANARIA ni a ningún otro juego del catálogo.
- Motores de los demás placeholders.
- Sonido, música o control de mute.
- Sprites o assets binarios de cualquier tipo.
- Mosca bonus, rana dama, cocodrilos, serpientes, nutrias, vida extra y diseños de carriles por nivel.
- Pantallas de nivel completado o de victoria, y cualquier cambio en `GamePlayer`, `GameCanvas` o `GameCallbacks` (incluido un callback de tiempo).
- Controles táctiles, mouse o gamepad.
- Cambios de esquema, tablas nuevas, validación del puntaje en el servidor o regenerar `database.types.ts`.
- Mover `createInput` a un módulo compartido.
- HiDPI, canvas con otra proporción o pantalla completa.
- Tests automatizados de cualquier tipo.

Cada uno de estos, si se necesita, va en su propia spec.
