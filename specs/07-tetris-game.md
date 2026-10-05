# SPEC 07 — Juego Tetris jugable en la galería

> **Status:** Approved
> **Depends on:** SPEC 05 (asteroids-game), SPEC 06 (games-table-and-leaderboard)
> **Date:** 2026-10-05
> **Objective:** Agregar TETRIS como juego nuevo de la galería (entrada propia en `games`, motor TypeScript portado de `resources/started-games/03-tetris/`) con su ranking en Supabase, sin tocar CAÍDA.

---

## Por qué existe esta spec

Arcade Vault es una galería que crece: cada juego nuevo **suma** una entrada, no reemplaza una existente. Tras ROCAS (SPEC 05) y el ranking en Supabase (SPEC 06), `resources/started-games/03-tetris/` es el siguiente juego con código fuente real.

El `game.js` original (≈330 líneas, canvas 300×600) no se puede pegar tal cual en Next.js, por las mismas razones que Asteroids: variables globales, `document.getElementById`, listeners de teclado que nunca se remueven, un `requestAnimationFrame` que no se cancela con el desmontaje, y un overlay de pausa y game over propio que duplica el de la plataforma. Además trae un toggle de tema claro/oscuro que no aplica dentro del reproductor.

Tres puntos de esta spec no son obvios:

- **CAÍDA no se toca.** `caida` es una entrada del catálogo con una descripción parecida a la de un Tetris y un cover propio (`cover-tetro`). Seguirá siendo un placeholder (`playable = false`, arena falsa). Reutilizarla para este motor reemplazaría un juego del catálogo en lugar de sumar uno.
- **Tetris no tiene vidas.** Hoy `GamePlayer` inicia las vidas en 3 y siempre muestra `♥ ♥ ♥`. Esta spec hace opcional `onLives` en el contrato común: es el único cambio de plataforma y beneficia a los juegos futuros sin vidas.
- **El código manda sobre el README.** El README habla de 7 piezas, pero `game.js` define una octava, la "N (tuerca)". Se porta el código.

Decisiones ya cerradas con el usuario:

1. **Entrada nueva** `tetris` en `games`; CAÍDA queda intacta.
2. **`onLives` opcional** en `GameCallbacks`; `GamePlayer` oculta el stat de vidas si el motor nunca lo emite.
3. **Port 1:1** de reglas y constantes, incluida la pieza N.
4. **Teclado:** mover, rotar y bajar actúan en cada `keydown` con el auto-repeat del sistema operativo; `Space` (caída instantánea) es una pulsación única.
5. **Layout:** tablero 300×600 centrado en el canvas fijo 800×600, con NEXT y LINES dibujados dentro del canvas. HUD, pausa, game over y guardado los pone la plataforma.

---

## Scope

**In:**

- Migración de datos `supabase/migrations/<version>_add_tetris_game.sql` que inserta la fila `tetris` en `games` con `playable = true`. Sin cambios de esquema ni de `lib/supabase/database.types.ts`.
- `lib/games/tetris/` (TypeScript puro, sin React): `constants.ts`, `board.ts`, `pieces.ts`, `input.ts`, `render.ts` y `engine.ts` (`createTetrisGame`).
- Registro en `lib/games/registry.ts`: `tetris: createTetrisGame`.
- `lib/games/types.ts`: `GameCallbacks.onLives` pasa a opcional.
- `lib/games/asteroids/engine.ts`: las dos llamadas a `callbacks.onLives` pasan a `callbacks.onLives?.(…)`. Sin otros cambios.
- `components/player/GamePlayer.tsx`: el estado de vidas pasa a `number | null` (`null` si el juego tiene motor y aún no emitió vidas; `3` si no tiene motor). El stat "Vidas" solo se renderiza si no es `null`.
- `app/globals.css`: clase de cover `.cover-tetris` en CSS puro, distinta de `.cover-tetro`.
- Verificación de RLS contra la API REST con la publishable key, y limpieza de las filas de prueba.

**Out of scope (para specs futuras):**

