# SPEC — CHARCA (game jam)

> **Status:** Draft
> **Depends on:** SPEC 05 (asteroids-game), SPEC 06 (games-table-and-leaderboard)
> **Date:** 2026-10-07
> **Objective:** Agregar CHARCA como juego nuevo de la galería (entrada propia en `games`, motor TypeScript escrito desde cero), un cruce de carretera y río al estilo Frogger donde la rana del jugador le disputa los nenúfares a una rana rival controlada por la CPU, con su ranking en Supabase y sin tocar RANARIA ni DUELO PIXEL.
> **Game jam:** "Cruza la carretera y el río sin convertirte en papilla" — ángulo: versus contra la CPU

---

## Por qué existe esta spec

Arcade Vault es una galería que crece: cada juego nuevo **suma** una entrada. El tema del jam pide cruzar una carretera y un río sin morir, y el ángulo asignado lo vuelve un duelo: dos ranas cruzan **el mismo** tablero al mismo tiempo y compiten por los **mismos** cinco nenúfares. El tema está en la mecánica y no solo en la estética: el recurso escaso por el que se compite es el lugar en la orilla de llegada, y la única forma de ganarlo es cruzar la carretera y el río más rápido y con menos muertes que la rival. Si se cambia el tema, las reglas dejan de tener sentido.

Cinco puntos de esta spec no son obvios:

- **No hay código fuente que portar.** No existe `resources/started-games/` de Frogger. Las reglas (carriles, velocidades, troncos, colisiones, IA, puntaje) se **definen aquí**, como en la SPEC 09, y por eso la sección de Decisiones es larga.
- **RANARIA y DUELO PIXEL no se tocan.** `ranaria` es un placeholder del catálogo (`cover-rana`, `playable = false`, `sort_order = 7`) cuya descripción es un Frogger, y `duelo-pixel` es el placeholder VERSUS. Los dos siguen con arena falsa. CHARCA es una entrada nueva, con slug, `sort_order` y cover propios (regla de galería, igual que con SERPENTINA en la SPEC 09).
- **"Versus" sin segundo jugador humano.** La plataforma es de una sola persona con teclado y sin backend extra, así que la rival es una **IA local** dentro del motor. El diseño de la IA es el corazón de la spec: tiene que ser **justa** (mismas reglas físicas que el jugador, nunca salta a una muerte segura, reacciona más lento que un humano atento) y **escalar por ronda** con parámetros numéricos explícitos.
- **El ranking es solo del jugador.** El puntaje que se guarda es el acumulado de la rana del jugador. La CPU no tiene puntaje ni vidas: si muere, reaparece. Su progreso se ve solo en los nenúfares que ocupa.
- **Cómo termina una partida.** El HUD de la plataforma muestra nivel (= ronda) y vidas (`onLives`). La partida termina **exactamente una vez** por la primera de dos causas: el jugador se queda sin vidas, o la CPU gana una ronda (es el "rey de la charca": el jugador sigue mientras gane). La CPU se vuelve más hábil cada ronda, así que toda partida termina.

---

## Scope

**In:**

- Migración de datos `supabase/migrations/<version>_add_charca_game.sql` que inserta la fila `charca` en `games` con `playable = true`. Sin cambios de esquema ni de `lib/supabase/database.types.ts`.
- `lib/games/charca/` (TypeScript puro, sin React ni `next/*`): `constants.ts`, `lanes.ts`, `frog.ts`, `cpu.ts`, `input.ts`, `render.ts` y `engine.ts` (`createCharcaGame`).
- Registro en `lib/games/registry.ts`: `charca: createCharcaGame`.
- `app/globals.css`: clase de cover `.cover-charca` en CSS puro, visualmente distinta de `.cover-rana` y de `.cover-duelo`.
- `GAMES.md`: fila en la tabla resumen y sección del juego (controles y reglas tomados del código, como pide la skill `arcade-vault-game`).
- Verificación de RLS contra la API REST con la publishable key, y limpieza de las filas de prueba.

**Out of scope (para specs futuras):**

- Cualquier cambio a RANARIA (`ranaria`) o DUELO PIXEL (`duelo-pixel`): siguen con arena falsa y `playable = false`.
- Modo de dos jugadores humanos (local en un mismo teclado u online). Online exige backend; local exige repartir el teclado y cambiar el HUD (dos puntajes).
- Puntaje, vidas o ranking de la CPU.
- Colisión entre ranas (empujones, saltar encima de la rival, "robar" el tronco).
- Tortugas que se sumergen, cocodrilos, serpientes, moscas de bonus, nenúfares que se mueven y demás mecánicas del Frogger original.
- Una IA que bloquee activamente al jugador o que lea su input.
- Selector de dificultad, modo práctica o modo sin CPU.
- Sonido y música.
- Sprites o assets binarios: todo se dibuja con canvas (no hay `public/games/charca/`).
- Textos dentro del canvas ("RONDA 2", "GANASTE", "GAME OVER"): la plataforma muestra nivel y fin de juego.
- Pantalla de victoria, pantalla entre rondas con texto, o cualquier cambio en `GamePlayer` / `GameCallbacks`.
- Controles táctiles; el aviso "REQUIERE TECLADO" de `GameCanvas` ya cubre el caso. Tampoco hay control por mouse.
- Mover `createInput` a un módulo compartido `lib/games/input.ts` (sería la quinta copia).
- Soporte HiDPI/retina del canvas y canvas con proporción distinta de 4:3.
- Validación del puntaje en el servidor (antitrampa).
- Cambios de esquema, nuevas tablas o regenerar `database.types.ts`.
- Tests automatizados: el proyecto sigue sin test runner configurado.

---

## Data model

**Fila nueva en `public.games`** (la inserta la migración; el resto de columnas toma sus valores por defecto):

