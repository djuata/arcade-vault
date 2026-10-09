# SPEC 15 — FROGGER

> **Status:** Implemented
> **Depends on:** SPEC 06 (games-table-and-leaderboard), SPEC 10 (croac-game), SPEC 12 (touch-controls), SPEC 13 (remove-placeholder-games)
> **Date:** 2026-10-09
> **Objective:** Agregar FROGGER como juego nuevo de la galería (entrada propia en `games`, motor TypeScript escrito desde cero): el Frogger de arcade **completo**, con todo lo que CROAC dejó afuera (mosca bonus, cocodrilos en el río y en las bahías, rana dama, serpiente en la franja media y vida extra), con su ranking en Supabase.
> **Origen:** reescritura de `specs/game-jam/frogger/01-frogger-core.md` (estado `Propuesto`, que pedía un componente React y repetía CROAC) al contrato de motores de la plataforma.

---

## Por qué existe esta spec

Arcade Vault es una galería que crece: cada juego nuevo **suma** una entrada. CROAC (SPEC 10) ya es un Frogger clásico y fiel, pero recortado a propósito: su sección de Descartadas deja la mosca bonus, la rana dama, los cocodrilos y la serpiente "para una spec de CROAC deluxe". FROGGER es ese juego, pero como **entrada aparte**: CROAC sigue siendo el cruce limpio de reflejos y FROGGER es el arcade completo, donde cada nivel suma una amenaza y cada cruce ofrece una recompensa opcional que cuesta riesgo.

El spec de origen no se podía implementar tal cual:

- Pedía `components/games/FroggerGame.tsx` con el game loop en React, un canvas de 480×640, props propias y una play-page `app/games/frogger/play/page.tsx`. La plataforma monta motores puros de `lib/games/<slug>/` con `GameEngine`/`GameCallbacks` en un canvas de 800×600 desde la ruta genérica `/games/[id]/play`.
- Pedía `color = 'lime'`, que el `CHECK` de `games.color` rechaza.
- Guardaba el nombre en `localStorage` (`av_player_name`), algo que ya resuelve el modal de `GamePlayer` con la sesión mock.
- Sin agregados, era CROAC con otro nombre: dos tarjetas del mismo juego.

Seis puntos de esta spec no son obvios:

- **Reutiliza el diseño de CROAC, no su código.** La grilla, las filas, el salto instantáneo, la `x` continua en el río, la tolerancia de las bahías, el temporizador y el contrato de eventos son los de la SPEC 10, porque ya están probados. Pero el motor vive en `lib/games/frogger/` y **no importa nada de `lib/games/croac/`**: promover piezas a un módulo compartido sería refactorizar un juego implementado, y eso queda fuera.
- **La dificultad sube por amenazas, no solo por velocidad.** En el nivel 1 están la mosca y la rana dama (recompensas). En el nivel 2 entran los cocodrilos (río y bahías). En el nivel 3, la serpiente en la franja media. Desde ahí sube solo la velocidad, con el mismo techo que CROAC.
- **Sigue siendo determinista.** La mosca, el cocodrilo de bahía y la rana dama aparecen con relojes y rotaciones fijas, no con `Math.random`. Dos partidas con las mismas teclas en los mismos momentos dan el mismo resultado.
- **La franja media deja de ser segura desde el nivel 3.** En CROAC (y en los niveles 1–2 acá) la fila 7 solo mata por tiempo. La serpiente cambia eso, y es el cambio de regla más grande respecto de CROAC.
- **Primera vida extra de la galería.** A los 10.000 puntos se suma una vida, una sola vez por partida. El HUD ya dibuja un `♥` por vida, así que una cuarta vida no requiere cambios en `GamePlayer`.
- **El nombre es una marca registrada.** CROAC evitó "Frogger" a propósito. Acá se eligió `frogger`/`FROGGER` de forma explícita; el riesgo queda documentado.

---

## Scope

**In:**

- Migración de datos `supabase/migrations/<version>_add_frogger_game.sql`, que inserta la fila `frogger` en `games` con `playable = true`. Sin cambios de esquema ni de `lib/supabase/database.types.ts`.
- `lib/games/frogger/`, en TypeScript puro y sin React, con `constants.ts`, `input.ts`, `lanes.ts`, `hazards.ts`, `rules.ts`, `render.ts` y `engine.ts` (`createFroggerGame`).
- Registro en `lib/games/registry.ts`: `frogger: createFroggerGame`.
- Layout táctil `lib/games/frogger/touch.ts` (`FROGGER_TOUCH_CONTROLS`), registrado en `GAME_TOUCH_CONTROLS`: D-pad `↑` `↓` `←` `→` sin diagonales, sin autorrepetición y sin botones de acción.
- `app/globals.css`: clase de cover `.cover-frogger` en CSS puro, visualmente distinta de las demás portadas (en especial de `.cover-croac`).
- `GAMES.md`: fila en la tabla resumen y sección del juego (controles, amenazas por nivel y reglas tomados del código).
- `GAMES-TODO.md`: FROGGER pasa de *Aceptados* a *Implementados* al cerrar.
- Verificación de RLS contra la API REST con la publishable key, y limpieza de las filas de prueba.