- Cualquier cambio a CAÍDA (`caida` sigue con arena falsa y `playable = false`).
- Motores para los demás juegos pendientes (Bloque Buster, Serpentina, Glotón, Invasores, Ranaria, Duelo Pixel).
- Reglas de Tetris modernas: bolsa de 7 piezas, rotación SRS, hold, lock delay, DAS/ARR propios. El original usa piezas al azar uniforme y wall kicks simples.
- Quitar la pieza N o convertir el juego a las 7 piezas clásicas.
- Controles táctiles; el aviso "REQUIERE TECLADO" de `GameCanvas` ya cubre el caso.
- Sonido, música, toggle de tema claro/oscuro del original.
- Soporte HiDPI/retina del canvas y canvas con proporción distinta de 4:3.
- Mover `createInput` a un módulo compartido `lib/games/input.ts` (hoy habría dos copias: la de Asteroids y la de Tetris).
- Cambios de esquema, nuevas tablas o regenerar `database.types.ts`.
- Tests automatizados — el proyecto sigue sin test runner configurado.
- Modificar los archivos de `resources/started-games/03-tetris/`: quedan como referencia intacta.

---

## Data model

**Fila nueva en `public.games`** (la inserta la migración; el resto de columnas toma sus valores por defecto):

```sql
insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order) values
('tetris', 'TETRIS',
 'Encaja las piezas y limpia líneas sin tocar el techo.',
 'Siete piezas clásicas y una tuerca traicionera caen sin pausa. Muévelas, rótalas y limpia líneas para subir de nivel: la velocidad aumenta cada 10 líneas. La pieza fantasma te muestra dónde aterrizará.',
 'PUZZLE', 'cover-tetris', 'cyan', true, 9);
```

Estado actual de la base antes de la migración: 8 juegos, solo `rocas` con `playable = true`. Después: 9 juegos, `rocas` y `tetris` jugables.

**Cambio de contrato (`lib/games/types.ts`):**

```ts
export interface GameCallbacks {
  onScore: (score: number) => void;
  onLives?: (lives: number) => void; // opcional: juegos sin vidas no lo emiten
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

**Constantes del motor (`lib/games/tetris/constants.ts`)**, valores idénticos a `game.js`:

- Tablero: `COLS = 10`, `ROWS = 20`, `BLOCK = 30` (300×600 px).
- Canvas: `W = 800`, `H = 600`; `BOARD_X = 220` (borde izquierdo del tablero), `PANEL_X = 560` (panel con NEXT y LINES). Origen arriba a la izquierda; `dt` máximo 0.05 s.
- Piezas por tipo (1–8): I, O, T, S, Z, J, L y N (tuerca, matriz 3×3 con hueco central). Colores: `#4dd0e1`, `#ffd54f`, `#ba68c8`, `#81c784`, `#e57373`, `#90caf9`, `#ffb74d`, `#9e9e9e`.
- Selección de pieza: uniforme al azar entre las 8. Aparece en `x = floor(COLS / 2) - floor(ancho / 2)`, `y = 0`.
- Wall kicks al rotar en sentido horario: desplazamientos `[0, -1, 1, -2, 2]` en ese orden; si ninguno cabe, no rota.
- Puntaje: `LINE_SCORES = [0, 100, 300, 500, 800]` × nivel **anterior** a subir; caída suave `+1` por fila; caída instantánea `+2` por celda recorrida.
- Nivel: `floor(lines / 10) + 1`. Intervalo de caída: `max(100, 1000 − (level − 1) × 90)` ms; el acumulador se reinicia a 0 en cada caída.
- Estado del motor: `'playing' | 'gameover'` (más un flag interno `paused`).

**Teclado (`lib/games/tetris/input.ts`):**

