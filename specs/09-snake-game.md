# SPEC 09 — Juego Snake jugable en la galería

> **Status:** Implemented
> **Depends on:** SPEC 05 (asteroids-game), SPEC 06 (games-table-and-leaderboard), SPEC 07 (tetris-game), SPEC 08 (arkanoid-game)
> **Date:** 2026-10-06
> **Objective:** Agregar SNAKE como juego nuevo de la galería (entrada propia en `games`, motor TypeScript escrito desde cero con las frutas pixel-art de `app/assets/fruits.png`) con su ranking en Supabase, sin tocar SERPENTINA.

---

## Por qué existe esta spec

Arcade Vault es una galería que crece: cada juego nuevo **suma** una entrada, no reemplaza una existente. Tras ROCAS, TETRIS y ARKANOID, Snake es el siguiente juego, pero con una diferencia de fondo con las specs 05, 07 y 08.

Cuatro puntos de esta spec no son obvios:

- **No hay código fuente que portar.** No existe `resources/started-games/` de snake. Solo hay dos assets sueltos en `app/assets/`: `fruits.png` y `sprites.js`. Las reglas (grilla, velocidad, puntaje, colisiones) se **definen aquí**, no se portan 1:1, y por eso la sección de Decisiones es más larga que de costumbre.
- **SERPENTINA no se toca.** `serpentina` es una entrada del catálogo (`cover-snake`, `playable = false`, `sort_order = 3`) cuya descripción parece un Snake. Seguirá siendo un placeholder con arena falsa. La skill `arcade-vault-game` sugiere "activar el placeholder", pero eso reemplazaría un juego del catálogo en lugar de sumar uno; es la misma decisión que se tomó con CAÍDA (SPEC 07) y BLOQUE BUSTER (SPEC 08). A cambio, la galería tendrá dos juegos de serpiente.
- **`sprites.js` usa un global del navegador.** Define `window.SPRITE_ATLAS` y apunta a `snake-assets/fruits.png`. Nada de eso existe en Next.js: se traduce a una tabla TypeScript (`sprites.ts`) y la imagen se sirve desde `public/`. El PNG mide 3790×442 y tiene tres filas de estilos; el atlas mapea solo la del medio (pixel-art, `y = 136..295`, 22 frutas), que es la que se usa.
- **Snake no tiene vidas y los assets no traen sprites de serpiente.** Como `onLives` es opcional desde la SPEC 07, el motor no la emite y el HUD oculta las vidas, sin cambios de plataforma. El cuerpo de la serpiente se dibuja con canvas; solo las frutas salen del PNG.

Decisiones ya cerradas con el usuario:

1. **Entrada nueva** `snake` en `games`; SERPENTINA queda intacta.
2. **Estilo de frutas pixel-art** (fila del medio del PNG, la que mapea `sprites.js`).
3. **Reglas de Snake clásico** definidas en esta spec, ya que no hay juego fuente.

---

## Scope

**In:**

- Migración de datos `supabase/migrations/<version>_add_snake_game.sql` que inserta la fila `snake` en `games` con `playable = true`. Sin cambios de esquema ni de `lib/supabase/database.types.ts`.
- `lib/games/snake/` (TypeScript puro, sin React): `constants.ts`, `sprites.ts`, `input.ts`, `board.ts`, `render.ts` y `engine.ts` (`createSnakeGame`).
- Asset `public/games/snake/fruits.png`, copiado desde `app/assets/fruits.png` (el original no se mueve ni se borra).
- Registro en `lib/games/registry.ts`: `snake: createSnakeGame`.
- `app/globals.css`: clase de cover `.cover-snake-fruit` en CSS puro, distinta de `.cover-snake`.
- Verificación de RLS contra la API REST con la publishable key, y limpieza de las filas de prueba.

**Out of scope (para specs futuras):**