**Out of scope (para specs futuras):**

- Cualquier cambio a otro juego del catálogo, **incluido CROAC**.
- Módulo compartido entre CROAC y FROGGER (`lanes`, `rules`, `input`).
- Nutrias en el río, serpiente sobre los troncos, tortugas que se sumergen en más filas, diseños de carriles distintos por nivel.
- Más de una vida extra, o vida extra cada N puntos.
- Sonido, música y control de mute.
- Sprites o imágenes: todo se dibuja con primitivas de canvas.
- Pantallas de nivel completado o de victoria, animación de "rana en casa" con pausa.
- Texto dentro del canvas (ni puntaje, ni nivel, ni vidas, ni `PAUSA`, ni los puntos ganados).
- Cambios en `GamePlayer`, `GameCanvas`, `GameCallbacks` o `TouchControls`.
- Skins (las propone `skin-designer` en su propia spec) y ajustes de mobile más allá del criterio de 375 px (los propone `mobile-porter`).
- Control con mouse, gamepad o swipe sobre el canvas.
- HiDPI, pantalla completa y canvas con proporción distinta de 4:3.
- Cambios de esquema, validación del puntaje en el servidor o regenerar `database.types.ts`.
- Tests automatizados: el proyecto sigue sin test runner.

---

## Data model

**Fila nueva en `public.games`** (la inserta la migración; el resto de columnas toma sus valores por defecto):

```sql
insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order) values
('frogger', 'FROGGER',
 'El Frogger de arcade completo: moscas, cocodrilos y serpientes.',
 'Cruza la carretera y el río con las flechas o con WASD y llena los cinco nenúfares antes de que se acabe el tiempo. Atrapa la mosca y rescata a la rana dama para sumar puntos extra, pero cuidado: desde el nivel 2 hay cocodrilos en el río y en las bahías, y desde el nivel 3 una serpiente patrulla la franja del medio. Tienes tres vidas y una más a los 10.000 puntos.',
 'ARCADE', 'cover-frogger', 'green', true, 13);
```

Estado esperado antes de la migración: 5 juegos jugables, `rocas` (6), `tetris` (9), `arkanoid` (10), `snake` (11) y `croac` (12). Después: 6 juegos, con `frogger` también jugable. `sort_order = 13` se confirmó libre el 2026-10-09 y se vuelve a consultar antes de aplicar, porque la columna es única.

**Constantes del motor (`lib/games/frogger/constants.ts`)**. Las marcadas con *(= CROAC)* tienen el mismo valor que en la SPEC 10, pero se declaran de nuevo en este archivo:

- Canvas: `W = 800`, `H = 600`, `MAX_DT = 0.05` s *(= CROAC)*.
- Grilla y filas *(= CROAC)*: `CELL = 40`, `COLS = 20`, `ROWS = 15`; `HEDGE_ROW = 0`, `GOAL_ROW = 1`, `RIVER_ROWS = 2..6`, `MEDIAN_ROW = 7`, `ROAD_ROWS = 8..12`, `START_ROW = 13`, `TIMER_ROW = 14`.
- Rana *(= CROAC)*: `START_X = 400`, `HOP = 40`, `FROG_HALF_W = 14`, `FROG_MIN_X = 20`, `FROG_MAX_X = 780`, `HOP_ANIM_MS = 90`, `MAX_QUEUED_HOPS = 2`.
- Bahías *(= CROAC)*: `BAY_CENTERS = [80, 240, 400, 560, 720]`, `BAY_WIDTH = 64`, `BAY_TOLERANCE = 24`.
- Vehículos: `VEHICLE_INSET = 4` *(= CROAC)*.
- Tortugas que se sumergen *(= CROAC)*: `DIVE_CYCLE_S = 5.4` = `DIVE_SURFACED_S 3.0` + `DIVE_SINKING_S 0.6` + `DIVE_UNDER_S 1.2` (no pisable) + `DIVE_RISING_S 0.6`.
- Tiempo *(= CROAC)*: `TIME_PER_FROG = 30`, `TIME_WARN_S = 10`, `TIME_DANGER_S = 5`.
- Vidas: `LIVES = 3`, `MAX_LIVES = 4`, `EXTRA_LIFE_AT = 10000`.
- Muerte: `DEATH_MS = 1000` *(= CROAC)*.
- Puntaje: `STEP_POINTS = 10`, `HOME_POINTS = 50`, `TIME_BONUS_PER_HALF_S = 10` (máx. 600) y `LEVEL_CLEAR_POINTS = 1000` *(= CROAC)*; además `FLY_POINTS = 200` y `LADY_POINTS = 200`.
- Velocidad por nivel *(= CROAC)*: `speedMultiplierFor(level) = 1 + 0.12 · (min(level, 9) − 1)`.
- Amenazas por nivel: `CROC_FROM_LEVEL = 2`, `SNAKE_FROM_LEVEL = 3`.
- Mosca: `FLY_CYCLE_S = 9` = `FLY_HIDDEN_S 5` + `FLY_VISIBLE_S 4`; rotación de bahías `FLY_BAY_ORDER = [2, 0, 3, 1, 4]`.
- Cocodrilo de bahía: `BAY_CROC_CYCLE_S = 12` = `BAY_CROC_HIDDEN_S 7` + `BAY_CROC_PEEK_S 2` (asoma los ojos, **se puede** entrar) + `BAY_CROC_JAWS_S 3` (boca abierta, entrar mata); rotación `BAY_CROC_ORDER = [0, 2, 4, 1, 3]`.
- Cocodrilo de río: en la fila 2, objeto `0`, desde el nivel 2. `CROC_HEAD_W = 40` (la cabeza va adelante, en el sentido de avance); `CROC_JAW_ANIM_S = 1.2` (abrir/cerrar la boca, solo visual).
- Rana dama: en la fila 5, objeto `1`. `LADY_CYCLE_S = 16` = `LADY_ABSENT_S 10` + `LADY_PRESENT_S 6`; `LADY_PICKUP_TOLERANCE = 20`.
- Serpiente: `SNAKE_W = 80`, `SNAKE_SPEED = 60` px/s (por el multiplicador), `SNAKE_INSET = 6`, arranca en `x = 0` hacia la derecha y rebota en `[0, W − SNAKE_W]`.