- `createInput(shouldCapture, captureKeys, repeatKeys)`: copia de la lógica de `lib/games/asteroids/input.ts` con dos parámetros nuevos.
- `captureKeys`: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Space` (se les hace `preventDefault` solo si el juego corre).
- `repeatKeys`: `ArrowLeft`, `ArrowRight`, `ArrowDown`, `ArrowUp`, `KeyX`. Cada evento `keydown`, incluido el auto-repeat del sistema, cuenta como una pulsación. `Space` no está en `repeatKeys`.
- Acciones: `←`/`→` mover; `↑` o `X` rotar; `↓` caída suave; `Space` caída instantánea. La pausa (`P`) la maneja `GamePlayer`.

**Layout del canvas (800×600):** tablero de 300×600 en `x = 220..520`, ocupando todo el alto. Panel derecho desde `x = 560`: etiqueta "NEXT" con el recuadro de 120×120 de la pieza siguiente, y debajo "LINES" con el contador. La pieza fantasma se dibuja con `globalAlpha = 0.2`. El canvas **no** dibuja puntaje, nivel, "PAUSA" ni "GAME OVER".

**Contrato de eventos del motor:**

- Al crearse y en cada `restart()`, el motor emite `onScore(0)` y `onLevel(1)`. **Nunca** emite `onLives`.
- `onScore` y `onLevel` se emiten solo cuando el valor cambia.
- `onGameOver(finalScore)` se emite una sola vez por partida, en el instante en que la pieza recién generada colisiona al aparecer.

---

## Implementation plan

Antes de escribir código, consultar la guía de Next.js 16 en `node_modules/next/dist/docs/` (según `AGENTS.md`) para confirmar la convención de Client Components, y consultar la skill `arcade-vault-game`. Si `node_modules/` no existe, instalar dependencias primero. Cada paso deja la app compilando y las pantallas existentes funcionando. Verificaciones estáticas por paso: `npm run lint` y `npx tsc --noEmit` (ESLint no detecta errores de tipos); no se ejecuta ningún build.

1. **Contrato y HUD sin vidas.** En `lib/games/types.ts`, `onLives` pasa a opcional. En `lib/games/asteroids/engine.ts`, las llamadas pasan a `callbacks.onLives?.(…)`. En `GamePlayer.tsx`, el estado de vidas es `number | null` (inicia en `null` si el juego tiene motor, en `3` si no) y el stat "Vidas" se renderiza solo si no es `null`. Prueba manual: `/games/rocas/play` sigue mostrando `♥ ♥ ♥` y nivel `01`; `/games/caida/play` sigue mostrando la arena falsa con 3 vidas.
2. **Constantes, tablero y piezas.** Crear `lib/games/tetris/constants.ts`, `board.ts` (`createBoard`, `collide`, `merge`, `clearFullRows`) y `pieces.ts` (las 8 formas, `randomPiece`, `rotateCW`, `tryRotate` con wall kicks, `ghostRow`), portados de `game.js` sin globals. Prueba: lint y `tsc --noEmit`.
3. **Input.** Crear `lib/games/tetris/input.ts` con `createInput(shouldCapture, captureKeys, repeatKeys)`. `attach` registra `keydown`/`keyup` en `window` y `detach` los remueve; `pressed(code)` se consume al leer; con `repeatKeys` el auto-repeat cuenta como pulsación; `Space` también se cancela en `keyup` (Firefox activa el botón enfocado). Prueba: lint y `tsc --noEmit`.
4. **Render.** Crear `lib/games/tetris/render.ts` con `drawFrame(ctx, frame)`: fondo negro, cuadrícula y marco del tablero en `BOARD_X`, bloques con realce superior, pieza fantasma, pieza actual, recuadro NEXT y contador LINES. Sin puntaje, nivel ni textos de estado. Prueba: lint y `tsc --noEmit`.
5. **Motor.** Crear `lib/games/tetris/engine.ts` con `createTetrisGame` (`GameEngineFactory`): estado en el closure, `initGame`, `spawn` (game over si la pieza no cabe), `lockPiece` (fusionar, limpiar filas, puntuar con el nivel anterior, subir nivel y velocidad), caída suave y caída instantánea, gravedad por acumulador en milisegundos, lectura de input por cuadro, loop de `requestAnimationFrame` con `dt` capado a 0.05 s, y `pause()`, `resume()`, `restart()` y `destroy()` (idempotente, cancela el `requestAnimationFrame` y llama a `input.detach()`). Emisión de callbacks según el contrato; `onGameOver` una sola vez. Prueba: lint y `tsc --noEmit`.
6. **Cover.** Agregar `.cover-tetris` en `app/globals.css` (CSS puro, usando los tokens existentes): un pozo con bloques apilados y una pieza I cayendo, visualmente distinto de `.cover-tetro`. Prueba manual: asignar la clase de forma temporal a un elemento `.cover-bg` y revisarla en un ancho de 375 px y en desktop; el elemento temporal no se commitea.
7. **Registro y migración, en este orden.** Primero agregar `tetris: createTetrisGame` en `lib/games/registry.ts`. Después aplicar con `apply_migration` el insert del Data model (nombre `add_tetris_game`), leer la versión real asignada (`select version, name from supabase_migrations.schema_migrations order by version desc limit 1`) y guardar el mismo SQL en `supabase/migrations/<version>_add_tetris_game.sql`. Verificar con `execute_sql`: 9 filas en `games`, `tetris` jugable y `caida` con `playable = false`. Prueba manual: `/games` muestra 9 tarjetas y `/games/tetris/play` muestra el juego.
8. **Verificación de RLS por REST.** Con `curl` y la publishable key (`apikey` + `Authorization: Bearer`): un `POST /rest/v1/scores` válido para `tetris` responde `201`; son rechazados un `score` `0`, un `player_name` de 11 caracteres, un `game_id` inexistente y un `game_id` de un juego no jugable (por ejemplo `caida`). Borrar con `execute_sql` las filas de prueba al terminar.
9. **Pase final de integración.** Recorrer los criterios de aceptación en `npm run dev` (incluido el doble montaje de Strict Mode y la navegación de ida y vuelta), revisar la consola del navegador y correr `npm run lint` y `npx tsc --noEmit`.

---

## Acceptance criteria

- [ ] `games` tiene 9 filas; `tetris` tiene `title = 'TETRIS'`, `cat = 'PUZZLE'`, `color = 'cyan'`, `cover = 'cover-tetris'`, `sort_order = 9` y `playable = true`.
- [ ] `caida` conserva exactamente sus valores anteriores, con `playable = false`; solo `rocas` y `tetris` tienen `playable = true`.
- [ ] `list_migrations` muestra `add_tetris_game` y `supabase/migrations/` contiene su SQL con la misma versión.
- [ ] `/games` muestra 9 tarjetas, con TETRIS en último lugar y su cover distinto del de CAÍDA; los filtros por categoría siguen funcionando.
- [ ] `/games/tetris` muestra el título y la descripción de la base, `—` como mejor marca y `0` como partidas cuando no hay puntajes.
- [ ] `/games/tetris/play` muestra un `<canvas>` de 800×600 dentro del marco CRT y no contiene los elementos `.enemy` ni `.player-ship` de la arena falsa.
- [ ] `/games/caida/play` sigue mostrando la arena falsa con `♥ ♥ ♥`, y su modal de fin de juego dice "ESTE JUEGO AÚN NO TIENE RANKING." sin ofrecer guardar.
- [ ] El tablero es de 10×20, ocupa el alto del canvas y queda centrado a la izquierda del panel con NEXT y LINES.
- [ ] El canvas muestra la pieza siguiente, el contador de líneas y la pieza fantasma; no dibuja `SCORE`, nivel, vidas, `PAUSA` ni `GAME OVER`.
- [ ] Aparecen las 8 piezas, incluida la tuerca N (3×3 con hueco central), en partidas largas.
- [ ] `←` y `→` mueven la pieza; mantener la tecla la sigue moviendo (auto-repeat del sistema).
- [ ] `↑` y `X` rotan en sentido horario; junto a una pared la rotación aplica el wall kick, y si ninguno cabe la pieza no rota.
- [ ] `↓` baja una fila por evento y suma 1 punto por fila; mantenerla repite.
- [ ] `Espacio` deja caer la pieza al instante y suma 2 puntos por celda; mantenerlo apretado no encadena caídas.
- [ ] Presionar flechas o `Espacio` mientras el juego corre no hace scroll de la página.
- [ ] Limpiar 1, 2, 3 y 4 líneas suma 100, 300, 500 y 800 puntos multiplicados por el nivel vigente, y el HUD "Puntuación" se actualiza en el momento.
- [ ] Al completar 10 líneas el HUD muestra nivel `02` y la caída se acelera; el intervalo nunca baja de 100 ms.
- [ ] El HUD de TETRIS no muestra el stat "Vidas"; el de ROCAS sigue mostrando `♥ ♥ ♥` una vez montado el juego.
- [ ] Cuando la pieza nueva no cabe, se abre el modal "FIN DEL JUEGO" exactamente una vez, con el puntaje final correcto.
- [ ] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'tetris'`, el nombre en mayúsculas y el puntaje final, y el modal muestra "PUNTUACIÓN GUARDADA".
- [ ] Tras guardar, `/games/tetris` y la pestaña TETRIS de `/hall-of-fame` muestran ese puntaje, y `best` y `plays` se actualizan.
- [ ] El botón PAUSA y la tecla `P` congelan el juego y muestran "EN PAUSA"; reanudar continúa sin saltos de posición ni caída inmediata.
- [ ] El botón FIN detiene el juego y abre el modal con el puntaje actual.
- [ ] "JUGAR DE NUEVO" deja la partida en puntaje 0, nivel 1, 0 líneas, tablero vacío y el juego corriendo.
- [ ] Con el modal abierto, escribir iniciales (incluidos espacios y flechas) funciona y no dispara acciones del juego.
- [ ] Tras pulsar PAUSA con el mouse y reanudar, `Espacio` hace caída instantánea y no activa el botón enfocado.
- [ ] Al salir con SALIR y volver a entrar (y bajo Strict Mode en `npm run dev`), cada tecla ejecuta una sola acción y no quedan listeners activos fuera de `/games/tetris/play`.
- [ ] En un ancho de 375 px el canvas escala sin scroll horizontal y mantiene proporción 4:3; en emulación `pointer: coarse` aparece "REQUIERE TECLADO".
- [ ] ROCAS se juega igual que antes (puntaje, vidas, nivel, pausa y fin de juego).
- [ ] Con la publishable key, un `POST /rest/v1/scores` válido para `tetris` responde `201`, y se rechazan `score` `0`, `player_name` de 11 caracteres, `game_id` inexistente y `game_id = 'caida'`; las filas de prueba quedan borradas.
- [ ] `lib/games/tetris/` no importa React ni `next/*` (`rg` sin resultados).
- [ ] `git diff` no muestra cambios en `lib/supabase/`, `lib/session-context.tsx`, `components/nav/`, `resources/` ni `package.json`, y `database.types.ts` no cambió.
- [ ] La consola del navegador no muestra errores ni warnings de React durante una partida completa.
- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.