- Cualquier cambio a SERPENTINA (`serpentina` sigue con arena falsa y `playable = false`).
- Motores para los demás juegos pendientes (Caída, Glotón, Invasores, Ranaria, Duelo Pixel, Bloque Buster).
- Sonido.
- Sprites de serpiente (cabeza, cola, curvas): la serpiente se dibuja con rectángulos redondeados.
- Las filas "plana" y "realista" del PNG y las coordenadas que `sprites.js` no trae.
- Mecánicas nuevas: frutas especiales con efectos, obstáculos, modo con paredes que atraviesan, vidas, varios modos de dificultad.
- Pantalla de victoria o cambios en `GamePlayer` / `GameCallbacks`: llenar el tablero emite `onGameOver`.
- Controles táctiles; el aviso "REQUIERE TECLADO" de `GameCanvas` ya cubre el caso.
- Optimizar el peso del PNG (≈ 585 KB) o generar un spritesheet recortado.
- Soporte HiDPI/retina y canvas con proporción distinta de 4:3.
- Mover `createInput` a un módulo compartido `lib/games/input.ts` (habría cuatro copias).
- Borrar o mover `app/assets/`; queda como está.
- Cambios de esquema, nuevas tablas o regenerar `database.types.ts`.
- Tests automatizados: el proyecto sigue sin test runner configurado.

---

## Data model

**Fila nueva en `public.games`** (la inserta la migración; el resto de columnas toma sus valores por defecto):

```sql
insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order) values
('snake', 'SNAKE',
 'Come frutas, crece y no te muerdas la cola.',
 'Guía a la serpiente por el tablero con las flechas o con WASD. Cada fruta que comes suma puntos, alarga tu cuerpo y acelera el juego. Choca con una pared o contigo misma y la partida termina.',
 'ARCADE', 'cover-snake-fruit', 'green', true, 11);
```

Estado esperado antes de la migración: 10 juegos, con `rocas`, `tetris` y `arkanoid` en `playable = true`. Después: 11 juegos, con `snake` también jugable. `sort_order = 11` se confirma contra la base antes de aplicar (la columna es única). Hoy la base tiene `sort_order` del 1 al 10 sin huecos.

**Constantes del motor (`lib/games/snake/constants.ts`)**, definidas en esta spec:

- Canvas: `W = 800`, `H = 600`; origen arriba a la izquierda.
- Grilla: `CELL = 40`, `COLS = 20`, `ROWS = 15` (300 celdas). Las posiciones de la serpiente y de la fruta son celdas enteras `{ col, row }`.
- Serpiente inicial: largo `3`, cabeza en `{ col: 10, row: 7 }`, cuerpo hacia la izquierda, dirección inicial `right`.
- Velocidad: `TICK_START_MS = 150` entre movimientos; baja `TICK_STEP_MS = 10` cada `FRUITS_PER_LEVEL = 5` frutas; piso `TICK_MIN_MS = 70`.
- Nivel: `level = floor(fruits / 5) + 1`, sin tope (la velocidad se detiene en el piso, el número sigue subiendo).
- Puntaje: `FRUIT_POINTS = 10` por fruta (siempre entero).
- Cola de giros: `MAX_QUEUED_TURNS = 2`.
- Paredes mortales (no hay "wrap").
- Color de la serpiente y respaldo de frutas: ver `FALLBACK_COLORS` en `sprites.ts`.

**Sprites (`lib/games/snake/sprites.ts`)**: tipo `Sprite = { x; y; w; h }` y tabla `FRUIT_SPRITES` con las 22 frutas de `app/assets/sprites.js`, mismas claves y mismas coordenadas (`banana`, `orange`, `grape`, `garlic`, `eggplant`, `strawberry`, `cherry`, `carrot`, `mushroom`, `broccoli`, `watermelon`, `pepper`, `kiwi`, `lemon`, `peach`, `peanut`, `apple`, `tomato`, `berries`, `grapes2`, `pineapple`, `melon`). `FRUIT_KEYS` es la lista de claves para el sorteo. Ruta de carga: `/games/snake/fruits.png`. Cada sprite se dibuja manteniendo su relación de aspecto, centrado en una celda de 40 px con un margen interno de 4 px. `FALLBACK_COLORS` da un color plano por fruta para dibujar un círculo si el PNG no cargó.

**Estado del motor (en el closure de `createSnakeGame`):**

```ts
type Direction = "up" | "down" | "left" | "right";
type GameState = "playing" | "gameover"; // más un flag interno `paused`

interface Cell { col: number; row: number }
interface Fruit extends Cell { kind: FruitKey }

// snake[0] es la cabeza. `queuedTurns` guarda hasta 2 giros pendientes.
```

**Reglas del juego:**