**Carriles (`LANE_DEFS` en `lanes.ts`)**, con velocidades base en px/s. Cada carril tiene `count` objetos separados `spacing` px y el período `count · spacing` siempre es ≥ `W + width`. Los valores difieren a propósito de CROAC para que el tráfico no sea el mismo:

| Fila | Tipo | Dibujo | `width` | `dir` | `speed` | `count` | `spacing` | `offset` | Extra |
| ---- | ---- | ------ | ------- | ----- | ------- | ------- | --------- | -------- | ----- |
| 12 | road | auto amarillo | 48 | −1 | 65 | 4 | 240 | 0 | — |
| 11 | road | excavadora verde | 48 | +1 | 50 | 3 | 320 | 120 | — |
| 10 | road | auto deportivo magenta | 48 | −1 | 95 | 4 | 230 | 60 | — |
| 9 | road | auto blanco | 48 | +1 | 75 | 3 | 300 | 200 | — |
| 8 | road | camión cian | 112 | −1 | 55 | 3 | 340 | 100 | — |
| 6 | river | 3 tortugas | 120 | −1 | 50 | 4 | 260 | 0 | sumergible: objeto `1`, fase inicial 0 s |
| 5 | river | tronco corto | 120 | +1 | 45 | 3 | 330 | 80 | rana dama en objeto `1` |
| 4 | river | tronco largo | 240 | +1 | 80 | 2 | 520 | 0 | — |
| 3 | river | 2 tortugas | 80 | −1 | 65 | 4 | 240 | 120 | sumergible: objeto `2`, fase inicial 2,7 s |
| 2 | river | tronco medio | 160 | +1 | 60 | 3 | 340 | 40 | objeto `0` es cocodrilo desde el nivel 2 |

Períodos (≥ `W + width`): 960/848, 960/848, 920/848, 900/848, 1020/912, 1040/920, 990/920, 1040/1040, 960/880, 1020/960.

**Estado del motor (en el closure de `createFroggerGame`):**

```ts
type Direction = "up" | "down" | "left" | "right";
type GameState = "playing" | "dying" | "gameover"; // más un flag interno `paused`
type LaneKind = "road" | "river";
type LaneSprite = "car" | "digger" | "racer" | "sedan" | "truck" | "turtles" | "log" | "croc";
type DeathCause = "vehicle" | "snake" | "croc" | "water" | "edge" | "time" | "bay";
type DivePhase = "surfaced" | "sinking" | "under" | "rising";
type BayCrocPhase = "hidden" | "peek" | "jaws";

interface LaneDef {
  row: number; kind: LaneKind; sprite: LaneSprite;
  width: number; dir: 1 | -1; speed: number;
  count: number; spacing: number; offset: number;
  divingIndex?: number; diveStartS?: number;
  ladyIndex?: number; crocIndex?: number;
}
interface LaneObject { x: number; diving: boolean; diveClock: number; croc: boolean }
interface Lane { def: LaneDef; vx: number; period: number; objects: LaneObject[] }
interface Frog { x: number; row: number; facing: Direction; hopAnimMs: number }
interface Hazards {
  flyClock: number; flyBay: number | null;          // bahía con mosca visible, o null
  bayCrocClock: number; bayCrocBay: number | null;  // bahía con cocodrilo, o null
  ladyClock: number; ladyOnLog: boolean; ladyEscorted: boolean;
  snake: { x: number; dir: 1 | -1 } | null;          // null antes del nivel 3
  flyTurn: number; bayCrocTurn: number;              // posición en cada rotación
}

// Además, en el closure: lanes, bays: boolean[5], frog, bestRow, timeLeft, lives,
// extraLifeGiven, score, level, hazards, deathCause, deathTimerMs, hopQueue.
```