---

## Decisions taken and discarded

**Tomadas:**

- **Tetris como entrada nueva (`tetris`), no sobre CAÍDA.** La galería suma juegos: CAÍDA es otra entrada del catálogo y debe seguir existiendo. Un primer intento de adjuntar el motor a CAÍDA se descartó por esta razón. A cambio, el catálogo muestra dos juegos de piezas (uno jugable y un placeholder).
- **`onLives` opcional** en `GameCallbacks`. Cambio mínimo y reutilizable por cualquier juego sin vidas; el costo es que `GamePlayer` distingue "sin vidas" de "aún no emitió" con `null`.
- **Los juegos sin motor siguen mostrando 3 vidas.** Se conserva el comportamiento de la arena falsa para no tocar los otros 7 juegos.
- **Port 1:1, incluida la pieza N.** El código es la fuente de verdad y la tuerca parece una variante intencional del juego; el README es el que está desactualizado. También se conservan el selector uniforme al azar, los wall kicks `[0, -1, 1, -2, 2]` y el puntaje calculado con el nivel anterior a subir.
- **Auto-repeat del sistema para mover, rotar y bajar.** Es lo más fiel al original y no inventa reglas. Se paga que la cadencia dependa de la configuración de teclado del sistema.
- **`Space` como pulsación única.** Es una desviación deliberada: en el original, mantener `Espacio` encadenaba caídas instantáneas por el auto-repeat. Es coherente con ROCAS.
- **Tablero centrado en el canvas fijo 800×600 con NEXT y LINES dibujados dentro.** Mantiene el marco CRT 4:3 y evita un cambio de plataforma de proporciones. Es coherente con el indicador `3x N.Ns` de ROCAS, que también se dibuja en el canvas.
- **Una copia propia de `input.ts` en `lib/games/tetris/`.** Duplica la lógica de Asteroids, pero evita refactorizar un juego ya implementado dentro de esta spec. Cuando haya un tercer juego conviene promoverlo a `lib/games/input.ts`.
- **Versión de la migración tomada de Supabase.** Se aplica primero y se lee la versión real: un timestamp local puede ordenarse antes de las migraciones existentes.
- **Registro antes que migración.** Evita el estado "jugable sin motor", donde el ranking aceptaría puntajes de una arena falsa.
- **Cover en CSS puro** con los tokens existentes, como los demás covers.
- **Verificación de tipos con `npx tsc --noEmit`** además de lint, porque ESLint no detectó un error de tipos en una prueba previa de este motor.