- Cada `tick` (acumulado con `dt`, nunca con `setInterval`): se consume el primer giro válido de la cola y la cabeza avanza una celda.
- Un giro es válido si no es la dirección opuesta a la última dirección **aplicada** (ni la misma). Esto evita el giro de 180° al apretar dos teclas dentro de un mismo tick.
- Si la nueva cabeza sale del tablero o cae sobre una celda del cuerpo, la partida termina. La cola se considera libre en ese tick si la serpiente no come (la cola se mueve).
- Si la nueva cabeza cae sobre la fruta: suma `10`, la serpiente crece una celda (no se quita la cola), se sortea otra fruta en una celda libre y se recalcula el nivel y el intervalo.
- Si tras comer no quedan celdas libres (300 celdas ocupadas), la partida termina (equivale a ganar).

**Teclado (`lib/games/snake/input.ts`)**: copia de la lógica de `lib/games/arkanoid/input.ts`. Flechas y `WASD` se leen como "recién apretadas" (se consumen al leer y se ignora el auto-repeat) y alimentan la cola de giros. `captureKeys`: flechas, `Space` y `WASD`, con `preventDefault` solo si el juego corre (no en pausa ni en `gameover`).

**Layout del canvas (800×600):** el tablero ocupa todo el canvas, con un damero sutil de dos tonos oscuros para ver la grilla. El canvas **no** dibuja puntaje, nivel, `PAUSA`, `GAME OVER` ni mensaje de victoria.

**Contrato de eventos del motor:**

- Al crearse y en cada `restart()`, el motor emite `onScore(0)` y `onLevel(1)`. **Nunca** emite `onLives`.
- `onScore` y `onLevel` se emiten solo cuando el valor cambia.
- `onGameOver(finalScore)` se emite una sola vez por partida, de inmediato, al chocar o al llenar el tablero.

---

## Implementation plan

Antes de escribir código, consultar la guía de Next.js 16 en `node_modules/next/dist/docs/` (según `AGENTS.md`) y la skill `arcade-vault-game`. Si `node_modules/` no existe, instalar dependencias primero. Cada paso deja la app compilando y las pantallas existentes funcionando. Verificaciones estáticas por paso: `npm run lint` y `npx tsc --noEmit`; no se ejecuta ningún build.

1. **Constantes y sprites.** Crear `lib/games/snake/constants.ts` y `sprites.ts`, este último portado de `app/assets/sprites.js` como `FRUIT_SPRITES` tipado, sin `window`. Prueba: lint y `tsc --noEmit`.
2. **Asset.** Copiar `app/assets/fruits.png` a `public/games/snake/fruits.png` (el original queda en `app/assets/`). Prueba manual: abrir `/games/snake/fruits.png` en `npm run dev` y ver la imagen.
3. **Input.** Crear `lib/games/snake/input.ts` con `createInput(shouldCapture, captureKeys)`. `attach` registra `keydown`/`keyup` en `window` y `detach` los remueve; `Space` también se cancela en `keyup` (Firefox activa el botón enfocado). Prueba: lint y `tsc --noEmit`.
4. **Tablero.** Crear `lib/games/snake/board.ts` con funciones puras: `createSnake()`, `nextHead(head, dir)`, `isOpposite(a, b)`, `hitsWall(cell)`, `hitsBody(cell, snake, willGrow)`, `pickFreeCell(snake, rng)`, `tickIntervalFor(fruits)` y `levelFor(fruits)`. Sin canvas ni estado propio. Prueba: lint y `tsc --noEmit`.
5. **Render.** Crear `lib/games/snake/render.ts` con `drawFrame(ctx, frame, sheet)`: fondo en damero, serpiente (rectángulos redondeados, cabeza más clara, ojos orientados según la dirección) y fruta. Si `sheet` es `null` (aún no cargó, o falló), dibuja un círculo de `FALLBACK_COLORS`. Sin textos de estado. Prueba: lint y `tsc --noEmit`.
6. **Motor.** Crear `lib/games/snake/engine.ts` con `createSnakeGame` (`GameEngineFactory`): estado en el closure; `initGame` (emite `onScore(0)` y `onLevel(1)`, sin `onLives`); carga del spritesheet con `Image` (con `onload`/`onerror` que no hacen nada si el motor fue destruido); cola de giros desde el input; acumulador de tiempo por tick con el intervalo de `tickIntervalFor`; movimiento, colisiones, comer, crecer y sortear fruta; `onGameOver` una sola vez; loop de `requestAnimationFrame` cancelable con `dt` capado a `MAX_DT = 0.05` y `dt = 0` en el primer cuadro; `pause()`, `resume()` (limpia el input y el acumulador), `restart()` y `destroy()` (idempotente, cancela el rAF y llama a `input.detach()`). Prueba: lint y `tsc --noEmit`.
7. **Cover.** Agregar `.cover-snake-fruit` en `app/globals.css` (CSS puro, tokens existentes): una serpiente verde en zigzag con una fruta roja al final, visualmente distinta de `.cover-snake`. Prueba manual: asignar la clase de forma temporal a un elemento `.cover-bg` y revisarla en 375 px y en desktop; el elemento temporal no se commitea.
8. **Registro y migración, en este orden.** Primero agregar `snake: createSnakeGame` en `lib/games/registry.ts`. Después consultar `select id, sort_order from public.games order by 2`, aplicar con `apply_migration` el insert del Data model (nombre `add_snake_game`), leer la versión real asignada (`select version, name from supabase_migrations.schema_migrations order by version desc limit 1`) y guardar el mismo SQL en `supabase/migrations/<version>_add_snake_game.sql`. Verificar con `execute_sql`: 11 filas en `games`, `snake` jugable y `serpentina` con `playable = false`. Prueba manual: `/games` muestra 11 tarjetas y `/games/snake/play` muestra el juego.
9. **Verificación de RLS por REST.** Con `curl` y la publishable key (`apikey` + `Authorization: Bearer`): un `POST /rest/v1/scores` válido para `snake` responde `201`; son rechazados un `score` `0`, un `player_name` de 11 caracteres, un `game_id` inexistente y un `game_id` de un juego no jugable (por ejemplo `serpentina`). Borrar con `execute_sql` las filas de prueba al terminar.
10. **Pase final de integración.** Recorrer los criterios de aceptación en `npm run dev` (incluido el doble montaje de Strict Mode y la navegación de ida y vuelta), revisar la consola del navegador y correr `npm run lint` y `npx tsc --noEmit`.