```sql
insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order) values
('charca', 'CHARCA',
 'Dos ranas, cinco nenúfares: ganale la charca a la CPU.',
 'Tu rana y una rival de la CPU cruzan la misma carretera y el mismo río al mismo tiempo. Saltá con las flechas o con WASD, esquivá los autos, subite a los troncos y ocupá los nenúfares antes que ella: el primero en tomar tres gana la ronda. Cada ronda la rival es más rápida. Si perdés una ronda o te quedás sin vidas, la partida termina.',
 'VERSUS', 'cover-charca', 'yellow', true, 14);
```

Estado esperado antes de la migración: 11 juegos (los 8 del seed más `tetris`, `arkanoid` y `snake`), con `rocas`, `tetris`, `arkanoid` y `snake` en `playable = true` y `sort_order` del 1 al 11. Después: 12 juegos, con `charca` también jugable. `sort_order = 14` es el que asignó el brief del jam (12 y 13 quedaron reservados para los otros dos diseños); un hueco en la secuencia es válido porque la columna solo es única. Se confirma contra la base antes de aplicar. Si para entonces se agregó otro juego, los conteos de los criterios se ajustan (+1 sobre el estado real).

**Constantes del motor (`lib/games/charca/constants.ts`)**, definidas en esta spec:

- Canvas: `W = 800`, `H = 600`; origen arriba a la izquierda.
- Grilla vertical: `ROW_H = 50`, `ROWS = 12`. Fila `0` arriba, fila `11` abajo. El centro vertical de la fila `r` es `r * 50 + 25`.
- Paso horizontal: `HOP_X = 50`. La `x` de una rana es continua (los troncos la arrastran), pero cada salto lateral la mueve exactamente 50 px. Límite de salto: `x` se recorta a `[25, 775]`.
- Filas del tablero:
  - Fila `0`: **meta**, un seto con 5 nenúfares.
  - Filas `1`–`5`: **río** (5 carriles de troncos y tortugas).
  - Fila `6`: **orilla del medio** (segura).
  - Filas `7`–`10`: **carretera** (4 carriles de vehículos).
  - Fila `11`: **orilla de salida** (segura).
- Nenúfares: `LILY_COUNT = 5`, centros `LILY_X = [100, 250, 400, 550, 700]`, radio dibujado `30`, tolerancia de llegada `LILY_CATCH_PX = 35` (la rana entra a un nenúfar si `|x − centro| ≤ 35`).
- Ronda: `LILIES_TO_WIN = 3` (mayoría de 5; no hay empates posibles).
- Ranas: hitbox de carretera `FROG_HALF_W = 15` px; tamaño dibujado `36` px. Inicio del jugador `PLAYER_START_X = 275`, inicio de la CPU `CPU_START_X = 525`, ambas en la fila `11`. Color jugador `#f5ff00`, color CPU `#ff006e`.
- Salto: instantáneo, con enfriamiento `HOP_COOLDOWN_MS = 110` (igual para las dos ranas). Se guarda como máximo `MAX_BUFFERED_HOPS = 1` salto pendiente del jugador durante el enfriamiento.
- Tiempo de cruce: `CROSS_TIME_S = 30` por intento, para las dos ranas. Al llegar a 0 la rana muere.
- Reaparición tras morir: `RESPAWN_DELAY_S = 1.0` (las dos ranas). Tras ocupar un nenúfar, la rana reaparece en su inicio sin espera.
- Transición entre rondas: `ROUND_CLEAR_S = 1.5` (todo congelado, los nenúfares parpadean en el color del ganador).
- Vidas: `LIVES_START = 3`, `LIVES_MAX = 5`, `+1` por ronda ganada (sin pasar de 5).
- Puntaje del jugador (siempre entero, nunca resta):
  - `HOP_POINTS = 10` por cada fila **nueva** alcanzada en el intento actual (subir, bajar y volver a subir no suma dos veces).
  - `LILY_POINTS = 200` por ocupar un nenúfar, más `TIME_BONUS_PER_S = 10` por cada segundo entero restante del tiempo de cruce (`floor`).
  - `BLOCK_POINTS = 150` extra si el nenúfar ocupado era el objetivo actual de la CPU y la CPU estaba en la fila `6` o más arriba (ya había cruzado la carretera).
  - `ROUND_WIN_POINTS = 500 × ronda` al ganar una ronda.
  - `SWEEP_BONUS = 1000` extra si el jugador gana la ronda con la CPU en 0 nenúfares.
- Velocidad de carriles por ronda: `laneSpeedMul(round) = min(1 + 0.1 × (round − 1), 1.8)` (tope en la ronda 9).
- Loop: `MAX_DT = 0.05` s.

**Carriles (`lib/games/charca/lanes.ts`, tabla `LANES`)**. Cada carril repite un objeto de largo `length` separado por `gap`, con período `length + gap`; `dir = 1` va a la derecha y `-1` a la izquierda; `speed` en px/s a ronda 1; `phase` es el desplazamiento inicial en px.

| Fila | Tipo | `dir` | `speed` | `length` | `gap` | `phase` |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `log` | 1 | 70 | 200 | 150 | 0 |
| 2 | `turtle` | -1 | 60 | 100 | 150 | 40 |
| 3 | `log` | 1 | 100 | 250 | 200 | 120 |
| 4 | `log` | -1 | 50 | 150 | 150 | 60 |
| 5 | `turtle` | 1 | 55 | 150 | 150 | 0 |
| 7 | `truck` | -1 | 60 | 100 | 250 | 0 |
| 8 | `car` | 1 | 110 | 50 | 250 | 100 |
| 9 | `car` | -1 | 80 | 50 | 200 | 50 |
| 10 | `car` | 1 | 50 | 50 | 230 | 0 |

- Posición de los objetos: `offset(t) = mod(phase + dir × speed × mul × t, length + gap)` con `mod` siempre positivo; los objetos del carril empiezan en `x = offset − (length + gap) + k × (length + gap)` para los `k` que cubren `[−(length + gap), W + length + gap]`. Es una función pura del tiempo de ronda: sirve para dibujar, para colisionar y para que la CPU **prediga** el futuro sin simular estado.
- Plataforma (río): la rana está a salvo si su centro `x` cae en `[objX + 5, objX + length − 5]` de algún objeto del carril.
- Vehículo (carretera): la rana muere si `[x − 15, x + 15]` se superpone con `[objX + 4, objX + length − 4]`.
- Los carriles se reinician (tiempo de ronda en 0) al empezar cada ronda.