**Descartadas:**

- **Adjuntar el motor a `caida`:** es el atajo más barato, pero reemplaza una entrada existente de la galería.
- **Vidas ficticias (`onLives(1)` constante):** no toca la plataforma, pero muestra un `♥` en un juego sin vidas.
- **Stats del HUD configurables por juego:** más flexible, pero mayor superficie de diseño en `GamePlayer` y en el registro para un solo caso.
- **DAS/ARR propio:** se siente más "Tetris moderno", pero es una regla nueva que el original no tiene.
- **Bolsa de 7 piezas, SRS, hold:** mejoran el juego, pero cambian las reglas respecto del código fuente.
- **Quitar la pieza N:** alinearía con el README, pero es un cambio de reglas respecto del código.
- **Canvas vertical 300×600 con cambio de proporción en la plataforma:** exige modificar `.crt-screen` y afecta a ROCAS.
- **HUD de score, nivel y líneas dibujado en el canvas:** duplicaría el HUD de la plataforma. Solo se dibujan NEXT y LINES, que la plataforma no tiene.
- **Iframe a `resources/` o pegar `game.js` en un `useEffect`:** mismas razones que en la SPEC 05.
- **Conservar el toggle de tema y el overlay propio:** los reemplaza la plataforma.

---

## Identified risks