**Reglas base** (idénticas a la SPEC 10, se repiten para que esta spec se lea sola):

- La partida arranca con la rana en `(400, fila 13)` mirando hacia arriba, 30 s, 3 vidas, nivel 1, 5 bahías vacías, carriles en sus posiciones iniciales y amenazas en su estado inicial.
- Cada flecha o `WASD` recién apretada encola un salto (máx. 2). En `playing` se consume uno por cuadro; en `dying` y `gameover` la cola se descarta.
- Un salto hacia abajo desde la fila 13 se ignora. Un salto horizontal que deja el centro fuera de `[20, 780]` se ignora.
- Saltar hacia arriba a una fila `r` con `2 ≤ r < bestRow` suma `10` y fija `bestRow = r`.
- Tras entrar a una bahía aparece una rana nueva en la salida (30 s, `bestRow = 13`), sin perder una vida.
- Al llenar las 5 bahías se suman `1000`, el nivel sube en 1 (`onLevel`), las bahías se vacían, los carriles se recrean con el multiplicador nuevo y las amenazas vuelven a su estado inicial **para ese nivel** (cocodrilos si `level ≥ 2`, serpiente si `level ≥ 3`).
- Wrap, muerte por vehículo, por agua, por arrastre y por tiempo: como en la SPEC 10. Las tortugas sumergibles en fase `under` no son pisables.
- Al morir: estado `dying`, se descuenta una vida (`onLives`), la rana queda congelada con su animación, los carriles y la serpiente siguen moviéndose, el temporizador y los relojes de mosca, cocodrilo de bahía y rana dama se congelan. Tras `DEATH_MS` reaparece si quedan vidas. Si era la última, `onLives(0)` y en el mismo cuadro `onGameOver(score)`.
- Una sola muerte evaluada por cuadro y solo en `playing`.

**Reglas nuevas (lo que CROAC no tiene):**

- **Mosca (desde el nivel 1).** `flyClock` avanza con `dt`. Al comenzar cada ciclo de 9 s se elige la bahía: la siguiente de `FLY_BAY_ORDER` (avanzando `flyTurn`) que esté vacía y no tenga cocodrilo; si ninguna sirve, ese ciclo no hay mosca. La mosca está visible durante los últimos 4 s del ciclo. Entrar a una bahía con mosca visible suma `FLY_POINTS = 200` además de lo normal, y la mosca desaparece.
- **Cocodrilo de bahía (desde el nivel 2).** Ciclo de 12 s. Al comenzar cada ciclo se elige la siguiente bahía de `BAY_CROC_ORDER` que esté vacía y no tenga mosca visible; si ninguna sirve, no hay cocodrilo ese ciclo. Fases: `hidden` 7 s, `peek` 2 s (se ven los ojos; entrar es seguro y **ahuyenta** al cocodrilo hasta el próximo ciclo), `jaws` 3 s (boca abierta; entrar mata con causa `croc`).
- **Cocodrilo de río (desde el nivel 2).** El objeto `0` de la fila 2 se dibuja como cocodrilo en lugar de tronco. Su cuerpo `[x, x + 120]` es pisable; su cabeza `[x + 120, x + 160]` (adelante, porque avanza a la derecha) mata con causa `croc` si el centro de la rana queda dentro. Abre y cierra la boca cada 1,2 s, solo como animación.
- **Rana dama (desde el nivel 1).** Mientras no esté escoltada, `ladyClock` avanza: 10 s ausente, 6 s presente sentada en el centro del objeto `1` de la fila 5 (`x + 60`). Si la rana está en la fila 5 y `|frog.x − ladyX| ≤ 20` mientras la dama está presente, la recoge (`ladyEscorted = true`) y la dama viaja sobre la rana. Entrar a una bahía escoltándola suma `LADY_POINTS = 200`. Si la rana muere, la dama se pierde. Cuando termina la escolta (bahía o muerte), `ladyClock` vuelve a 0.
- **Serpiente (desde el nivel 3).** Recorre la fila 7 a `60 · multiplicador` px/s y rebota en `[0, 720]`. Si la rana está en la fila 7 y `[x − 14, x + 14]` se superpone con `[snake.x + 6, snake.x + 74]`, muere con causa `snake`.
- **Vida extra.** La primera vez que `score ≥ 10000`, si `lives < MAX_LIVES`, se suma 1 vida y se emite `onLives`. Solo una vez por partida (`extraLifeGiven`).
- **Entrada a la fila 1**, en este orden: si cae sobre el seto o en una bahía ocupada → muere (`bay`); si la bahía tiene cocodrilo en `jaws` → muere (`croc`); si no, entra (y suma mosca y dama si corresponde).
- **Orden de actualización** en cada cuadro de `playing`:
  1. Se aplica un salto de la cola (y la recogida de la dama, si cae en la fila 5).
  2. Se mueven los carriles con wrap y avanzan los relojes de las tortugas.
  3. Se mueve la serpiente.
  4. Avanzan los relojes de mosca, cocodrilo de bahía y rana dama.
  5. Si la rana está en el río, se desplaza `vx · dt`.
  6. Se evalúan las muertes en el orden `vehicle → snake → croc → water → edge → time`.
  7. Se descuenta `dt` del temporizador.
  8. Se revisa la vida extra.