**Perfil de la CPU por ronda (`cpuProfileFor(round)` en `cpu.ts`):**

| Parámetro | Fórmula | Ronda 1 | Ronda 5 | Tope |
| --- | --- | --- | --- | --- |
| `reactionMs` (cada cuánto decide) | `max(180, 420 − 40 × (round − 1))` | 420 | 260 | 180 (ronda 7) |
| `lookaheadS` (cuánto futuro mira) | `min(0.7, 0.25 + 0.075 × (round − 1))` | 0.25 | 0.55 | 0.7 (ronda 7) |
| `hesitation` (prob. de dudar) | `max(0.05, 0.3 − 0.04 × (round − 1))` | 0.30 | 0.14 | 0.05 (ronda 7) |
| `startDelayS` (ventaja inicial del jugador) | `max(0.3, 1.0 − 0.1 × (round − 1))` | 1.0 | 0.6 | 0.3 (ronda 8) |

**Estado del motor (en el closure de `createCharcaGame`):**

```ts
type GameState = "playing" | "roundClear" | "gameover"; // más un flag interno `paused`
type Owner = "player" | "cpu";
type Move = "up" | "down" | "left" | "right" | "wait";
type DeathCause = "car" | "water" | "drift" | "hedge" | "taken" | "timeout";
type LaneKind = "car" | "truck" | "log" | "turtle";

interface Lane { row: number; kind: LaneKind; dir: 1 | -1; speed: number; length: number; gap: number; phase: number }

interface Frog {
  owner: Owner;
  x: number;            // centro en px, continuo
  row: number;          // 0..11
  alive: boolean;
  respawnTimer: number; // s; > 0 mientras está muerta
  crossTimer: number;   // s restantes del intento
  bestRow: number;      // fila más alta alcanzada en el intento (para HOP_POINTS)
  hopCooldown: number;  // ms
}

interface CpuProfile { reactionMs: number; lookaheadS: number; hesitation: number; startDelayS: number }
interface CpuBrain { profile: CpuProfile; targetLily: number; thinkTimer: number; startDelay: number }

type Lilies = (Owner | null)[]; // largo 5
// Además: roundTime (s), round, lives, score, roundClearTimer, winner: Owner | null,
// player: Frog, cpu: Frog, brain: CpuBrain, bufferedHop: Move | null, rng: () => number.
```

**Reglas del juego:**

- Las dos ranas empiezan cada intento en la fila `11` (jugador en `x = 275`, CPU en `x = 525`) con `crossTimer = 30`. La CPU espera `startDelayS` al empezar cada ronda (no tras morir).
- Un salto mueve una fila arriba/abajo (misma `x`) o 50 px a izquierda/derecha (misma fila). No se puede bajar de la fila `11`. La `x` se recorta a `[25, 775]` al saltar.
- Las ranas **no colisionan entre sí**: pueden compartir celda, tronco o carril.
- En el río (filas `1`–`5`), la rana viaja con la plataforma sobre la que está (`x += dir × speed × mul × dt`). Si su centro no está sobre ninguna plataforma, muere (`water`). Si la plataforma la arrastra fuera de `[0, 800]`, muere (`drift`).
- En la carretera (filas `7`–`10`), si el hitbox se superpone con un vehículo, muere (`car`).
- Al saltar a la fila `0`: si `|x − centro| ≤ 35` de un nenúfar **libre**, lo ocupa con su color y reaparece en su inicio; si ese nenúfar ya está ocupado (por cualquiera de las dos), muere (`taken`); si no está cerca de ningún nenúfar, muere contra el seto (`hedge`). Así el jugador **bloquea** a la rival ocupando antes el nenúfar al que iba.
- Si el `crossTimer` llega a 0, la rana muere (`timeout`). Se reinicia al reaparecer y al ocupar un nenúfar.
- Muerte del jugador: pierde 1 vida (`onLives`), queda `RESPAWN_DELAY_S` fuera de juego (la CPU sigue jugando) y reaparece. Si las vidas llegan a 0, la partida termina.
- Muerte de la CPU: no pierde nada más que tiempo; reaparece tras `RESPAWN_DELAY_S`. Tiene intentos infinitos.
- Orden dentro de cada cuadro: avanzar `roundTime` → arrastrar ranas sobre plataformas → salto del jugador → decisión de la CPU → resolver al **jugador** → resolver a la CPU. Si las dos llegan al mismo nenúfar libre en el mismo cuadro, gana el jugador.
- La ronda se decide en el momento en que alguna rana suma **3 nenúfares**:
  - Gana el jugador: suma `500 × ronda` (+ `SWEEP_BONUS` si la CPU tiene 0), `+1` vida hasta 5, estado `roundClear` durante 1.5 s, y luego empieza la ronda siguiente (`onLevel(round + 1)`): nenúfares vacíos, ranas en el inicio, carriles reiniciados, perfil de la CPU recalculado.
  - Gana la CPU: la partida termina de inmediato con `onGameOver(score)`.
- La partida termina exactamente una vez, por la primera de: vidas en 0 o ronda ganada por la CPU.

**IA de la CPU (`cpu.ts`, funciones puras con `rng` inyectado):**

