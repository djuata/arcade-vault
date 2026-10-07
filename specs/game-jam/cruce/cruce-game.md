# SPEC — CRUCE (game jam)

> **Status:** Draft
> **Depends on:** SPEC 05 (asteroids-game), SPEC 06 (games-table-and-leaderboard)
> **Date:** 2026-10-07
> **Objective:** Agregar CRUCE como juego nuevo de la galería: un puzzle por turnos sobre carretera y río, donde autos, troncos y tortugas avanzan un paso solo cuando la rana salta o espera, con 12 niveles diseñados a mano, puntaje por eficiencia contra un par y ranking en Supabase, sin tocar RANARIA.
> **Game jam:** "Cruza la carretera y el río sin convertirte en papilla" — ángulo: puzzle / estrategia

---

## Por qué existe esta spec

El tema del jam es Frogger: cruzar una carretera y un río sin morir. La versión obvia es de reflejos (el tráfico corre en tiempo real y hay que saltar justo a tiempo). CRUCE toma el mismo escenario y le cambia el reloj: **el mundo está quieto hasta que la rana actúa**. Cada salto (o cada espera) es un turno, y en cada turno los carriles avanzan según su propio ritmo. El peligro deja de ser "no llegué a reaccionar" y pasa a ser "no leí bien el patrón". El tema está en la mecánica: carriles que se desplazan, plataformas que te arrastran, tortugas que se sumergen y una meta del otro lado. Si se cambiara el tema, habría que reescribir todas las reglas de resolución del turno.

Cinco puntos de esta spec no son obvios:

- **No hay código fuente que portar.** No existe Frogger en `resources/started-games/`. Las reglas, el orden de resolución del turno, los 12 niveles y el puntaje se **definen aquí**. Por eso la sección de Decisiones es larga, igual que en la SPEC 09.
- **RANARIA no se toca.** `ranaria` es un placeholder del catálogo (`cover-rana`, `ARCADE`, `green`, `playable = false`, `sort_order = 7`) que describe un Frogger de reflejos con tiempo límite. Sigue siendo un placeholder con arena falsa. CRUCE es una entrada **nueva** (`PUZZLE`, `cyan`) con su propio cover. Es la misma regla de galería que aplicaron las SPEC 07, 08 y 09.
- **El mundo es 100 % determinista y el par lo calcula un solver.** No hay azar: el estado del nivel en el turno `t` depende solo de `t`. Por eso un BFS chico (`solver.ts`) encuentra la solución óptima de cada nivel al cargarlo, y el par es `óptimo + 3`. El par no se escribe a mano (y no puede quedar mal), y el mismo solver detecta si un nivel diseñado es irresoluble. El motor y el solver comparten **la misma función pura** `resolveTurn`, así que el par siempre respeta las reglas reales.
- **El juego tiene un final.** Son 12 niveles fijos. La partida termina al perder la última vida o al completar el nivel 12 (equivale a ganar y suma un bonus por vidas). En los dos casos se emite `onGameOver`, como hace Snake al llenar el tablero. No hace falta pantalla de victoria ni cambios en la plataforma.
- **El canvas muestra el contador de turnos y el par.** El HUD de la plataforma solo tiene puntaje, nivel y vidas. El conteo de saltos contra el par es la información central del puzzle, así que se dibuja en una franja superior del canvas como indicador del juego (igual que el temporizador de un power-up), nunca como un HUD duplicado. No dibuja puntaje, nivel, vidas, `PAUSA` ni `GAME OVER`.

Decisiones tomadas sin consulta (jam, sin preguntas al usuario), todas registradas en Decisiones:

1. **Entrada nueva** `cruce` en `games`; RANARIA queda intacta.
2. **Todo se dibuja con canvas**, sin sprites ni assets en `public/`.
3. **Vidas: 3 al empezar**, con extras al completar los niveles 4 y 8 (tope de 5). Se emite `onLives`.

---

## Scope

**In:**

- Migración de datos `supabase/migrations/<version>_add_cruce_game.sql` que inserta la fila `cruce` en `games` con `playable = true`. Sin cambios de esquema ni de `lib/supabase/database.types.ts`.
- `lib/games/cruce/` (TypeScript puro, sin React ni `next/*`):
  - `constants.ts`: medidas, colores, puntaje, vidas y tiempos de animación.
  - `levels.ts`: tipos `LaneDef` y `LevelDef`, los 12 niveles (`LEVELS`) y `validateLevel(def)`.
  - `world.ts`: funciones puras sobre el mundo (`cellAt`, `laneShift`, `isSubmerged`, `movesNextTurn`, `resolveTurn`).
  - `solver.ts`: `solveLevel(def)` con BFS sobre `(fila, columna, t mod ciclo)`, que devuelve el óptimo en turnos o `null`.
  - `input.ts`: copia de `lib/games/snake/input.ts` con `KeyR` agregada a las teclas capturadas.
  - `render.ts`: `drawFrame(ctx, frame)`.
  - `engine.ts`: `createCruceGame`.
- Registro en `lib/games/registry.ts`: `cruce: createCruceGame`.
- `app/globals.css`: clase de cover `.cover-cruce` en CSS puro, distinta de `.cover-rana`.
- Verificación de RLS contra la API REST con la publishable key, y limpieza de las filas de prueba.
- Actualizar `GAMES.md` con la fila y la sección de CRUCE (lo exige la skill `arcade-vault-game`).

**Out of scope (para specs futuras):**

- Cualquier cambio a RANARIA (`ranaria` sigue con arena falsa, `ARCADE`, `green` y `playable = false`).
- Un Frogger de reflejos en tiempo real, o un modo "contrarreloj" dentro de CRUCE.
- Más de 12 niveles, niveles generados por procedimiento, editor de niveles o niveles de la comunidad.
- Selección de nivel, guardar el progreso entre sesiones o continuar una campaña.
- Deshacer jugadas (*undo*) o rebobinar turnos.
- Mostrar la solución óptima, pistas o una vista previa del próximo turno con fantasmas (solo hay indicadores de ritmo por carril).
- Límite de turnos o de tiempo por nivel.
- Enemigos móviles sobre los troncos (serpientes, cocodrilos), moscas de bonus, nenúfares ocupados y "rana dama" del Frogger original.
- Varias metas por nivel que haya que llenar (aquí, llegar a cualquier nenúfar completa el nivel).
- Sonido y música.
- Sprites o assets en `public/games/cruce/`: todo se dibuja con formas de canvas.
- Pantalla de victoria o cambios en `GamePlayer` / `GameCallbacks`: completar el nivel 12 emite `onGameOver`.
- Mostrar turnos o par en el HUD de la plataforma.
- Controles táctiles o por mouse; el aviso "REQUIERE TECLADO" de `GameCanvas` cubre el caso.
- Soporte HiDPI/retina y canvas con proporción distinta de 4:3.
- Mover `createInput` a un módulo compartido `lib/games/input.ts` (habría cinco copias).
- Validar en el servidor que el puntaje sea alcanzable (anti-trampa).
- Cambios de esquema, tablas nuevas o regenerar `database.types.ts`.
- Tests automatizados: el proyecto no tiene test runner.