**Teclado (`lib/games/frogger/input.ts`)**: copia de la `createInput(shouldCapture, onPress, captureKeys)` de `lib/games/croac/input.ts`. Flechas y `WASD` saltan; `Space` solo evita el scroll. `preventDefault` solo mientras `!paused && state !== "gameover"`.

**Layout del canvas (800×600)**, con paleta distinta de CROAC:

- Filas 0–1: seto verde con 5 bahías (agua oscura + nenúfar). Una bahía ocupada dibuja una rana sentada; una con mosca visible dibuja un punto amarillo con alas; una con cocodrilo dibuja dos ojos (`peek`) o una mandíbula abierta verde oscuro (`jaws`).
- Filas 2–6: agua azul oscura, troncos marrones, tortugas rojizas, el cocodrilo verde con cabeza dentada y la rana dama rosa sobre su tronco.
- Fila 7: césped verde oscuro con bordes verde neón (la serpiente se dibuja como un zigzag amarillo-verde).
- Filas 8–12: asfalto gris con líneas discontinuas blancas, más los vehículos con faros según `dir`.
- Fila 13: césped como la fila 7.
- Fila 14: barra de tiempo alineada a la derecha, verde / amarilla / magenta según los umbrales.

La rana es un cuadrado verde lima de 32×32 con ojos según `facing`; escoltando a la dama, lleva encima un cuadrado rosa de 16×16. Sin textos.

**Contrato de eventos del motor** *(= CROAC)*:

- Al crearse y en cada `restart()`, el motor emite `onScore(0)`, `onLevel(1)` y `onLives(3)`.
- `onScore`, `onLevel` y `onLives` solo se emiten cuando el valor cambia. `onLives` se emite en cada muerte y en la vida extra.
- `onGameOver(finalScore)` se emite **exactamente una vez** por partida, en el cuadro en que se pierde la última vida.

---

## Implementation plan

Antes de escribir código, consultar la guía de Next.js 16 en `node_modules/next/dist/docs/` (según `AGENTS.md`) y la skill `arcade-vault-game`. Cada paso deja la app compilando. Verificaciones estáticas por paso: `npm run lint` y `npx tsc --noEmit`. No se ejecuta ningún build.

1. **Constantes.** Crear `lib/games/frogger/constants.ts` con todas las constantes del Data model. Prueba: lint y `tsc --noEmit`.
2. **Input.** Crear `lib/games/frogger/input.ts` copiando `createInput` de `lib/games/croac/input.ts`. Prueba: lint y `tsc --noEmit`.
3. **Carriles.** Crear `lib/games/frogger/lanes.ts` con funciones puras: `LANE_DEFS`, `createLanes(level)` (marca `croc = true` en el objeto `crocIndex` solo si `level ≥ CROC_FROM_LEVEL`), `moveLanes`, `divePhaseOf`, `isStandable`, `crocHeadRange(obj, lane)` y `speedMultiplierFor`. Prueba: lint, `tsc --noEmit` y comprobación manual de los períodos de la tabla.
4. **Amenazas.** Crear `lib/games/frogger/hazards.ts` con funciones puras y sin canvas: `createHazards(level)`, `stepFly`, `stepBayCroc`, `bayCrocPhaseOf`, `stepLady`, `ladyPosition(hazards, lanes)`, `moveSnake` y `snakeHits(frog, snake)`. Las rotaciones saltan bahías ocupadas o tomadas por la otra amenaza. Prueba: lint y `tsc --noEmit`.
5. **Reglas.** Crear `lib/games/frogger/rules.ts`: `tryHop`, `laneAt`, `hitsVehicle`, `platformUnder` (excluye la cabeza del cocodrilo), `hitsCrocHead`, `isOffEdge`, `bayEntryFor(x, bays, hazards)` (devuelve `{ kind: "home", index, fly }` o `{ kind: "death", cause }`, donde `cause` es `bay` o `croc`), `timeBonusFor` y `deathCauseFor(frog, lanes, hazards, timeLeft)`. Prueba: lint y `tsc --noEmit`.
6. **Render.** Crear `lib/games/frogger/render.ts` con `drawFrame(ctx, frame)`: fondos, bahías (ranas, mosca, cocodrilo), carriles (troncos, tortugas, cocodrilo con boca animada), rana dama, serpiente, rana (con o sin dama, normal, estirada, aplastada o salpicón) y barra de tiempo. Sin textos. Prueba: lint y `tsc --noEmit`.
7. **Motor.** Crear `lib/games/frogger/engine.ts` con `createFroggerGame` (`GameEngineFactory`): estado en el closure, `initGame`, `enqueueHop`, `update(dt)` con el orden del Data model, `killFrog(cause)` (pierde la escolta), `homeFrog(index, fly, lady)`, `levelUp()` (recrea carriles y amenazas del nivel), `respawnFrog()`, `checkExtraLife()`, `endGame()` protegido, loop de rAF con `dt` capado, `pause`, `resume` (vacía la cola y reinicia `lastTime`), `restart` y `destroy` idempotente. Prueba: lint y `tsc --noEmit`.
8. **Cover.** Agregar `.cover-frogger` en `app/globals.css` en CSS puro: río oscuro con la silueta de un cocodrilo verde (mandíbula en V), un nenúfar con una mosca amarilla y una rana verde lima en primer plano; `drop-shadow` verde. Distinto de `.cover-croac` (franjas río/vereda/asfalto, sombra magenta) y de las demás portadas. Prueba manual en 375 px y en desktop, sin commitear el elemento de prueba.
9. **Registro y migración, en este orden.**
   1. Crear `lib/games/frogger/touch.ts` con `FROGGER_TOUCH_CONTROLS` (mismo layout que CROAC). Registrar `frogger: createFroggerGame` en `GAME_ENGINES` y `frogger: FROGGER_TOUCH_CONTROLS` en `GAME_TOUCH_CONTROLS`.
   2. Consultar `select id, sort_order from public.games order by 2`.
   3. Aplicar con `apply_migration` el insert del Data model (nombre `add_frogger_game`).
   4. Leer la versión real asignada y guardar el mismo SQL en `supabase/migrations/<version>_add_frogger_game.sql`.
   5. Verificar con `execute_sql`: 6 filas en `games`, todas jugables, incluida `frogger`.

   Prueba manual: `/games` muestra 6 tarjetas y `/games/frogger/play` muestra el juego.