- **Objetivo:** el nenúfar libre más cercano a su `x` actual. Si el objetivo se ocupa (por el jugador), elige otro en la siguiente decisión.
- **Ritmo:** decide una vez cada `reactionMs` (acumulador con `dt`), y solo si está viva, terminó su `startDelay` y su `hopCooldown` es 0. Nunca salta más rápido que el jugador.
- **Candidatos:** `up`, `left`, `right`, `down`, `wait`. Se descartan los que salen del tablero. Desde la fila `1`, `up` solo es candidato si aterriza dentro de la tolerancia de un nenúfar **libre** (nunca salta al seto ni a uno ocupado).
- **Seguridad (`isSafeFor`):** para cada candidato predice la posición de aterrizaje y la verifica en `t = 0` y luego cada 0.05 s hasta `lookaheadS` (posiciones de carril con `offset(t)`, y deriva de la rana si está en el río). `t = 0` siempre se verifica: **la CPU nunca salta a una muerte inmediata** (no es suicida). Con `lookaheadS` corto puede saltar a algo que la mata medio segundo después: así se equivoca en las primeras rondas.
- **Elección:** entre los candidatos seguros, el de menor costo `row × 1000 + |x − LILY_X[target]|`; en empate, `up` > lateral hacia el objetivo > `wait` > `down`.
- **Duda:** con probabilidad `hesitation` elige `wait`, **salvo** que quedarse quieta no sea seguro dentro del `lookaheadS`; en ese caso elige el mejor candidato seguro.
- **Sin salida:** si ningún candidato es seguro, elige `wait`.
- La CPU **no lee** el input ni la posición del jugador; lo único que la afecta del jugador es que le ocupe nenúfares.

**Teclado (`lib/games/charca/input.ts`)**: copia de `lib/games/snake/input.ts` (`createInput(shouldCapture, onPress, captureKeys)`). Flechas y `WASD` son "recién apretadas" (se ignora el auto-repeat): una pulsación = un salto. Si el jugador está en enfriamiento, se guarda como máximo 1 salto pendiente; si está muerto o en `roundClear`, la pulsación se descarta. `captureKeys`: flechas, `Space` y `WASD`, con `preventDefault` solo si `!paused && state !== "gameover"`. `Space` no hace nada en el juego; se captura solo para que no haga scroll.

**Layout del canvas (800×600):**

- Fila `0` (y 0–50): seto verde oscuro con 5 nenúfares verdes; un nenúfar ocupado muestra una rana pequeña del color del dueño (amarilla o magenta).
- Filas `1`–`5` (y 50–300): agua azul oscura con troncos marrones y grupos de tortugas (círculos verdes, uno por cada 50 px de largo).
- Fila `6` (y 300–350): orilla violeta oscura.
- Filas `7`–`10` (y 350–550): asfalto gris oscuro con líneas discontinuas; autos de 50 px y camiones de 100 px, con colores neon por carril.
- Fila `11` (y 550–600): orilla de salida. En su borde inferior, dos barras de 6 px de alto con el tiempo de cruce restante: la del jugador (amarilla) ocupa la mitad izquierda y la de la CPU (magenta) la derecha.
- Ranas: cuerpo redondeado de 36 px con dos ojos; la CPU es magenta y además tiene un contorno blanco de 2 px para distinguirla aunque las dos compartan celda. Una rana muerta se dibuja como una mancha aplastada de su color durante `RESPAWN_DELAY_S`.
- Durante `roundClear` todo se congela y los nenúfares parpadean (4 Hz) en el color del ganador.
- El canvas **no** dibuja puntaje, nivel, vidas, ronda, `PAUSA`, `GAME OVER` ni textos de ningún tipo.

**Contrato de eventos del motor:**

- Al crearse y en cada `restart()`, el motor emite `onScore(0)`, `onLevel(1)` y `onLives(3)`.
- `onScore`, `onLevel` y `onLives` se emiten solo cuando el valor cambia. `onLevel` = número de ronda.
- `onGameOver(finalScore)` se emite una sola vez por partida, de inmediato, al quedar el jugador sin vidas o al ganar la CPU una ronda.

---

## Implementation plan

Antes de escribir código, consultar la guía de Next.js 16 en `node_modules/next/dist/docs/` (según `AGENTS.md`) y la skill `arcade-vault-game`. Si `node_modules/` no existe, instalar dependencias primero. Cada paso deja la app compilando y las pantallas existentes funcionando. Verificaciones estáticas por paso: `npm run lint` y `npx tsc --noEmit`; no se ejecuta ningún build.