---

## Data model

**Fila nueva en `public.games`** (la inserta la migración; el resto de las columnas toma sus valores por defecto):

```sql
insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order) values
('cruce', 'CRUCE',
 'El tráfico solo avanza cuando saltas.',
 'Una rana, una carretera y un río, pero aquí el mundo se mueve por turnos: autos, troncos y tortugas avanzan un paso solo cuando saltas o esperas. Lee el ritmo de cada carril, planifica la ruta y cruza los 12 niveles con menos saltos que el par para sumar más puntos. Tienes tres vidas.',
 'PUZZLE', 'cover-cruce', 'cyan', true, 13);
```

Estado esperado antes de la migración: 11 juegos (`sort_order` 1 a 11), con `rocas`, `tetris`, `arkanoid` y `snake` en `playable = true`. Después: un juego más, con `cruce` también jugable. `sort_order = 13` es el valor del brief (el 12 puede quedar para otro juego del jam). Se confirma contra la base antes de aplicar, porque la columna es única. Un hueco en 12 no rompe nada: el orden solo se usa para ordenar.

**Constantes del motor (`lib/games/cruce/constants.ts`):**

- Canvas: `W = 800`, `H = 600`, con el origen arriba a la izquierda.
- Grilla: `CELL = 50`, `COLS = 14`, `ROWS = 11`. El tablero ocupa `x = 50..750` (`BOARD_X = 50`) e `y = 50..600` (`BOARD_Y = 50`).
- Franja superior de información: `y = 0..50`. Canaletas laterales de ritmo: `x = 0..50` y `x = 750..800`.
- Filas: `0` meta, `1..4` río, `5` mediana (segura), `6..9` carretera y `10` inicio (seguro).
- Rana inicial: `{ row: 10, col: 7 }`.
- Vidas: `START_LIVES = 3`, `MAX_LIVES = 5` y `EXTRA_LIFE_LEVELS = [4, 8]` (al completar esos niveles, si hay menos de 5).
- Niveles: `LEVEL_COUNT = 12`.
- Par: `PAR_SLACK = 3` (`par = óptimo + 3`) y `PAR_FALLBACK = 40` si el solver devuelve `null`.
- Puntaje:
  - `ROW_POINTS = 10`: la primera vez en el nivel que la rana alcanza una fila más alta que su récord en ese nivel. El récord se mantiene entre intentos, así que no se puede farmear.
  - `CLEAR_POINTS = 1000`, `UNDER_PAR_POINTS = 300` por turno debajo del par, `OVER_PAR_PENALTY = 50` por turno encima del par y `MIN_CLEAR_POINTS = 200`.
  - `FLAWLESS_POINTS = 500`, si el nivel se completa sin morir y sin reiniciar con `R`.
  - `LIFE_BONUS = 2000` por vida restante al completar el nivel 12.
- Animación (solo visual, la lógica es instantánea): `TURN_ANIM_MS = 110` (salto de la rana y deslizamiento de carriles), `DEATH_ANIM_MS = 600` y `LEVEL_CLEAR_MS = 800`.
- Entrada: `MAX_BUFFERED_ACTIONS = 1`, que es la acción guardada mientras dura la animación de un turno.
- Loop: `MAX_DT = 0.05`.
- Colores (paleta del portal): fondo `#0a0a18`; carretera `#15151f` con líneas `#2a2a3a`; río `#002a3a` con ondas `#00f5ff` al 25 %; mediana e inicio `#1a1030`; seto `#0b3d1f`; nenúfar `#00ff88`; tronco `#8b5a2b`; tortuga `#ff006e`; auto `#f5ff00`; camión `#ffae00`; rana `#00ff88` con ojos `#0a0a18`; indicadores `#00f5ff` (activo) y `#33334a` (inactivo).

**Formato de nivel (`lib/games/cruce/levels.ts`):**

```ts
type LaneKind = "goal" | "river" | "safe" | "road";
type Dir = -1 | 1;           // -1 = hacia la izquierda, 1 = hacia la derecha

interface DiveCycle { up: number; down: number; offset: number }

interface LaneDef {
  kind: LaneKind;
  pattern: string;           // exactamente COLS = 14 caracteres, en el turno 0
  dir: Dir;                  // se ignora en "goal" y "safe"
  period: 1 | 2 | 3;         // el carril se desplaza 1 celda cada `period` turnos
  dive?: DiveCycle;          // solo en río, para las celdas 'D'
}

interface LevelDef {
  name: string;              // se muestra en la franja superior
  lanes: readonly LaneDef[]; // 11 carriles, índice = fila (0 = meta, 10 = inicio)
}
```

Caracteres de `pattern`:

| Carril | Carácter | Significado |
| --- | --- | --- |
| meta | `H` / `#` | nenúfar (completa el nivel) / seto (bloquea, no mata) |
| río | `~` / `L` / `T` / `D` | agua / tronco / tortuga fija / tortuga que se sumerge |
| carretera | `.` / `a` / `c` | asfalto / auto / camión (cada celda `c` es parte del camión) |
| segura | `.` | pasto |

- Contenido de la columna `c` en el turno `t`: `pattern[mod(c - dir * floor(t / period), COLS)]`. Los carriles son anillos: lo que sale por un borde entra por el otro.
- Una celda `D` está sumergida en el turno `t` si `mod(t + offset, up + down) >= up`. Todas las `D` de un carril se sumergen juntas.
- `validateLevel(def)` devuelve una lista de errores: debe haber 11 carriles con los `kind` en el orden fijo, cada patrón de 14 caracteres con solo caracteres válidos para su carril, al menos una `H` en la meta, un `dive` presente si y solo si el carril tiene alguna `D`, y `up >= 1` y `down >= 1`.

**Los 12 niveles** (filas 5 y 10 siempre `..............`; `→` = `dir 1`, `←` = `dir -1`; `pN` = `period`; `D u/d+o` = `dive { up: u, down: d, offset: o }`):