10. **Verificación de RLS por REST.** Con `curl` y la publishable key: un `POST /rest/v1/scores` válido para `frogger` responde `201`; se rechazan `score = 0`, `player_name` de 11 caracteres y un `game_id` inexistente. Borrar las filas de prueba con `execute_sql`.
11. **Documentación y pase final.**
    - Agregar FROGGER a `GAMES.md` (controles, línea **Táctil**, amenazas por nivel y reglas tomados del código).
    - Mover FROGGER a *Implementados* en `GAMES-TODO.md`.
    - Recorrer los criterios de aceptación en `npm run dev` (Strict Mode, navegación de ida y vuelta, pestaña en segundo plano) y revisar la consola.
    - Correr `npm run lint` y `npx tsc --noEmit`.

---

## Acceptance criteria

**Plataforma y datos**

- [ ] `games` tiene 6 filas; `frogger` tiene `title = 'FROGGER'`, `cat = 'ARCADE'`, `color = 'green'`, `cover = 'cover-frogger'`, `sort_order = 13` y `playable = true`.
- [ ] Los otros 5 juegos conservan exactamente sus valores; las 6 filas tienen `playable = true`.
- [ ] `list_migrations` muestra `add_frogger_game` y `supabase/migrations/` contiene su SQL con la misma versión.
- [ ] `/games` muestra 6 tarjetas, con FROGGER en último lugar; `.cover-frogger` se distingue a simple vista de `.cover-croac`.
- [ ] `/games/frogger` muestra título y descripción de la base, `—` como mejor marca y `0` partidas sin puntajes.
- [ ] `/games/frogger/play` muestra un `<canvas>` de 800×600 dentro del marco CRT.

**Juego base**

- [ ] La partida arranca con la rana centrada en la salida, la barra de tiempo llena, 5 bahías vacías y el HUD en `0`, nivel `01` y 3 vidas.
- [ ] Cada pulsación mueve la rana exactamente una celda; mantener la tecla no repite el salto.
- [ ] Cada fila nueva (12 a 2) suma 10; volver a una fila ya pisada no suma.
- [ ] Vehículos, agua, arrastre fuera del canvas, tortugas sumergidas y tiempo agotado matan a la rana como en CROAC.
- [ ] Entrar a una bahía vacía suma `50` más el bonus de tiempo; llenar las 5 suma `1000` y sube de nivel con los carriles más rápidos; desde el nivel 9 la velocidad no aumenta.
- [ ] Perder la última vida abre "FIN DEL JUEGO" exactamente una vez con el puntaje correcto y el HUD en `0` vidas.
- [ ] Dos partidas con las mismas pulsaciones muestran el mismo tráfico, las mismas moscas, cocodrilos y damas.
- [ ] El canvas no dibuja textos.

**Agregados de arcade**