1. **Constantes y carriles.** Crear `lib/games/charca/constants.ts` con todos los valores del Data model y `lanes.ts` con la tabla `LANES` y funciones puras: `mod(a, n)`, `laneSpeedMul(round)`, `laneOffset(lane, roundTime, mul)`, `laneObjectsAt(lane, roundTime, mul)` (lista de `x` iniciales visibles), `laneAt(row)`. Prueba: lint y `tsc --noEmit`.
2. **Input.** Crear `lib/games/charca/input.ts` copiando `lib/games/snake/input.ts` (`attach`/`detach` en `window`, `Space` cancelado también en `keyup`). Prueba: lint y `tsc --noEmit`.
3. **Física de la rana.** Crear `lib/games/charca/frog.ts` con funciones puras: `createFrog(owner)`, `hopTarget(frog, move)` (fila/`x` de aterrizaje con recorte), `driftX(frog, roundTime, mul, dt)`, `isOnPlatform(x, lane, roundTime, mul)`, `hitsVehicle(x, lane, roundTime, mul)`, `lilyAt(x)` (índice o `null`) y `resolveFrog(frog, lilies, roundTime, mul)` que devuelve `{ kind: "safe" } | { kind: "dead"; cause: DeathCause } | { kind: "lily"; index: number }`. Sin canvas ni estado propio. Prueba: lint y `tsc --noEmit`.
4. **IA de la CPU.** Crear `lib/games/charca/cpu.ts` con `cpuProfileFor(round)`, `pickTargetLily(x, lilies)`, `isSafeFor(landing, lookaheadS, roundTime, mul, lilies)` y `chooseCpuMove(cpu, brain, lilies, roundTime, mul, rng): Move`, que implementan exactamente las reglas de "IA de la CPU". `rng` es un parámetro (`() => number`), nunca `Math.random` adentro. Prueba: lint y `tsc --noEmit`.
5. **Render.** Crear `lib/games/charca/render.ts` con `drawFrame(ctx, frame)`: fondo por zonas, carriles (troncos, tortugas, autos, camiones), nenúfares con su dueño, las dos ranas (o sus manchas), barras de tiempo de cruce y parpadeo de `roundClear`. Sin textos. Prueba: lint y `tsc --noEmit`.
6. **Motor.** Crear `lib/games/charca/engine.ts` con `createCharcaGame` (`GameEngineFactory`): estado en el closure; `initGame()` (emite `onScore(0)`, `onLevel(1)`, `onLives(3)`); `startRound(n)` (nenúfares vacíos, ranas al inicio, `roundTime = 0`, perfil de CPU); salto del jugador con enfriamiento y buffer de 1; acumulador de decisiones de la CPU; resolución en el orden fijado (jugador antes que CPU); puntaje, bloqueo, vidas, `roundClear` y `endGame()` que cambia el estado **antes** de emitir `onGameOver`; loop de `requestAnimationFrame` cancelable con `dt` capado a `MAX_DT` y `dt = 0` en el primer cuadro; `pause()`, `resume()` (descarta el salto pendiente y reinicia `lastTime`), `restart()` y `destroy()` (idempotente, cancela el rAF y llama a `input.detach()`). Prueba manual en `npm run dev` con el motor registrado de forma temporal **sin commitear**: medir con el jugador quieto cuánto tarda la CPU en ganar la ronda 1, y ajustar solo las constantes de `cpuProfileFor` si sale del rango de los criterios. Prueba: lint y `tsc --noEmit`.
7. **Cover.** Agregar `.cover-charca` en `app/globals.css` (CSS puro, tokens existentes): fondo verde-azulado oscuro; arriba una fila de 5 nenúfares verdes (dos con un punto amarillo `#f5ff00` y uno con un punto magenta `#ff006e`); al centro una franja azul con dos troncos marrones; abajo una franja gris con línea discontinua y dos ranas pequeñas, una amarilla y una magenta, lado a lado. Glow amarillo con `drop-shadow`. Distinta de `.cover-rana` (franjas cian y un círculo verde). Prueba manual: asignar la clase de forma temporal a un elemento `.cover-bg` y revisarla en 375 px y en desktop; el elemento temporal no se commitea.
8. **Registro y migración, en este orden.** Primero agregar `charca: createCharcaGame` en `lib/games/registry.ts`. Después consultar `select id, sort_order from public.games order by 2`, aplicar con `apply_migration` el insert del Data model (nombre `add_charca_game`), leer la versión real asignada (`select version, name from supabase_migrations.schema_migrations order by version desc limit 1`) y guardar el mismo SQL en `supabase/migrations/<version>_add_charca_game.sql`. Verificar con `execute_sql`: 12 filas en `games`, `charca` jugable, `ranaria` y `duelo-pixel` con `playable = false`. Prueba manual: `/games` muestra 12 tarjetas y `/games/charca/play` muestra el juego.
9. **Verificación de RLS por REST.** Con `curl` y la publishable key (`apikey` + `Authorization: Bearer`): un `POST /rest/v1/scores` válido para `charca` responde `201`; son rechazados un `score` `0`, un `player_name` de 11 caracteres, un `game_id` inexistente y un `game_id` de un juego no jugable (`ranaria`). Borrar con `execute_sql` las filas de prueba al terminar.
10. **Documentación.** Agregar CHARCA a `GAMES.md` (fila del resumen y sección con ruta, motor, cover, migración, tabla de controles y reglas), tomando los valores del código y no de esta spec. Prueba: releer la sección contra `constants.ts` e `input.ts`.
11. **Pase final de integración.** Recorrer los criterios de aceptación en `npm run dev` (incluido el doble montaje de Strict Mode y la navegación de ida y vuelta), revisar la consola del navegador y correr `npm run lint` y `npx tsc --noEmit`.

---

## Acceptance criteria

**Plataforma y datos:**

- [ ] `games` tiene 12 filas; `charca` tiene `title = 'CHARCA'`, `cat = 'VERSUS'`, `color = 'yellow'`, `cover = 'cover-charca'`, `sort_order = 14` y `playable = true`.
- [ ] `ranaria` y `duelo-pixel` (y el resto de placeholders) conservan exactamente sus valores anteriores, con `playable = false`; solo `rocas`, `tetris`, `arkanoid`, `snake` y `charca` tienen `playable = true`.
- [ ] `list_migrations` muestra `add_charca_game` y `supabase/migrations/` contiene su SQL con la misma versión.
- [ ] `/games` muestra 12 tarjetas, CHARCA aparece en el filtro VERSUS y su cover es distinto del de RANARIA y del de DUELO PIXEL.
- [ ] `/games/charca` muestra el título y la descripción de la base, `—` como mejor marca y `0` como partidas cuando no hay puntajes.
- [ ] `/games/charca/play` muestra un `<canvas>` de 800×600 dentro del marco CRT y no contiene los elementos `.enemy` ni `.player-ship` de la arena falsa.
- [ ] `/games/ranaria/play` sigue mostrando la arena falsa y su modal dice "ESTE JUEGO AÚN NO TIENE RANKING." sin ofrecer guardar.

**Reglas del juego:**