```text
1  PRIMER SALTO                     2  DOBLE VÍA
0  #######H######                   0  ###H######H###
1  LLLLL~~LLLLL~~  → p3             1  LLLL~~~~LLLL~~  → p2
2  ~LLLLLL~~LLLL~  ← p3             2  ~~LLLLL~~~LLL~  ← p3
3  LLLL~~~LLLLLL~  → p2             3  LLLLL~~~~LLL~~  → p3
4  ~~LLLLLL~~LLLL  ← p3             4  ~LLLL~~~LLLLL~  ← p2
6  ..a.....a.....  ← p2             6  .a....a....a..  ← p1
7  ....aa......aa  → p3             7  ..aa......aa..  → p2
8  .a......a.....  ← p3             8  a.....a.......  ← p2
9  ...a.....a....  → p2             9  ....a....a....  → p1

3  CAPARAZONES                      4  CAMIONES
0  #H####H####H##                   0  ####H####H####
1  TTT~~~TTT~~~~~  ← p2             1  LLL~~~LLL~~~~~  → p2
2  LLLL~~~~~LLLL~  → p2             2  ~TTT~~~~TTT~~~  ← p2
3  ~~TT~~~TT~~~TT  ← p1             3  LLLLLL~~~~~~~~  → p1
4  LLLLL~~~~LLL~~  → p3             4  ~~TT~~TT~~TT~~  ← p3
6  ..a...a...a...  → p1             6  ccc.......ccc.  ← p2
7  .aa.....aa....  ← p2             7  ..a...a...a...  → p1
8  ...a......a...  → p2             8  .ccc.....ccc..  → p3
9  a....a....a...  ← p1             9  ...aa.....aa..  ← p1

5  INMERSIÓN                        6  CONTRACORRIENTE
0  ##H###H###H###                   0  ############H#
1  DDD~~~TTT~~~~~  ← p2  D 4/2+0    1  LLL~~~~LLL~~~~  → p1
2  LLLL~~~~LLLL~~  → p2             2  ~~LLLL~~~~LLL~  ← p1
3  ~~DDD~~~~DDD~~  ← p1  D 3/2+2    3  TTT~~~~TTT~~~~  → p2
4  LLLLL~~~~~LL~~  → p3             4  ~~LLL~~~~~LLLL  ← p2
6  ..ccc......a..  → p2             6  ..a....a....a.  ← p1
7  a...a...a.....  ← p1             7  .cc.....cc....  → p2
8  ....ccc.......  → p3             8  a.....a.....a.  ← p2
9  .a....a....a..  ← p1             9  ...ccc....a...  → p1

7  HORA PICO                        8  EMBUDO
0  #H##########H#                   0  #H############
1  LLLL~~~LLLL~~~  ← p2             1  DDDD~~~~~~LL~~  → p2  D 5/2+0
2  ~TT~~~TT~~~TT~  → p2             2  ~~~LLL~~~~LLL~  ← p1
3  LLLLL~~~~~~~~~  ← p3             3  TT~~~~DD~~~~TT  → p2  D 4/3+3
4  ~~~TTTT~~~~~~~  → p2             4  LLLL~~~~~~~~~~  ← p2
6  a..a..a..a....  → p1             6  cccc......a...  → p2
7  ..cc....cc....  ← p1             7  .a..a..a......  ← p1
8  .a...a...a....  → p1             8  ...cc....cc...  → p1
9  ...ccc.....ccc  ← p1             9  a...a.....a...  ← p2

9  ASTILLAS                         10 RELOJERÍA
0  ###H###H###H##                   0  ######H#######
1  LL~~~LL~~~LL~~  ← p1             1  DDD~~DDD~~DDD~  → p2  D 3/2+0
2  ~LL~~~~LL~~~~~  → p2             2  ~DDDD~~~DDDD~~  ← p2  D 3/2+2
3  LL~~LL~~~~~~~~  ← p2             3  DDD~~DDD~~DDD~  → p3  D 4/2+1
4  ~~~LL~~~LL~~~~  → p1             4  ~~LLLL~~~~LLLL  ← p1
6  .aa..aa..aa...  ← p1             6  ..a...a...a...  ← p1
7  ccc.....ccc...  → p2             7  cc....cc....cc  → p1
8  ..a..a..a..a..  ← p2             8  .a..a..a..a...  → p2
9  ....cccc......  → p1             9  ccc....ccc....  ← p1

11 TORMENTA                         12 GRAN CRUCE
0  ##H########H##                   0  H############H
1  LLL~~~~LLL~~~~  ← p1             1  LL~~~DDD~~~LL~  → p1  D 3/3+0
2  ~TTT~~~~TTT~~~  → p1             2  ~~TT~~~~LLL~~~  ← p2
3  LLLL~~~~~LLL~~  ← p1             3  DDDD~~~~~~LL~~  → p1  D 4/2+3
4  ~~DDD~~~~DDD~~  → p1  D 4/2+0    4  ~LL~~~LL~~~LL~  ← p1
6  a..a...a..a...  → p1             6  cccc....a.....  ← p1
7  ..ccc.....ccc.  ← p1             7  .a.a...a.a....  → p1
8  .a...a..a...a.  → p1             8  ..ccc....ccc..  ← p2
9  cc....cc...cc.  ← p1             9  a..a..a..a..a.  → p1
```

Curva de diseño: 1–2 enseñan a leer el ritmo (`p2`/`p3`); 3 suma tortugas; 4, camiones largos; 5, tortugas que se sumergen; 6, una sola meta en el borde, que obliga a dejarse arrastrar; 7, carretera entera a `p1`; 8, embudo hacia la columna 1; 9, troncos de 2 celdas; 10, un río solo de tortugas que se sumergen con fases distintas; 11, todo a `p1`; 12, metas en las esquinas y todas las mecánicas. Los patrones son la propuesta inicial. Si el solver marca un nivel como irresoluble, o su óptimo cae fuera de `10..60` turnos, se ajusta **el patrón** (nunca las reglas) en el paso 3 y se anota el cambio en `GAMES.md`.

**Estado del motor (en el closure de `createCruceGame`):**

```ts
type Action = "up" | "down" | "left" | "right" | "wait";
type DeathCause = "atropellada" | "ahogada" | "arrastrada";
type Phase = "idle" | "animating" | "dying" | "clearing" | "gameover"; // más el flag `paused`

interface Frog { row: number; col: number }

type TurnResult =
  | { kind: "blocked" }                                     // no consume turno
  | { kind: "moved"; frog: Frog; t: number }                // t = turno siguiente
  | { kind: "dead"; frog: Frog; t: number; cause: DeathCause }
  | { kind: "goal"; frog: Frog; t: number };

// Por nivel: levelIndex, t (turno del mundo), turns (acciones del intento),
// par, bestRow (récord de fila en el nivel, persiste entre intentos),
// flawless (sin muertes ni R en el nivel), frog.
// Por partida: score, lives, phase, actionBuffer (máximo 1), animStart, parCache (Map<number, number>).
```