- [ ] En el nivel 1 aparece la mosca en una bahía vacía durante 4 s de cada 9; entrar ahí suma 200 extra y nunca aparece en una bahía ocupada.
- [ ] En el nivel 1 aparece la rana dama sobre un tronco de la fila 5; recogerla la muestra sobre la rana; llevarla a una bahía suma 200 extra; morir la pierde.
- [ ] En el nivel 1 no hay cocodrilos ni serpiente.
- [ ] Desde el nivel 2, un tronco de la fila 2 es un cocodrilo: pararse en su cuerpo es seguro y en su cabeza mata.
- [ ] Desde el nivel 2, un cocodrilo asoma en una bahía: con los ojos visibles se puede entrar (y lo ahuyenta); con la boca abierta, entrar mata.
- [ ] Desde el nivel 3, una serpiente recorre la franja del medio y tocarla mata; en los niveles 1–2 la franja es segura.
- [ ] Al llegar a 10.000 puntos el HUD pasa a mostrar una vida más, una sola vez por partida y sin superar 4.

**Ciclo de vida e input**

- [ ] Flechas y `Espacio` no hacen scroll mientras el juego corre; con el modal abierto se puede escribir (incluidas `W`, `A`, `S`, `D`) sin mover la rana.
- [ ] PAUSA / `P` congelan carriles, serpiente, relojes de amenazas y temporizador; al reanudar no hay saltos de posición ni saltos encolados.
- [ ] FIN abre el modal con el puntaje actual; "JUGAR DE NUEVO" vuelve a 0, nivel 1, 3 vidas, sin cocodrilos ni serpiente y con la vida extra disponible de nuevo.
- [ ] Al salir y volver (y bajo Strict Mode) cada tecla mueve la rana una sola vez y no quedan listeners fuera de `/games/frogger/play`.
- [ ] Volver de otra pestaña no teletransporta carriles ni consume varios segundos de tiempo.
- [ ] En 375 px el canvas escala sin scroll horizontal; con `pointer: coarse` aparece el D-pad de 4 direcciones (sin botones) y cada toque es un salto.

**Ranking y calidad**