- [ ] La partida arranca con el HUD en puntaje 0, nivel `01` y 3 vidas; la rana amarilla está abajo en `x = 275` y la magenta en `x = 525`, y la magenta no se mueve durante el primer segundo.
- [ ] Cada flecha o tecla `WASD` hace exactamente un salto; mantener la tecla apretada no repite saltos.
- [ ] Desde la fila de salida, `↓`/`S` no hace nada; los saltos laterales no sacan a la rana del canvas.
- [ ] Tocar un auto o camión, caer al agua o ser arrastrada fuera del canvas por un tronco quita una vida y el HUD se actualiza en el momento.
- [ ] Quedarse 30 s sin llegar a un nenúfar mata a la rana y la barra amarilla de tiempo se vacía en ese lapso.
- [ ] Subir a una fila nueva suma 10; bajar y volver a subir a la misma fila en el mismo intento no suma otra vez.
- [ ] Llegar a un nenúfar libre suma `200 + 10 × segundos restantes`, lo pinta de amarillo y devuelve a la rana a la salida sin espera.
- [ ] Saltar a un nenúfar ocupado (por la CPU o por el propio jugador) o al seto entre nenúfares quita una vida.
- [ ] Ocupar el nenúfar hacia el que iba la CPU cuando ya cruzó la carretera suma 150 extra, y la CPU cambia de objetivo sin saltar al nenúfar ocupado.
- [ ] Las dos ranas pueden estar en la misma celda o tronco sin afectarse.
- [ ] Al llegar el jugador a 3 nenúfares: suma `500 × ronda` (más 1000 si la CPU tenía 0), gana 1 vida (sin pasar de 5), el juego se congela 1,5 s con los nenúfares parpadeando en amarillo y empieza la ronda siguiente con el HUD en el nivel siguiente, los nenúfares vacíos y los carriles más rápidos.
- [ ] Al llegar la CPU a 3 nenúfares, el modal "FIN DEL JUEGO" se abre exactamente una vez, de inmediato, con el puntaje acumulado.
- [ ] Perder la última vida abre el modal "FIN DEL JUEGO" exactamente una vez, de inmediato, con el puntaje acumulado.
- [ ] El canvas no dibuja puntaje, nivel, vidas, ronda, `PAUSA`, `GAME OVER` ni ningún otro texto.

**IA justa:**

- [ ] Con el jugador sin tocar el teclado, la CPU gana la ronda 1 en un tiempo de entre 25 y 90 s (medido 3 veces), y muere al menos una vez en al menos una de las 3 mediciones.
- [ ] En 3 minutos de observación en ronda 1, la CPU nunca salta sobre un vehículo que ya ocupa la celda de destino ni a un hueco de agua sin plataforma en el instante del salto.
- [ ] La CPU nunca salta al seto ni a un nenúfar ocupado.
- [ ] La CPU nunca encadena dos saltos con menos de 180 ms entre sí (observable con la grabación de rendimiento del navegador o contando saltos con un log temporal no commiteado).
- [ ] Una persona que juega con atención gana la ronda 1 en al menos 2 de 3 intentos.

**Ciclo de vida y plataforma:**