**Resolución de un turno (`resolveTurn(level, frog, t, action)`, pura y compartida por el motor y el solver):**

- `wait`: la rana no se mueve y se pasa a la fase B.
- **Bloqueo** (devuelve `blocked`, no cuenta como turno ni mueve el mundo): el destino queda fuera de la grilla (`col < 0`, `col > 13`, `row > 10`, `row < 0`) o es un seto `#` de la meta.
- **Fase A, aterrizaje con el mundo en el turno `t`:**
  - Si el destino es un `H` de la meta, devuelve `goal`. El salto cuenta como turno y el mundo no necesita avanzar.
  - Si el destino es carretera y hay `a` o `c` en esa celda, devuelve `dead` con causa `atropellada` (te tiraste encima de un auto).
  - Si el destino es río y la celda es `~` o una `D` sumergida en `t`, devuelve `dead` con causa `ahogada`.
- **Fase B, el mundo avanza de `t` a `t + 1`:**
  - Cada carril se desplaza una celda en su `dir` si `(t + 1) % period === 0`.
  - Si la rana está en el río y su carril se desplazó, la rana se mueve con él. Si queda en `col < 0` o `col > 13`, devuelve `dead` con causa `arrastrada`.
  - Si la rana está en la carretera y su celda tiene `a` o `c` en `t + 1`, devuelve `dead` con causa `atropellada`.
  - Si la rana está en el río sobre una `D` sumergida en `t + 1`, devuelve `dead` con causa `ahogada`.
  - Si no pasó nada de eso, devuelve `moved` con `t + 1`.
- Con el control en las dos fases, la rana nunca "atraviesa" un auto: moverse en horizontal contra un auto que viene hacia ella muere en la fase A.

**Reglas del juego:**

- Cada acción válida (salto o espera) suma 1 a `turns` del intento y avanza el mundo un turno. Las acciones bloqueadas no cuentan.
- Las filas 5 (mediana) y 10 (inicio) son siempre seguras; se puede esperar en ellas sin límite.
- Al llegar a una fila más alta que `bestRow` del nivel, se suma `ROW_POINTS` por cada fila nueva y se actualiza `bestRow`. `bestRow` se reinicia solo al cargar otro nivel.
- **Muerte:** se pierde una vida (`onLives`), `flawless = false` y se reproduce la animación de `DEATH_ANIM_MS`. Si quedan vidas, el nivel se reinicia: `t = 0`, `turns = 0` y la rana en `{10, 7}`. Si no quedan, la partida termina en el acto.
- **Reiniciar con `R`:** reinicia el nivel igual que una muerte (`t = 0`, `turns = 0`, rana al inicio), **sin** perder vida, pero pone `flawless = false`. Se ignora durante las animaciones de muerte y de nivel completado.
- **Completar el nivel** (llegar a un `H`): `under = max(0, par - turns)` y `over = max(0, turns - par)`. Se suma `max(MIN_CLEAR_POINTS, CLEAR_POINTS + UNDER_PAR_POINTS * under - OVER_PAR_PENALTY * over) * nivel`, más `FLAWLESS_POINTS * nivel` si `flawless`. Si el nivel es 4 u 8 y `lives < MAX_LIVES`, se suma una vida. Tras `LEVEL_CLEAR_MS` se carga el nivel siguiente.
- **Victoria:** al completar el nivel 12 se suma `LIFE_BONUS * lives` y la partida termina.
- **Par:** al cargar un nivel, `par = solveLevel(def) + PAR_SLACK` (cacheado por índice en el closure). Si el solver devuelve `null`, `par = PAR_FALLBACK`.
- **Solver:** BFS desde `{10, 7}` en `t = 0` sobre estados `(row, col, t mod CYCLE)`, donde `CYCLE` es el mínimo común múltiplo de `COLS * period` de cada carril y de `up + down` de cada `dive`. Usa `resolveTurn` con las 5 acciones, descarta `dead` y `blocked` y devuelve la profundidad del primer `goal`. Peor caso: `154 * 420 = 64.680` estados.
- El puntaje es siempre entero. Máximo teórico aproximado: `(1000 + 900 + 500) * 78 + 1.200 + 10.000 ≈ 198.400`, muy por debajo de 99.999.999.

**Teclado (`lib/games/cruce/input.ts`):** copia de `lib/games/snake/input.ts` (callback `onPress(code)` por pulsación nueva, sin auto-repeat).

| Tecla | Acción |
| --- | --- |
| `↑` / `W` | saltar arriba |
| `↓` / `S` | saltar abajo |
| `←` / `A` | saltar a la izquierda |
| `→` / `D` | saltar a la derecha |
| `Espacio` | esperar un turno |
| `R` | reiniciar el nivel (sin perder vida) |
| `P` | pausa (de la plataforma, el motor no la escucha) |

`captureKeys`: flechas, `Space`, `KeyW`, `KeyA`, `KeyS`, `KeyD` y `KeyR`, con `preventDefault` solo si el juego corre (`!paused && phase !== "gameover"`). Si llega una acción con `phase === "animating"`, se guarda en `actionBuffer` (máximo 1, la más nueva reemplaza a la anterior) y se ejecuta al terminar la animación. En `dying` y `clearing` las acciones se descartan y el buffer se vacía.

**Layout del canvas (800×600):**

- Franja superior (`y 0..50`, fondo `#0a0a18`): a la izquierda `TURNO 07 · PAR 13` (con el turno en `#ff006e` si supera el par), y a la derecha el `name` del nivel. Fuente `bold 16px monospace`. Es el único texto del canvas.
- Tablero (`50..750 × 50..600`): meta con setos y nenúfares; río con ondas; mediana; carretera con líneas punteadas entre carriles; inicio. La rana es un cuadrado redondeado con ojos orientados hacia el último salto.
- Canaletas laterales (`0..50` y `750..800`), una por cada carril móvil: una flecha con su `dir` y `period` puntos debajo. Se encienden `(t mod period) + 1` puntos; con todos encendidos, la flecha se pinta en `#00f5ff`, lo que significa que **ese carril se mueve en el próximo turno**. Así el ritmo se lee sin contar.
- Tortugas `D`: enteras cuando están arriba; con burbujas y a medio tamaño cuando estarán sumergidas en `t + 1` (aviso de un turno); solo una onda cuando están sumergidas.
- Animación: durante `TURN_ANIM_MS`, rana y carriles se interpolan entre `t` y `t + 1` (los carriles que dan la vuelta se dibujan en los dos bordes). La muerte se dibuja como una "X" que se desvanece, o salpicadura en el agua, durante `DEATH_ANIM_MS`. Al completar el nivel, el nenúfar destella durante `LEVEL_CLEAR_MS`.
- El canvas **no** dibuja puntaje, nivel numérico, vidas, `PAUSA`, `GAME OVER` ni mensaje de victoria.