- [ ] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'frogger'` y el puntaje final; `/games/frogger` y la pestaña FROGGER de `/hall-of-fame` lo muestran.
- [ ] ROCAS, TETRIS, ARKANOID, SNAKE y CROAC se juegan igual que antes.
- [ ] RLS por REST: `201` para un insert válido de `frogger` y rechazo de `score = 0`, nombre de 11 caracteres y `game_id` inexistente; filas de prueba borradas.
- [ ] `rg -n 'from "(react|next)' lib/games/frogger/` y `rg -n 'croac' lib/games/frogger/` no devuelven resultados.
- [ ] `git diff` no muestra cambios en `lib/games/croac/`, `lib/supabase/`, `lib/session-context.tsx`, `components/`, `resources/` ni `package.json`.
- [ ] `GAMES.md` lista FROGGER con controles, amenazas por nivel y reglas que coinciden con el motor; `GAMES-TODO.md` lo tiene en *Implementados*.
- [ ] La consola no muestra errores ni warnings de React durante una partida completa.
- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.

---

## Decisions taken and discarded

**Tomadas:**

- **Entrada nueva `frogger`, separada de CROAC.** La galería suma juegos; CROAC queda como el clásico limpio y FROGGER como el arcade completo. Elegido por el usuario el 2026-10-09.
- **Nombre `FROGGER`.** Elegido por el usuario a pesar de ser marca registrada (ver Riesgos).
- **Color `green`.** El spec de origen pedía `lime`, que el `CHECK` rechaza; `green` es lo más cercano y lo separa del magenta de CROAC.
- **Diseño de CROAC, código propio.** Reusar la grilla, el salto y las colisiones ya probadas baja el riesgo; copiar en lugar de compartir evita refactorizar CROAC. A cambio, hay duplicación consciente (input, wrap, colisiones base), igual que con `input.ts` entre juegos.
- **Amenazas escalonadas por nivel (1: recompensas, 2: cocodrilos, 3: serpiente).** El nivel 1 enseña el juego y las recompensas; cada nivel siguiente agrega una regla nueva, que es lo que diferencia a FROGGER de CROAC (que solo acelera).
- **Determinismo con relojes y rotaciones fijas.** Mismo motivo que CROAC: ranking justo y bugs reproducibles. Las rotaciones (`[2,0,3,1,4]` y `[0,2,4,1,3]`) evitan que la mosca y el cocodrilo caigan siempre en la misma bahía.
- **El cocodrilo de bahía avisa (`peek` 2 s) antes de morder (`jaws` 3 s), y entrar en `peek` lo ahuyenta.** Convierte la trampa en lectura, no en lotería, y premia al rápido.
- **Mosca y cocodrilo nunca comparten bahía.** Evita una bahía que es recompensa y trampa a la vez, que se leería como bug.
- **La cabeza del cocodrilo de río va adelante y mide 40 px.** Fiel al arcade y legible: el peligro está donde el cocodrilo avanza.
- **La serpiente toma la franja media desde el nivel 3.** Rompe el único refugio a mitad de camino y obliga a decidir el momento de cruzar.
- **Una vida extra a los 10.000, tope de 4.** Es el valor del arcade; el HUD ya dibuja un `♥` por vida y 4 entran sin cambios de plataforma.
- **Mosca y dama valen 200 cada una.** Valores del arcade; una entrada perfecta (bahía + mosca + dama + bonus máximo) suma 1.050.
- **Los relojes de amenazas se congelan durante la muerte.** Al reaparecer, la situación sigue siendo la misma que se vio al morir.
- **`hazards.ts` separado de `lanes.ts` y `rules.ts`.** Las amenazas tienen sus propios relojes y rotaciones; mezclarlas en `rules.ts` lo volvería un archivo dios.
- **`sort_order = 13`**, el siguiente libre después de `croac = 12`, confirmado contra la base.
- **Layout táctil igual al de CROAC.** Mismas razones: sin diagonales (dos saltos a la vez) y sin botones.

**Descartadas:**

- **Implementar el spec de origen tal cual** (componente React, canvas 480×640, play-page propia, `localStorage` del nombre): rompe el contrato de motores y duplica lo que ya hace `GamePlayer`.
- **Frogger clásico sin agregados:** duplicaría CROAC en la galería.
- **Hacer "CROAC deluxe" modificando CROAC:** cambia un juego implementado y su ranking deja de ser comparable.
- **Módulo compartido CROAC/FROGGER:** es un refactor de un juego en producción; va en su propia spec.
- **Nutrias y serpiente sobre los troncos:** más estado y colisiones; las amenazas elegidas ya cubren río, bahías y franja media.
- **Azar (`Math.random`) para mosca y cocodrilos:** ranking menos justo y bugs no reproducibles.
- **Diseños de carriles distintos por nivel:** balanceo manual multiplicado; la progresión ya viene por amenazas.
- **Vida extra cada 10.000:** partidas largas sin tope y la pregunta del máximo de vidas en el HUD.
- **Mostrar la mosca o la dama en el HUD de la plataforma:** exigiría callbacks nuevos.

---

## Identified risks

| Riesgo | Mitigación |
| --- | --- |
| "Frogger" es marca registrada (Konami) y el nombre podría traer un reclamo | Decisión explícita del usuario. Cambiar el título más adelante es una migración de una línea; el slug quedaría como identificador interno. |
| FROGGER y CROAC se perciben como el mismo juego | Amenazas por nivel, tráfico distinto, paleta verde y cover propio. Hay criterios sobre los agregados y sobre el cover. |
| `frogger` queda `playable = true` sin motor (o al revés) | El paso 9 fija el orden: registro primero, migración después. |
| `sort_order = 13` ocupado al aplicar | El paso 9 lo consulta antes y ajusta valor y criterios. |
| El cocodrilo de río hace imposible cruzar la fila 2 | Es 1 de 3 objetos y su cuerpo es pisable; los otros dos troncos siguen. Se prueba a mano llegando a cada bahía en el nivel 2. |
| La mosca y el cocodrilo de bahía coinciden, o eligen una bahía ocupada | Las rotaciones saltan bahías ocupadas o tomadas por la otra amenaza; si ninguna sirve, ese ciclo no aparece. Hay criterio de aceptación. |
| La serpiente en la franja media deja a la rana sin refugio y frustra | Llega recién en el nivel 3, mide 80 px de 800 y tiene hitbox recortada 6 px por lado. |
| La rana dama se recoge sin querer o no se puede recoger | Tolerancia de ±20 px desde el centro del tronco y solo mientras está presente; se dibuja visible sobre la rana al recogerla. |
| La vida extra se otorga dos veces o supera 4 | Flag `extraLifeGiven` y tope `MAX_LIVES`; `restart()` lo reinicia. |
| Muertes duplicadas en el mismo cuadro, o `onGameOver` doble | Una muerte por cuadro, solo en `playing`, y `endGame()` protegido. |
| `dt` enorme al volver de otra pestaña | `dt` capado a `MAX_DT`; `startLoop()` reinicia `lastTime`. |
| Strict Mode duplica loops o listeners | `destroy()` idempotente; criterio explícito. |
| La versión de la migración tomada de la hora local queda fuera de orden | Se lee de `supabase_migrations.schema_migrations` después de aplicar. |
| El puntaje se calcula en el cliente | Riesgo aceptado desde la SPEC 06. |

---

## What is **not** in this spec

- Cambios en CROAC o en cualquier otro juego, y un módulo compartido entre ellos.
- Nutrias, serpiente sobre troncos, carriles distintos por nivel o más de una vida extra.
- Sonido, sprites o assets binarios.
- Pantallas de nivel completado o de victoria, y cambios en `GamePlayer`, `GameCanvas`, `GameCallbacks` o `TouchControls`.
- Skins y ajustes de mobile más allá del criterio de 375 px (van en sus propias specs, vía `skin-designer` y `mobile-porter`).
- Cambios de esquema o tests automatizados.

Cada uno de estos, si se necesita, va en su propia spec.