---

## Acceptance criteria

- [ ] `games` tiene 11 filas; `snake` tiene `title = 'SNAKE'`, `cat = 'ARCADE'`, `color = 'green'`, `cover = 'cover-snake-fruit'`, `sort_order = 11` y `playable = true`.
- [ ] `serpentina` conserva exactamente sus valores anteriores, con `playable = false`; solo `rocas`, `tetris`, `arkanoid` y `snake` tienen `playable = true`.
- [ ] `list_migrations` muestra `add_snake_game` y `supabase/migrations/` contiene su SQL con la misma versión.
- [ ] `/games` muestra 11 tarjetas, con SNAKE en último lugar y su cover distinto del de SERPENTINA; los filtros por categoría siguen funcionando.
- [ ] `/games/snake` muestra el título y la descripción de la base, `—` como mejor marca y `0` como partidas cuando no hay puntajes.
- [ ] `/games/snake/play` muestra un `<canvas>` de 800×600 dentro del marco CRT y no contiene los elementos `.enemy` ni `.player-ship` de la arena falsa.
- [ ] `/games/serpentina/play` sigue mostrando la arena falsa con `♥ ♥ ♥`, y su modal de fin de juego dice "ESTE JUEGO AÚN NO TIENE RANKING." sin ofrecer guardar.
- [ ] `GET /games/snake/fruits.png` responde `200` y las frutas se ven con los sprites pixel-art del PNG, sin recortes de otras frutas ni de otras filas.
- [ ] Si el PNG no carga (por ejemplo, bloqueando la URL en las herramientas del navegador), el juego sigue jugable con círculos de colores planos y sin errores no capturados.
- [ ] La partida arranca con una serpiente de 3 celdas centrada, moviéndose hacia la derecha, y con una fruta en una celda libre.
- [ ] Las flechas y `WASD` giran la serpiente; apretar la dirección opuesta a la actual no hace nada (no hay giro de 180°).
- [ ] Apretar dos giros seguidos dentro de un mismo tick (por ejemplo `↑` y luego `←` yendo a la derecha) se aplica en ticks consecutivos y nunca produce un choque inmediato con el propio cuello.
- [ ] Presionar flechas o `Espacio` mientras el juego corre no hace scroll de la página.
- [ ] Comer una fruta suma exactamente 10 puntos, alarga la serpiente una celda, hace aparecer otra fruta en una celda libre (nunca sobre la serpiente) y el HUD "Puntuación" se actualiza en el momento.
- [ ] Cada 5 frutas el HUD sube de nivel (`01` → `02` → …) y el intervalo entre movimientos baja 10 ms hasta el piso de 70 ms.
- [ ] El HUD no muestra vidas durante la partida de SNAKE.
- [ ] Chocar con una pared abre el modal "FIN DEL JUEGO" exactamente una vez, con el puntaje final correcto.
- [ ] Chocar con el propio cuerpo abre el modal "FIN DEL JUEGO" exactamente una vez, con el puntaje final correcto; moverse hacia la celda que acaba de dejar la cola (sin comer) no cuenta como choque.
- [ ] Llenar las 300 celdas abre el modal "FIN DEL JUEGO" exactamente una vez, sin mensaje de victoria dibujado en el canvas.
- [ ] El canvas no dibuja puntaje, nivel, `PAUSA`, `GAME OVER` ni mensaje de victoria.
- [ ] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'snake'`, el nombre en mayúsculas y el puntaje final, y el modal muestra "PUNTUACIÓN GUARDADA".
- [ ] Tras guardar, `/games/snake` y la pestaña SNAKE de `/hall-of-fame` muestran ese puntaje, y `best` y `plays` se actualizan.
- [ ] El botón PAUSA y la tecla `P` congelan el juego y muestran "EN PAUSA"; reanudar continúa sin saltos ni movimientos extra de la serpiente.
- [ ] El botón FIN detiene el juego y abre el modal con el puntaje actual.
- [ ] "JUGAR DE NUEVO" deja la partida en puntaje 0, nivel 1, serpiente de 3 celdas hacia la derecha, intervalo de 150 ms y el juego corriendo.
- [ ] Con el modal abierto, escribir iniciales (incluidos espacios, flechas y las letras `W`, `A`, `S`, `D`) funciona y no gira la serpiente.
- [ ] Al salir con SALIR y volver a entrar (y bajo Strict Mode en `npm run dev`), cada tecla gira la serpiente una sola vez y no quedan listeners de teclado activos fuera de `/games/snake/play`.
- [ ] Volver a la pestaña tras tenerla en segundo plano no hace avanzar a la serpiente varias celdas de golpe.
- [ ] En un ancho de 375 px el canvas escala sin scroll horizontal y mantiene proporción 4:3; en emulación `pointer: coarse` aparece "REQUIERE TECLADO".
- [ ] ROCAS, TETRIS y ARKANOID se juegan igual que antes.
- [ ] Con la publishable key, un `POST /rest/v1/scores` válido para `snake` responde `201`, y se rechazan `score` `0`, `player_name` de 11 caracteres, `game_id` inexistente y `game_id = 'serpentina'`; las filas de prueba quedan borradas.
- [ ] `lib/games/snake/` no importa React ni `next/*` (`rg` sin resultados).
- [ ] `git diff` no muestra cambios en `lib/supabase/`, `lib/session-context.tsx`, `components/nav/`, `components/player/`, `resources/` ni `package.json`, y `database.types.ts` no cambió.
- [ ] La consola del navegador no muestra errores ni warnings de React durante una partida completa.
- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.

---

## Decisions taken and discarded

**Tomadas:**

- **Snake como entrada nueva (`snake`), no sobre SERPENTINA.** La galería suma juegos: SERPENTINA es otra entrada del catálogo y debe seguir existiendo. A cambio, el catálogo muestra dos juegos de serpiente (uno jugable y un placeholder). Se contradice a propósito la sugerencia de la skill "solo activar `playable`", por la misma razón que en las SPEC 07 y 08.
- **Reglas definidas desde cero, estilo Snake clásico.** No hay juego fuente; elegir lo más conocido evita sorpresas: grilla de movimiento discreto, paredes mortales, crecimiento de una celda por fruta.
- **Grilla 20×15 con celdas de 40 px.** Divide exactamente el canvas 800×600 (4:3) sin bordes sobrantes, y 300 celdas dan partidas largas sin ser interminables.
- **Movimiento por acumulador de `dt`, no por `setInterval`.** Mantiene un único loop de `requestAnimationFrame` cancelable, que `pause`/`resume`/`destroy` pueden controlar sin timers sueltos, y se integra con el tope `MAX_DT`.
- **Cola de giros de 2 y rechazo contra la última dirección aplicada.** Es lo que evita que dos teclas rápidas dentro de un tick hagan un giro de 180° y maten a la serpiente contra su cuello. Con una cola de 1 se pierden giros rápidos legítimos; sin límite, la cola se vuelve un buffer de teclas viejas.
- **Paredes mortales, sin "wrap".** Es la versión clásica y la que da sentido al tablero 4:3 visible. El "wrap" queda como modo para otra spec.
- **Velocidad: 150 ms con -10 ms cada 5 frutas, piso de 70 ms.** Se siente jugable al arrancar y llega a la velocidad máxima a las 40 frutas (nivel 9), con margen antes del piso.
- **Nivel = frutas / 5.** El HUD de la plataforma siempre muestra nivel; atarlo a la velocidad lo vuelve informativo y no decorativo.
- **Sin vidas.** `onLives` es opcional y el HUD las oculta si el motor no la emite; no hay que tocar la plataforma. Una partida termina al primer choque, como el original.
- **Puntaje fijo de 10 por fruta, entero.** Cumple el `CHECK` de `scores` (1 a 99.999.999) con un margen enorme; el máximo teórico es 2.970 puntos con las 297 frutas posibles.
- **Llenar el tablero termina la partida con `onGameOver`.** Cumple el contrato existente sin tocar la plataforma y deja guardar el puntaje de quien "gana". A cambio no hay mensaje de victoria.
- **Fruta aleatoria entre las 22 del atlas, con `Math.random`.** Solo es estético (todas valen 10), por lo que no hace falta un generador sembrado ni determinístico.
- **Frutas con relación de aspecto preservada.** Los sprites del atlas miden entre 110 y 170 px de ancho y 160 de alto: estirarlos a una celda cuadrada los deformaría.
- **Spritesheet PNG copiado a `public/games/snake/`.** Es el único camino donde el motor sigue siendo TypeScript puro (la URL se pasa a `Image`, sin imports de `next/*`). Se paga una carga asíncrona y un binario de ≈ 585 KB versionado en el repo; el respaldo de círculos planos acota el costo.
- **`sprites.js` se traduce, no se importa.** Se conservan claves y coordenadas tal cual, pero sin `window.SPRITE_ATLAS` ni la ruta `snake-assets/`.
- **Serpiente dibujada con canvas, sin sprites.** Los assets no la traen; con rectángulos redondeados y dos colores alcanza y mantiene la estética neon del portal.
- **`WASD` además de flechas.** Es el estándar en Snake y no choca con nada de la plataforma; el modal de guardado sigue aceptando esas letras porque `preventDefault` se aplica solo con el juego corriendo.
- **Una copia propia de `input.ts` en `lib/games/snake/`.** Sería la cuarta copia; promoverla a `lib/games/input.ts` es deseable, pero refactorizar juegos ya implementados queda fuera de esta spec.
- **Versión de la migración tomada de Supabase** y **registro antes que migración**, por las mismas razones de las SPEC 07 y 08.
- **Cover en CSS puro** con los tokens existentes, como los demás covers.
- **Verificación de tipos con `npx tsc --noEmit`** además de lint, porque ESLint no detecta errores de tipos.

**Descartadas:**

- **Activar `serpentina`:** es el atajo más barato (un `update`, sin cover nuevo), pero reemplaza una entrada existente de la galería.
- **Filas "plana" y "realista" del PNG:** la realista exige calcular coordenadas nuevas que el atlas no trae y desentona con el estilo retro del portal; la plana es válida pero el usuario eligió pixel-art.
- **Dibujar todo con formas, sin sprites:** coherente con ROCAS y TETRIS, pero descarta los assets que el usuario pidió usar.
- **Mover o borrar `app/assets/`:** se copia, no se mueve; decidir su destino es otra tarea.
- **Importar el PNG desde el motor (`import img from "...png"`):** acopla el motor al bundler de Next.js y rompe la regla de "sin `next/*`".
- **`setInterval` para el tick:** compite con el loop de `requestAnimationFrame`, ignora la pausa de pestaña y obliga a coordinar dos relojes.
- **Wrap-around en las paredes:** cambia la dificultad y el significado del tablero; merece su propia spec.
- **Vidas (3 intentos):** no es Snake clásico y obligaría a decidir cómo reaparece la serpiente sin perder el puntaje.
- **Puntaje que crece con el nivel:** es otra regla de diseño sin juego fuente que la respalde; se puede ajustar en otra spec.
- **Frutas especiales, obstáculos, modos de dificultad:** mecánicas nuevas fuera del alcance de un primer Snake.
- **Pantalla de victoria en la plataforma:** es un cambio de contrato (`GameCallbacks`) que merece su propia spec.
- **Solo flechas:** más uniforme con los demás juegos, pero quita `WASD`, que es lo que muchos esperan en Snake.
- **Iframe a una página suelta o pegar un script en un `useEffect`:** mismas razones que en las SPEC 05, 07 y 08.

---

## Identified risks

| Riesgo | Mitigación |
| --- | --- |
| `snake` queda `playable = true` sin motor en el registro (o al revés), y el ranking acepta puntajes de la arena falsa o el modal ofrece guardar y RLS rechaza | El paso 8 fija el orden: registro primero, migración después. Criterios de aceptación sobre las dos condiciones. |
| `sort_order = 11` ya está ocupado y la migración falla por la restricción de unicidad | El paso 8 consulta los `sort_order` existentes antes de aplicar y ajusta el valor y los criterios si hace falta. |
| El spritesheet no carga (404, red, `Image` tras destruir el motor) y el juego queda sin frutas o lanza errores | Respaldo con círculos planos; `onload`/`onerror` no hacen nada si `destroyed`; criterio de aceptación explícito. |
| El PNG pesa ≈ 585 KB y retrasa la primera fruta en conexiones lentas | El respaldo cubre la espera; optimizar el asset queda fuera de esta spec y registrado como límite conocido. |
| Coordenadas de `sprites.js` recortan mal alguna fruta (el atlas se detectó "por análisis de píxeles") | Criterio de aceptación visual sobre los recortes; ajustar la tabla `FRUIT_SPRITES` en el paso 1 si alguna sale cortada. |
| Dos giros rápidos dentro de un tick producen un giro de 180° y un choque con el cuello | Cola de giros de 2 y validación contra la última dirección **aplicada**; criterio de aceptación explícito. |
| Al volver de otra pestaña, el acumulador de `dt` descarga muchos ticks de golpe | `dt` capado a `MAX_DT` y `resume()` reinicia el acumulador; criterio de aceptación explícito. |
| React Strict Mode monta, desmonta y vuelve a montar el efecto, y deja dos loops o listeners duplicados | `destroy()` cancela el rAF, llama a `input.detach()` y es idempotente; `GameCanvas` lo invoca en el cleanup. Criterio de aceptación explícito. |
| La fruta se sortea sobre la serpiente, o el sorteo se cuelga cuando casi no quedan celdas libres | `pickFreeCell` elige entre la lista de celdas libres (no reintenta al azar), y devuelve `null` si no hay ninguna, lo que dispara `onGameOver`. |
| Llenar el tablero y chocar en el mismo tick emiten `onGameOver` dos veces | El estado cambia a `gameover` antes de emitir y se emite solo si el estado no era `gameover`. Criterio sobre "exactamente una vez". |
| Las letras `W`, `A`, `S`, `D` no se pueden escribir en el modal de guardado | `preventDefault` solo mientras `!paused && state !== "gameover"`; criterio de aceptación explícito. |
| El puntaje se calcula en el cliente y se puede falsificar | Mismo riesgo aceptado en la SPEC 06: solo hay validación de forma en la base. |
| La versión de la migración se ordena antes de las existentes si se toma de la hora local | La versión se lee de `supabase_migrations.schema_migrations` después de aplicar. |
| Canvas borroso en pantallas grandes o retina | Aceptado como límite conocido; HiDPI queda fuera de alcance. |

---

## What is **not** in this spec

- Cambios a SERPENTINA ni a ningún otro juego del catálogo.
- Motores de los demás juegos pendientes.
- Sonido, música o control de mute.
- Sprites de serpiente y las filas "plana" y "realista" del PNG.
- Pantalla de victoria o cualquier cambio en `GamePlayer` y `GameCallbacks`.
- Mecánicas nuevas (frutas especiales, obstáculos, wrap-around, vidas, dificultades) y variantes del puntaje.
- Controles táctiles.
- Optimizar el PNG, o mover/borrar `app/assets/`.
- Cambios de esquema, tablas nuevas o regenerar `database.types.ts`.
- Mover `createInput` a un módulo compartido.
- HiDPI, canvas con otra proporción o pantalla completa.
- Tests automatizados de cualquier tipo.

Cada uno de estos, si se necesita, va en su propia spec.