**Contrato de eventos del motor:**

- Al crearse y en cada `restart()`, el motor emite `onScore(0)`, `onLevel(1)` y `onLives(3)`.
- `onScore`, `onLevel` y `onLives` se emiten solo cuando el valor cambia. `onLevel(n)` se emite al cargar el nivel `n`; tras la victoria no se emite `onLevel(13)`.
- `onGameOver(finalScore)` se emite una sola vez por partida, de inmediato: al perder la última vida (la animación de muerte sigue dibujándose debajo del modal) o al completar el nivel 12 (después de sumar `LIFE_BONUS`).

---

## Implementation plan

Antes de escribir código, consultar la guía de Next.js 16 en `node_modules/next/dist/docs/` (según `AGENTS.md`) y la skill `arcade-vault-game`. Si `node_modules/` no existe, instalar las dependencias primero. Cada paso deja la app compilando y las pantallas existentes funcionando. Las verificaciones estáticas de cada paso son `npm run lint` y `npx tsc --noEmit`; no se ejecuta ningún build.

1. **Constantes y niveles.** Crear `lib/games/cruce/constants.ts` y `levels.ts` con los tipos, los 12 niveles de esta spec y `validateLevel`. Prueba: lint y `tsc --noEmit`.
2. **Mundo.** Crear `lib/games/cruce/world.ts` con funciones puras: `cellAt(lane, col, t)`, `laneShift(lane, t)`, `isSubmerged(lane, t)`, `movesNextTurn(lane, t)`, `isBlocked(level, frog)` y `resolveTurn(level, frog, t, action)`, exactamente con el orden de fases del Data model. Sin canvas ni estado propio. Prueba: lint y `tsc --noEmit`.
3. **Solver y validación de niveles.** Crear `lib/games/cruce/solver.ts` con `cycleLength(def)` y `solveLevel(def)`, que usa `resolveTurn`. Agregar en el motor, de forma temporal, una llamada que recorra `LEVELS` con `validateLevel` y `solveLevel`, mida con `performance.now()` y vuelque un `console.table` (nivel, errores, óptimo, par, ms). Prueba manual en `npm run dev`: los 12 niveles no tienen errores, son resolubles, tienen óptimo en `10..60` y cada `solveLevel` tarda menos de 16 ms. Si alguno falla, ajustar su patrón. Si el tiempo supera 16 ms, aplicar la mitigación de Riesgos (par precalculado). Quitar la llamada temporal antes del paso 6.
4. **Input.** Crear `lib/games/cruce/input.ts` copiando `lib/games/snake/input.ts` y agregando `KeyR` a las teclas capturadas. `attach`/`detach` sobre `window` y `Space` cancelado también en `keyup`. Prueba: lint y `tsc --noEmit`.
5. **Render.** Crear `lib/games/cruce/render.ts` con `drawFrame(ctx, frame)`, donde `frame` trae nivel, `t`, progreso de la animación (0..1), rana, rana previa, fase, causa de muerte, turnos y par. Dibuja la franja, las canaletas, los carriles con interpolación y los avisos de inmersión. Sin textos de estado. Prueba: lint y `tsc --noEmit`.
6. **Motor.** Crear `lib/games/cruce/engine.ts` con `createCruceGame` (`GameEngineFactory`): estado en el closure; `initGame` (nivel 1, vidas 3, puntaje 0, y emite `onScore(0)`, `onLevel(1)` y `onLives(3)`); `loadLevel(i)` (con par cacheado); `performAction` con `resolveTurn` y el manejo de `moved`/`dead`/`goal`; puntaje por filas, por nivel y de victoria; buffer de una acción; temporizadores de animación acumulados con `dt` (nunca `setTimeout`); `endGame()` con guarda para emitir `onGameOver` una sola vez; loop de `requestAnimationFrame` cancelable con `dt` capado a `MAX_DT` y `dt = 0` en el primer cuadro; `pause()`, `resume()` (vacía el buffer y reinicia `lastTime`), `restart()` y `destroy()` (idempotente, cancela el rAF y llama a `input.detach()`). Prueba: lint y `tsc --noEmit`, y una prueba manual rápida montando el motor en el paso 8.
7. **Cover.** Agregar `.cover-cruce` en `app/globals.css` (CSS puro, con los tokens existentes). Fondo `linear-gradient(180deg, #001f2a, #0a0a18)`; en `::before`, la mitad superior es río (bandas `rgba(0,245,255,0.15)`) con dos barras de tronco `#8b5a2b`, y la mitad inferior es carretera con dos cuadrados `var(--yellow)`; en `::after`, una grilla punteada sutil (`repeating-linear-gradient` en los dos ejes, `rgba(255,255,255,0.06)`) que comunica "tablero por turnos", y la rana como un cuadrado `var(--green)` sobre la mediana con `drop-shadow` cyan. Tiene que verse distinta de `.cover-rana` (bandas y círculo). Prueba manual: asignar la clase de forma temporal a un elemento `.cover-bg` y revisarla en 375 px y en desktop; el elemento temporal no se commitea.
8. **Registro y migración, en este orden.** Primero agregar `cruce: createCruceGame` en `lib/games/registry.ts`. Después consultar `select id, sort_order from public.games order by 2`, aplicar con `apply_migration` el insert del Data model (nombre `add_cruce_game`, ajustando `sort_order` si 13 está ocupado), leer la versión real asignada (`select version, name from supabase_migrations.schema_migrations order by version desc limit 1`) y guardar el mismo SQL en `supabase/migrations/<version>_add_cruce_game.sql`. Verificar con `execute_sql`: `cruce` jugable y `ranaria` con `playable = false` y sus valores originales. Prueba manual: `/games` muestra la tarjeta de CRUCE y `/games/cruce/play` muestra el juego.
9. **Verificación de RLS por REST.** Con `curl` y la publishable key (`apikey` + `Authorization: Bearer`): un `POST /rest/v1/scores` válido para `cruce` responde `201`; se rechazan un `score` `0`, un `player_name` de 11 caracteres, un `game_id` inexistente y un `game_id` de un juego no jugable (`ranaria`). Al terminar, borrar con `execute_sql` las filas de prueba.
10. **Pase final de integración.** Actualizar `GAMES.md` (fila de resumen, sección con ruta, motor, cover, migración, controles y reglas tomados del código). Recorrer los criterios de aceptación en `npm run dev` (incluido el doble montaje de Strict Mode y la navegación de ida y vuelta), revisar la consola del navegador y correr `npm run lint` y `npx tsc --noEmit`.