- [ ] Presionar flechas o `Espacio` mientras el juego corre no hace scroll de la página.
- [ ] Con el modal abierto, escribir iniciales (incluidos espacios, flechas y las letras `W`, `A`, `S`, `D`) funciona y no mueve a la rana.
- [ ] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'charca'`, el nombre en mayúsculas y el puntaje final, y el modal muestra "PUNTUACIÓN GUARDADA".
- [ ] Tras guardar, `/games/charca` y la pestaña CHARCA de `/hall-of-fame` muestran ese puntaje, y `best` y `plays` se actualizan.
- [ ] El botón PAUSA y la tecla `P` congelan el juego (ranas, carriles, temporizadores y decisiones de la CPU) y muestran "EN PAUSA"; reanudar continúa sin saltos de posición ni saltos de rana extra.
- [ ] El botón FIN detiene el juego y abre el modal con el puntaje actual.
- [ ] "JUGAR DE NUEVO" deja la partida en puntaje 0, nivel 1, 3 vidas, nenúfares vacíos, ranas en la salida y la CPU con el perfil de la ronda 1.
- [ ] Al salir con SALIR y volver a entrar (y bajo Strict Mode en `npm run dev`), cada tecla produce un solo salto y no quedan listeners de teclado activos fuera de `/games/charca/play`.
- [ ] Volver a la pestaña tras tenerla en segundo plano no mata a ninguna rana ni hace avanzar los carriles de golpe.
- [ ] En un ancho de 375 px el canvas escala sin scroll horizontal y mantiene proporción 4:3; en emulación `pointer: coarse` aparece "REQUIERE TECLADO".
- [ ] ROCAS, TETRIS, ARKANOID y SNAKE se juegan igual que antes.
- [ ] Con la publishable key, un `POST /rest/v1/scores` válido para `charca` responde `201`, y se rechazan `score` `0`, `player_name` de 11 caracteres, `game_id` inexistente y `game_id = 'ranaria'`; las filas de prueba quedan borradas.
- [ ] `rg -n 'from "(react|next)' lib/games/charca/` no devuelve resultados.
- [ ] `git diff` no muestra cambios en `lib/supabase/`, `lib/session-context.tsx`, `components/nav/`, `components/player/`, `lib/games/types.ts`, `resources/` ni `package.json`, y `database.types.ts` no cambió.
- [ ] `GAMES.md` lista CHARCA con controles y reglas que coinciden con el motor.
- [ ] La consola del navegador no muestra errores ni warnings de React durante una partida completa.
- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.

---

## Decisions taken and discarded

**Tomadas:**

- **CHARCA como entrada nueva (`charca`), no sobre RANARIA ni DUELO PIXEL.** Regla de galería: se suma una fila y un cover propio. Costo: el catálogo muestra dos juegos de ranas (uno jugable, uno placeholder).
- **Rival controlada por IA local.** Es la única forma de "versus" que respeta la plataforma (una persona, teclado, sin backend). Costo: toda la dificultad de diseño se concentra en `cpu.ts`, y el balance requiere una pasada manual.
- **Recurso compartido: 5 nenúfares, gana quien toma 3.** Hace que el tema sea la mecánica: cada nenúfar es a la vez un punto propio y uno menos para la rival. Con 5 y mayoría de 3 no hay empates, y la ronda se decide antes de llenar la charca, lo que acorta las rondas. Costo: una ronda puede terminar 3-0 muy rápido si el jugador juega mal.
- **Nenúfar ocupado = muerte para quien llega después.** Es la regla del Frogger clásico y es lo que vuelve real el "bloqueo": llegar primero no solo suma, también obliga a la rival a desviarse. Costo: el jugador también puede morir en un nenúfar que la CPU le ganó por un instante.
- **Ranas sin colisión entre sí.** Evita casos ambiguos (quién empuja a quién, dos ranas en un tronco que se sale) y deja la competencia en la carrera. Costo: se pierde una interacción física que podría ser divertida.
- **Fin de partida: sin vidas o al perder una ronda ("rey de la charca").** La regla es clara para el ranking: el jugador sigue mientras gane, la CPU mejora cada ronda y por lo tanto toda partida termina. Costo: una sola ronda mala termina la partida; se compensa con la ventaja inicial (`startDelayS`) y la CPU lenta de las primeras rondas.
- **La CPU no tiene vidas ni puntaje; muere y reaparece.** Su castigo por morir es el tiempo (1 s de espera + volver a cruzar), que es justo lo que importa en una carrera. Costo: no se puede "ganar" haciéndola morir; solo llegando antes.
- **IA basada en predicción pura de carriles.** Como la posición de cada objeto es función pura del tiempo de ronda, la CPU puede "mirar" `lookaheadS` segundos al futuro sin simular estado, y ese horizonte es la perilla principal de dificultad. Costo: la IA es determinística salvo por `hesitation`, y un jugador atento puede aprender sus patrones.
- **Justicia como invariantes concretos:** mismas reglas físicas, mismo enfriamiento de salto, reacción mínima de 180 ms (más lenta que el enfriamiento de 110 ms del jugador), chequeo obligatorio en `t = 0` (nunca suicida), sin lectura del input del jugador. Costo: en rondas altas la CPU no llega a ser "imbatible", y un experto puede jugar muchas rondas; la velocidad creciente de los carriles es la que pone el techo.
- **Escalado por ronda con fórmulas lineales con tope** (`reactionMs`, `lookaheadS`, `hesitation`, `startDelayS`, `laneSpeedMul`). Son números concretos que se pueden ajustar en un solo archivo. Costo: la curva puede necesitar retoques tras jugar (paso 6).
- **`rng` inyectado en la IA.** Mantiene `cpu.ts` puro y permite reproducir una decisión pasando un generador fijo durante el ajuste. El motor usa `Math.random` como fuente.
- **Jugador antes que CPU en la resolución del cuadro.** Desempata de forma predecible la llegada simultánea a un nenúfar, a favor de la persona.
- **Tiempo de cruce de 30 s para las dos ranas.** Además de presionar al jugador, garantiza que ninguna rana se quede atascada para siempre: aunque la IA tuviera un bug, las muertes por tiempo del jugador terminan la partida.
- **Puntaje que nunca resta y premia la velocidad y el bloqueo.** `HOP_POINTS` da progreso desde el primer salto, el bonus de tiempo premia cruzar rápido, `BLOCK_POINTS` premia la jugada versus y `ROUND_WIN_POINTS` crece con la ronda para que llegar lejos domine el ranking. Valores enteros muy por debajo de 99.999.999.
- **Vidas visibles en el HUD (`onLives`), +1 por ronda ganada, tope 5.** Las muertes son frecuentes en un Frogger; tres vidas con recarga por ronda hacen que las muertes castiguen sin terminar la partida a los dos minutos.
- **Salto instantáneo con enfriamiento y buffer de 1.** Más simple de colisionar que un salto animado entre celdas, y el buffer evita perder pulsaciones rápidas sin acumular teclas viejas.
- **`x` continua y paso lateral de 50 px.** Los troncos arrastran a la rana a posiciones intermedias, como en el original; los nenúfares de 100 px de ancho visual con tolerancia de 35 px hacen que llegar sea preciso pero no injusto. Desde los inicios (275 y 525) todos los nenúfares quedan a 25 px de una columna alcanzable.
- **Todo dibujado con canvas, sin assets.** No hay sprites con licencia clara para un Frogger, y las formas simples encajan con la estética neon del portal.
- **`WASD` además de flechas, sin mouse.** Igual que SNAKE; el mouse no aporta a un juego de saltos discretos.
- **Una copia propia de `input.ts`.** Promoverlo a módulo compartido toca juegos implementados; queda fuera.
- **`sort_order = 14` tal como lo asignó el brief**, aunque deje huecos (12 y 13) si este diseño gana solo. La columna es única, no consecutiva.
- **Versión de la migración tomada de Supabase** y **registro antes que migración**, por las mismas razones de las SPEC 07, 08 y 09.
- **Verificación de tipos con `npx tsc --noEmit`** además de lint, porque ESLint no detecta errores de tipos.

**Descartadas:**

- **Activar `ranaria` o `duelo-pixel`:** reemplazaría una entrada existente de la galería.
- **Dos jugadores humanos en el mismo teclado:** cambia el HUD (dos puntajes), el guardado (¿de quién es el puntaje?) y el contrato de `GameCallbacks`; es un cambio de plataforma, no de motor.
- **Versus online:** exige backend en tiempo real, fuera de las restricciones.
- **Gana quien tiene más nenúfares al final de un tiempo fijo:** obliga a resolver empates y alarga rondas ya decididas. La mayoría de 3 sobre 5 lo evita.
- **Perder una ronda cuesta una vida (en vez de terminar la partida):** mezcla dos recursos en el mismo contador y hace que el HUD de vidas sea difícil de leer; además la partida podría alargarse mucho perdiendo rondas.
- **CPU con lectura del jugador o que bloquea activamente:** se siente injusta (la CPU "sabe" a dónde vas) y es mucho más difícil de balancear.
- **CPU con trayectoria precalculada (A* sobre el tiempo):** sería casi perfecta e imbatible, justo lo que el brief pide evitar, y más cara de implementar.
- **CPU con errores al azar que la hacen saltar a muertes seguras:** se ve tonta, no humana. La CPU se equivoca por mirar poco al futuro, no por suicidarse.
- **Colisión entre ranas (empujar o aplastar a la rival):** abre casos ambiguos y una forma de ganar que no es cruzar.
- **Tortugas que se sumergen, cocodrilos, moscas de bonus:** mecánicas extra para otra spec; con las dos ranas ya hay suficiente lectura del tablero.
- **Salto animado entre celdas:** más lindo, pero obliga a decidir colisiones durante el vuelo.
- **Texto "RONDA N" o "GANASTE" en el canvas:** la plataforma muestra el nivel; el parpadeo de los nenúfares alcanza como indicador.
- **Puntaje negativo por morir:** el `CHECK` exige `score ≥ 1` y restar complica el ranking sin aportar.
- **Controles táctiles u otra proporción de canvas:** requieren cambiar la plataforma.
- **Iframe a una página suelta o pegar un script en un `useEffect`:** mismas razones que en las SPEC 05, 07, 08 y 09.

---

## Identified risks

| Riesgo | Mitigación |
| --- | --- |
| La IA queda mal balanceada: demasiado torpe (aburre) o demasiado buena (frustra) | Parámetros concentrados en `cpuProfileFor` y `laneSpeedMul`; el paso 6 incluye una medición con el jugador quieto y criterios con rangos concretos (25–90 s para ganar la ronda 1, el jugador gana 2 de 3). |
| La CPU se queda atascada (oscila entre `left` y `right`, o espera para siempre en la orilla del medio) y la ronda no termina | Costo con desempate fijo (`up` > lateral hacia el objetivo > `wait` > `down`); `crossTimer` de 30 s también para la CPU, que la fuerza a reaparecer; las muertes por tiempo del jugador garantizan el fin de la partida aun con un bug de la IA. |
| `mod` negativo en carriles con `dir = -1` hace saltar o desaparecer objetos | `mod(a, n) = ((a % n) + n) % n` en `lanes.ts`, usado tanto en render como en colisiones y en la predicción de la CPU. |
| Render, colisión y predicción usan posiciones distintas de los objetos y la CPU "ve" un tronco que no está | Una sola función pura (`laneObjectsAt`) alimenta los tres usos; la CPU predice llamándola con `roundTime + t`. |
| Efecto túnel: con `dt` grande un auto atraviesa a la rana sin colisionar | `MAX_DT = 0.05`; la velocidad máxima es 110 × 1,8 = 198 px/s, o sea ≈ 10 px por cuadro, menos que el hitbox de 30 px. |
| La rana sobre un tronco que sale del canvas muere "injustamente" sin aviso | Regla explícita (`drift`) y la rana se dibuja hasta el borde; la CPU usa el mismo chequeo dentro de su `lookaheadS`. |
| Las dos ranas llegan al mismo nenúfar en el mismo cuadro | Orden fijo de resolución: jugador primero; la CPU, al resolver, encuentra el nenúfar ocupado y muere (`taken`). Criterio sobre el bloqueo. |
| `onGameOver` se emite dos veces (por ejemplo, la CPU gana la ronda en el mismo cuadro en que el jugador pierde su última vida) | `endGame()` cambia el estado a `gameover` antes de emitir y no hace nada si ya lo estaba; el jugador se resuelve primero. Criterios de "exactamente una vez". |
| Al volver de otra pestaña, `roundTime` y los temporizadores saltan y matan a las ranas | `dt` capado a `MAX_DT`, `startLoop()` reinicia `lastTime` y `resume()` descarta el salto pendiente; criterio explícito. |
| `pause()` no congela el acumulador de decisiones de la CPU y esta "salta" al reanudar | Todo avanza solo dentro de `update(dt)`; con el loop detenido no hay `dt`. Criterio de pausa sin saltos extra. |
| La transición `roundClear` se dispara mientras el jugador está muerto o con un salto en el buffer | Al entrar en `roundClear` se descartan el buffer y los `respawnTimer`; `startRound` recrea las ranas. |
| React Strict Mode monta dos veces y deja dos loops o listeners duplicados | `destroy()` idempotente, cancela el rAF y llama a `input.detach()`; criterio explícito. |
| Las letras `W`, `A`, `S`, `D` no se pueden escribir en el modal de guardado | `preventDefault` solo mientras `!paused && state !== "gameover"`; criterio explícito. |
| `charca` queda `playable = true` sin motor en el registro (o al revés) | Paso 8: registro primero, migración después; criterios sobre las dos condiciones. |
| `sort_order = 14` ya está ocupado (por otro diseño del jam implementado antes) y la migración falla por unicidad | El paso 8 consulta los `sort_order` existentes antes de aplicar y ajusta el valor y los criterios si hace falta. |
| La CPU en magenta y la rana del jugador en amarillo se confunden cuando comparten celda | Contorno blanco de 2 px en la CPU y barras de tiempo separadas por lado. |
| El puntaje se calcula en el cliente y se puede falsificar | Mismo riesgo aceptado en la SPEC 06: solo hay validación de forma en la base. |
| La versión de la migración se ordena antes de las existentes si se toma de la hora local | La versión se lee de `supabase_migrations.schema_migrations` después de aplicar. |
| Canvas borroso en pantallas grandes o retina | Aceptado como límite conocido; HiDPI queda fuera de alcance. |

---

## What is **not** in this spec

- Cambios a RANARIA, DUELO PIXEL ni a ningún otro juego del catálogo.
- Modo de dos jugadores humanos, local u online.
- Puntaje, vidas o ranking de la CPU.
- Colisión entre ranas.
- Mecánicas extra del Frogger original (tortugas que se sumergen, cocodrilos, moscas, nenúfares móviles).
- IA que lea al jugador o lo bloquee activamente; selector de dificultad.
- Sonido, música o control de mute.
- Sprites o assets binarios.
- Textos en el canvas, pantalla de victoria o cualquier cambio en `GamePlayer` y `GameCallbacks`.
- Controles táctiles o por mouse.
- Cambios de esquema, tablas nuevas o regenerar `database.types.ts`.
- Mover `createInput` a un módulo compartido.
- HiDPI, canvas con otra proporción o pantalla completa.
- Validación de puntajes en el servidor.
- Tests automatizados de cualquier tipo.

Cada uno de estos, si se necesita, va en su propia spec.