| Riesgo | Mitigación |
| --- | --- |
| `tetris` queda `playable = true` sin motor en el registro (o al revés), y el ranking acepta puntajes de la arena falsa o el modal ofrece guardar y RLS rechaza | El paso 7 fija el orden: registro primero, migración después. Criterios de aceptación sobre las dos condiciones. |
| `lives` arranca en `null` para juegos con motor, y ROCAS muestra su stat de vidas un instante después de montar | Aceptado: es un cambio de un solo cuadro al montar. Criterio de aceptación sobre ROCAS. Si se nota, se resuelve inicializando desde el motor en la spec siguiente. |
| React Strict Mode monta, desmonta y vuelve a montar el efecto, y podría dejar dos loops o listeners duplicados | `destroy()` cancela el `requestAnimationFrame`, llama a `input.detach()`, es idempotente y `GameCanvas` lo invoca en el cleanup. Criterio de aceptación explícito. |
| La caída instantánea o una caída de gravedad terminan la partida y se emite `onGameOver` dos veces | El motor emite el evento solo si el estado no es `gameover` y cambia el estado antes de emitir. Criterio de aceptación sobre "exactamente una vez". |
| El auto-repeat del sistema varía entre equipos (retardo y cadencia), así que la sensación de movimiento cambia | Aceptado como límite conocido; DAS/ARR propio queda fuera de alcance. |
| Si la ventana pierde el foco con una tecla apretada, el `keyup` no llega y la tecla queda marcada como presionada | Límite conocido que comparte ROCAS; las teclas de `repeatKeys` no dependen de ese estado. Auto-pausa al perder foco queda fuera de alcance. |
| Un botón con foco (PAUSA) se activa con `Espacio` y pausa el juego a mitad de una partida | `GameCanvas` devuelve el foco al canvas tras pausar, reanudar o reiniciar, y `Space` se cancela en `keydown` y `keyup` mientras el juego corre. |
| El puntaje se calcula en el cliente y se puede falsificar | Mismo riesgo aceptado en la SPEC 06: solo hay validación de forma en la base. |
| La versión de la migración se ordena antes de las existentes si se toma de la hora local | La versión se lee de `supabase_migrations.schema_migrations` después de aplicar. |
| Canvas borroso en pantallas grandes o retina | Aceptado como límite conocido; HiDPI queda fuera de alcance. |

---

## What is **not** in this spec

- Cambios a CAÍDA ni a ningún otro juego del catálogo.
- Motores de los demás juegos pendientes.
- Reglas modernas de Tetris (bolsa de 7, SRS, hold, lock delay, DAS/ARR).
- Controles táctiles, sonido o toggle de tema.
- Cambios de esquema, tablas nuevas o regenerar `database.types.ts`.
- Mover `createInput` a un módulo compartido.
- HiDPI, canvas con otra proporción o pantalla completa.
- Tests automatizados de cualquier tipo.

Cada uno de estos, si se necesita, va en su propia spec.