---

## Acceptance criteria

- [ ] `games` tiene una fila `cruce` con `title = 'CRUCE'`, `cat = 'PUZZLE'`, `color = 'cyan'`, `cover = 'cover-cruce'`, `sort_order = 13` (o el valor ajustado en el paso 8) y `playable = true`.
- [ ] `ranaria` y los demás placeholders (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `duelo-pixel`) conservan exactamente sus valores anteriores, con `playable = false`; solo `rocas`, `tetris`, `arkanoid`, `snake` y `cruce` tienen `playable = true`.
- [ ] `list_migrations` muestra `add_cruce_game` y `supabase/migrations/` contiene su SQL con la misma versión.
- [ ] `/games` muestra la tarjeta de CRUCE con su cover distinto del de RANARIA, y el filtro `PUZZLE` la incluye.
- [ ] `/games/cruce` muestra el título y la descripción de la base, `—` como mejor marca y `0` como partidas cuando no hay puntajes.
- [ ] `/games/cruce/play` muestra un `<canvas>` de 800×600 dentro del marco CRT y no contiene los elementos `.enemy` ni `.player-ship` de la arena falsa.
- [ ] `/games/ranaria/play` sigue mostrando la arena falsa, y su modal de fin de juego dice "ESTE JUEGO AÚN NO TIENE RANKING." sin ofrecer guardar.
- [ ] Los 12 niveles pasan `validateLevel` sin errores y `solveLevel` devuelve un óptimo entre 10 y 60 para cada uno.
- [ ] Sin pulsar ninguna tecla, ningún auto, tronco ni tortuga se mueve (el mundo solo avanza con acciones).
- [ ] Cada salto válido o `Espacio` suma exactamente 1 al contador `TURNO` de la franja y avanza el mundo un turno; un salto contra el borde o contra un seto no suma turno ni mueve nada.
- [ ] Mantener apretada una flecha produce un solo salto (se ignora el auto-repeat).
- [ ] Las flechas de las canaletas se encienden exactamente en el turno anterior a que su carril se mueva.
- [ ] Saltar a una celda con auto, quedar en una celda a la que llega un auto, o moverse en horizontal "a través" de un auto que viene en sentido contrario, mata a la rana (`atropellada`).
- [ ] Saltar al agua, o estar sobre una tortuga `D` cuando se sumerge, mata a la rana (`ahogada`); las tortugas muestran burbujas un turno antes de sumergirse.
- [ ] Un tronco que se desplaza arrastra a la rana, y si la saca del tablero, la rana muere (`arrastrada`).
- [ ] Llegar a un nenúfar completa el nivel, suma puntaje según la fórmula de la spec (comprobado a mano en el nivel 1 con un conteo de turnos conocido) y carga el nivel siguiente tras la animación; el HUD "Nivel" sube en el momento de la carga.
- [ ] El par mostrado en la franja es igual al óptimo del solver + 3, y el turno se pinta en magenta al superar el par.
- [ ] Morir resta una vida en el HUD y reinicia el nivel en el turno 0 con la rana en el inicio; las filas ya alcanzadas en ese nivel no vuelven a sumar `ROW_POINTS`.
- [ ] `R` reinicia el nivel sin restar vida y anula el bonus `FLAWLESS` de ese nivel.
- [ ] Completar los niveles 4 y 8 suma una vida, sin pasar de 5.
- [ ] Perder la última vida abre el modal "FIN DEL JUEGO" exactamente una vez, con el puntaje final correcto.
- [ ] Completar el nivel 12 suma `2000` por vida restante y abre el modal "FIN DEL JUEGO" exactamente una vez, sin mensaje de victoria en el canvas.
- [ ] El canvas no dibuja puntaje, nivel numérico, vidas, `PAUSA`, `GAME OVER` ni mensaje de victoria; el único texto es `TURNO · PAR` y el nombre del nivel.
- [ ] Presionar flechas o `Espacio` mientras el juego corre no hace scroll de la página.
- [ ] Con el modal abierto, escribir iniciales (incluidos espacios, flechas y las letras `W`, `A`, `S`, `D`, `R`) funciona y no mueve a la rana ni reinicia el nivel.
- [ ] El botón PAUSA y la tecla `P` congelan el juego (incluidas las animaciones a medio camino) y muestran "EN PAUSA"; reanudar continúa sin saltos ni turnos extra.
- [ ] El botón FIN detiene el juego y abre el modal con el puntaje actual.
- [ ] "JUGAR DE NUEVO" deja la partida en puntaje 0, nivel 1, 3 vidas, turno 0 y el juego corriendo.
- [ ] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'cruce'`, el nombre en mayúsculas y el puntaje final, y el modal muestra "PUNTUACIÓN GUARDADA".
- [ ] Tras guardar, `/games/cruce` y la pestaña CRUCE de `/hall-of-fame` muestran ese puntaje, y `best` y `plays` se actualizan.
- [ ] Al salir con SALIR y volver a entrar (y bajo Strict Mode en `npm run dev`), cada tecla produce una sola acción y no quedan listeners de teclado activos fuera de `/games/cruce/play`.
- [ ] Volver a la pestaña tras tenerla en segundo plano no avanza turnos ni salta animaciones de golpe.
- [ ] En un ancho de 375 px el canvas escala sin scroll horizontal y mantiene la proporción 4:3; en emulación `pointer: coarse` aparece "REQUIERE TECLADO".
- [ ] ROCAS, TETRIS, ARKANOID y SNAKE se juegan igual que antes.
- [ ] Con la publishable key, un `POST /rest/v1/scores` válido para `cruce` responde `201`, y se rechazan `score` `0`, `player_name` de 11 caracteres, `game_id` inexistente y `game_id = 'ranaria'`; las filas de prueba quedan borradas.
- [ ] `rg -n 'from "(react|next)' lib/games/cruce/` no devuelve resultados.
- [ ] `git diff` no muestra cambios en `lib/supabase/`, `lib/session-context.tsx`, `components/nav/`, `components/player/`, `lib/games/types.ts`, `resources/` ni `package.json`, y `database.types.ts` no cambió.
- [ ] No queda ningún `console.table` ni código de validación temporal del paso 3, y la consola del navegador no muestra errores ni warnings de React durante una partida completa.
- [ ] `GAMES.md` lista CRUCE con controles y reglas que coinciden con el código.
- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.

---

## Decisions taken and discarded

**Tomadas:**

- **CRUCE como entrada nueva (`cruce`), no sobre RANARIA.** La galería suma juegos. RANARIA promete otra cosa (reflejos y tiempo límite) y sigue como placeholder. Costo: el catálogo muestra dos juegos de rana, uno jugable y otro no.
- **Mundo por turnos, no en tiempo real.** Es el ángulo del jam y lo que separa CRUCE de un Frogger de reflejos: el peligro se lee, no se reacciona. Costo: pierde la tensión física del original y depende de que los patrones sean interesantes.
- **Determinismo total, sin azar.** Hace que cada nivel sea un puzzle con solución y que el solver pueda calcular el par. Costo: las soluciones se pueden memorizar y compartir; para un puzzle es aceptable (el ranking premia la maestría) y queda como riesgo de empates en la cima.
- **Par = óptimo del solver + 3.** Escribir el par a mano es la fuente de error más probable del diseño; derivarlo de las mismas reglas lo vuelve imposible de equivocar y permite editar niveles sin recalcular nada. El margen de 3 deja premiar a quien encuentra el óptimo (hasta 900 × nivel extra). Costo: un BFS en el bundle y unos milisegundos al cargar cada nivel.
- **`resolveTurn` único y puro, compartido por motor y solver.** Si el motor y el solver tuvieran dos implementaciones, el par podría ser inalcanzable. Costo: el motor no puede "ahorrar" lógica con atajos propios.
- **Orden de fases A (aterrizaje) → B (mundo).** Es la forma más simple de que "lo que ves es donde caés" y de que la rana nunca atraviese un auto. Costo: hay que explicarlo en `GAMES.md`, porque la muerte en la fase B (un auto llega a tu celda) puede sorprender en el primer nivel.
- **Grilla 14×11 con celdas de 50 px más una franja de 50 px y dos canaletas.** Divide exacto el canvas 800×600, deja 4 carriles de río y 4 de carretera (como el original) y reserva espacio para el turno, el par y los indicadores de ritmo sin tapar el tablero.
- **Carriles como anillos de 14 celdas con `period` 1–3.** Hace que el estado sea periódico (`CYCLE` finito), lo que permite el BFS, y da tres "velocidades" fáciles de leer. Costo: no hay velocidades fraccionarias ni aceleraciones.
- **Indicadores de ritmo en las canaletas y aviso de inmersión con un turno de anticipación.** "Leer y anticipar" exige que la información esté a la vista; sin esto, el puzzle se resuelve contando turnos de memoria. Costo: más trabajo de render.
- **Seto bloquea y no mata; borde bloquea y no cuenta turno.** En un puzzle, un error de dedo no debería costar una vida. Costo: se aleja del Frogger original, donde el seto mata.
- **Muerte reinicia el nivel a `t = 0`.** Mantiene el puzzle reproducible (siempre empieza igual) y hace que el puntaje dependa del intento exitoso. Costo: en niveles largos, morir cerca de la meta frustra; lo compensa `R`.
- **`R` gratis, pero sin `FLAWLESS`.** Permite explorar sin perder vidas y evita quedar "atascado" en un plan malo. Costo: las vidas solo castigan errores de lectura, que es justo lo que se quiere medir.
- **`ROW_POINTS` con récord por nivel.** Da puntaje mayor que 0 a quien no completa el nivel 1 (si no, el modal no puede guardar) y no se puede farmear muriendo o con `R`.
- **Puntaje por nivel multiplicado por el número de nivel.** Hace que llegar lejos valga más que optimizar los primeros niveles. Costo: la fórmula es menos obvia; se documenta en `GAMES.md`.
- **3 vidas, +1 en los niveles 4 y 8, tope 5.** Da `onLives` real (el HUD las muestra) y garantiza que la partida termine. El extra a mitad de campaña evita que la dificultad de 9–12 sea un muro.
- **Campaña finita de 12 niveles; la victoria emite `onGameOver`.** Cumple el contrato sin tocar la plataforma y asegura partidas que terminan. Costo: no hay mensaje de victoria y los jugadores expertos tienen un techo de puntaje.
- **Animaciones con temporizadores acumulados con `dt`, no `setTimeout`.** Un solo loop cancelable que respeta `pause`/`destroy` sin timers sueltos.
- **Buffer de una acción durante la animación.** Quien escribe rápido no pierde teclas, y quien aprieta tres veces sin querer no se mata. Las acciones se descartan durante la muerte y el nivel completado.
- **Texto `TURNO · PAR` y el nombre del nivel en el canvas.** Es un indicador del juego (no está en el HUD de la plataforma) e imprescindible para jugar por eficiencia. Costo: hay que vigilar que no parezca un HUD duplicado; no se dibuja ni puntaje, ni nivel numérico, ni vidas.
- **Fuente `monospace` en el canvas.** Las fuentes de `next/font` tienen nombres con hash que el motor no puede conocer sin importar de `next/*`. Costo: la tipografía del canvas no es Press Start 2P.
- **Todo dibujado con canvas, sin assets.** Coherente con ROCAS y TETRIS, sin licencias que revisar ni cargas asíncronas.
- **`input.ts` propio, copiado de Snake con `KeyR`.** Snake ya tiene la semántica de `onPress` que necesita un juego por turnos. Promoverlo a un módulo compartido queda fuera.
- **`sort_order = 13` del brief**, verificado contra la base antes de aplicar. Registro antes que migración y versión de migración leída de Supabase, por las mismas razones que en las SPEC 07–09.
- **Cover en CSS puro**, con una grilla punteada que comunica "turnos" y distinta de `.cover-rana`.

**Descartadas:**

- **Activar `ranaria`:** reemplaza una entrada existente de la galería, y su descripción (reflejos, tiempo límite) contradice este diseño.
- **Frogger en tiempo real:** es el ángulo de otro diseñador del jam y no es puzzle.
- **Tiempo real "pausado" (el mundo corre y se congela mientras no apretás nada):** confunde las dos lecturas y rompe el determinismo del solver.
- **Par escrito a mano en `levels.ts`:** fácil de equivocar y frágil ante cualquier edición de un patrón. Solo queda como mitigación si el solver resulta lento.
- **Niveles procedurales o infinitos:** sin diseño a mano no hay "patrones que leer", y una campaña infinita y memorizable no termina nunca para un experto.
- **Repetir los 12 niveles espejados tras el 12:** mantendría la resolubilidad, pero haría la partida interminable para quien los domina.
- **Varias metas por nivel (llenar los 5 nenúfares):** obligaría a definir si el mundo se reinicia entre metas y triplicaría la longitud de los niveles.
- **Vista previa del próximo turno con fantasmas (`Shift`):** redundante con las canaletas y el aviso de inmersión, y suma estado de tecla mantenida al input.
- **Deshacer (`Z`):** con *undo* las vidas dejan de significar algo.
- **Límite de turnos por nivel:** el par ya castiga la lentitud a través del puntaje, y un límite pediría otro indicador y otra causa de muerte.
- **Seto mortal y moscas de bonus del original:** castigo arbitrario en un puzzle, y azar que rompe el determinismo.
- **Sin vidas (como Snake):** con `R` libre, la partida podría no terminar nunca si el jugador no completa niveles.
- **Mouse para elegir la casilla destino:** no aporta en una grilla de saltos de una celda y suma estados de hover.
- **Controles táctiles o canvas vertical (más natural para "cruzar"):** requieren cambios de plataforma (`GameCanvas`, proporción 4:3); se simplificó a 14×11 horizontal.
- **Pantalla de victoria propia:** es un cambio de contrato de `GameCallbacks` que merece otra spec.
- **Iframe o script pegado en un `useEffect`:** mismas razones que en las SPEC 05 y 07–09.

---

## Identified risks

| Riesgo | Mitigación |
| --- | --- |
| `cruce` queda `playable = true` sin motor en el registro (o al revés), y el ranking acepta puntajes de la arena falsa o el modal ofrece guardar y RLS rechaza | El paso 8 fija el orden: registro primero, migración después. Hay criterios de aceptación sobre las dos condiciones. |
| `sort_order = 13` ya está ocupado (por ejemplo, por otro juego del jam) y la migración falla por la restricción de unicidad | El paso 8 consulta los `sort_order` existentes antes de aplicar y ajusta el valor y el criterio de aceptación si hace falta. |
| Un nivel diseñado a mano es irresoluble o trivial | `validateLevel` + `solveLevel` en el paso 3, con el rango de óptimo `10..60` como criterio; se ajusta el patrón, nunca las reglas. |
| El solver tarda más de lo aceptable al cargar un nivel (peor caso 64.680 estados × 5 acciones) y bloquea el hilo | Se mide en el paso 3. Si supera 16 ms: se precalcula el óptimo con el mismo solver en desarrollo y se guarda como `optimum` en `LevelDef`, con un criterio extra que compara ambos en el paso 3. El par sigue saliendo del solver. |
| El motor y el solver divergen (el par es inalcanzable o regalado) | Hay una sola `resolveTurn` pura usada por los dos; queda prohibido duplicar reglas en `engine.ts`. |
| La rana "atraviesa" un auto o muere sin explicación visible por el orden de resolución | Las fases A → B están definidas y la interpolación de la animación muestra el auto llegando a la celda; hay criterio explícito sobre el cruce en horizontal. |
| Los carriles que dan la vuelta "saltan" de un borde al otro durante la interpolación | El render dibuja las celdas que cruzan el borde en los dos lados, recortadas al tablero (`ctx.save/clip`). |
| Empates en la cima del ranking entre jugadores que memorizan el óptimo | Aceptado: es un puzzle determinista. El multiplicador por nivel, `FLAWLESS` y `LIFE_BONUS` separan a la mayoría; el desempate es el del ranking existente. |
| Las teclas apretadas durante la animación se pierden o se encadenan sin querer | Buffer de exactamente 1 acción; se vacía en muerte, nivel completado y `resume()`. |
| `onGameOver` se emite dos veces (por ejemplo, morir con la última vida mientras se procesa una acción del buffer, o completar el 12 y procesar otra acción) | `endGame()` pasa `phase` a `gameover` antes de emitir y no hace nada si ya lo estaba; las acciones se ignoran en `gameover`. |
| `R` o `WASD` no se pueden escribir en el modal de guardado | `preventDefault` y `onPress` solo con `!paused && phase !== "gameover"`; hay criterio explícito. |
| React Strict Mode monta, desmonta y vuelve a montar el efecto, y deja dos loops o listeners duplicados | `destroy()` cancela el rAF, llama a `input.detach()` y es idempotente; `GameCanvas` lo invoca en el cleanup. |
| Al volver de otra pestaña, un `dt` enorme termina animaciones de golpe o encadena acciones del buffer | `dt` capado a `MAX_DT`, `lastTime = null` en `startLoop`, y la lógica de turnos no depende de `dt` (solo las animaciones). |
| El texto `TURNO · PAR` del canvas se percibe como un HUD duplicado y contradice "el canvas dibuja solo el juego" | Solo se dibuja información que el HUD no tiene; criterio de aceptación sobre lo que **no** se dibuja. |
| Una partida perfecta repetida infla el ranking con valores altísimos | El techo teórico es de ≈ 198.400; la campaña finita lo acota. |
| El puntaje se calcula en el cliente y se puede falsificar | Es el mismo riesgo aceptado en la SPEC 06: la base solo valida la forma. |
| La versión de la migración se ordena antes de las existentes si se toma de la hora local | La versión se lee de `supabase_migrations.schema_migrations` después de aplicar. |
| Canvas borroso en pantallas grandes o retina | Aceptado como límite conocido; HiDPI queda fuera de alcance. |

---

## What is **not** in this spec

- Cambios a RANARIA ni a ningún otro juego del catálogo.
- Un modo en tiempo real, contrarreloj o infinito.
- Más niveles, niveles procedurales, editor, selección de nivel o progreso guardado.
- Deshacer, pistas, solución visible o vista previa con fantasmas.
- Límite de turnos o de tiempo.
- Mecánicas extra del Frogger original (cocodrilos, serpientes, moscas, varias metas por nivel).
- Sonido, música o control de mute.
- Sprites o assets en `public/`.
- Pantalla de victoria o cualquier cambio en `GamePlayer`, `GameCanvas` y `GameCallbacks`.
- Controles táctiles o por mouse.
- Validación del puntaje en el servidor.
- Cambios de esquema, tablas nuevas o regenerar `database.types.ts`.
- Mover `createInput` a un módulo compartido.
- HiDPI, canvas con otra proporción o pantalla completa.
- Tests automatizados de cualquier tipo.

Cada uno de estos, si se necesita, va en su propia spec.
