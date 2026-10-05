# SPEC 08 — Juego Arkanoid jugable en la galería

> **Status:** Approved
> **Depends on:** SPEC 05 (asteroids-game), SPEC 06 (games-table-and-leaderboard), SPEC 07 (tetris-game)
> **Date:** 2026-10-05
> **Objective:** Agregar ARKANOID como juego nuevo de la galería (entrada propia en `games`, motor TypeScript portado de `resources/started-games/04-arkanoid/`) con su ranking en Supabase, sin tocar BLOQUE BUSTER.

---

## Por qué existe esta spec

Arcade Vault es una galería que crece: cada juego nuevo **suma** una entrada, no reemplaza una existente. Tras ROCAS (SPEC 05), el ranking (SPEC 06) y TETRIS (SPEC 07), `resources/started-games/04-arkanoid/` es el siguiente juego con código fuente real.

El `game.js` original (≈250 líneas, canvas 800×600) no se puede pegar tal cual en Next.js, por las mismas razones de siempre: variables globales, `document.getElementById`, listeners que nunca se remueven, un `requestAnimationFrame` que no se cancela con el desmontaje, y overlays de pausa, "GAME OVER" y victoria propios que duplican los de la plataforma. Además carga un spritesheet y sonidos con rutas relativas a su `index.html`, que no existen en Next.js.

Tres puntos de esta spec no son obvios:

- **BLOQUE BUSTER no se toca.** `bloque-buster` es una entrada del catálogo (`cover-bricks`, `playable = false`) cuya descripción parece un Arkanoid. Seguirá siendo un placeholder con arena falsa. La skill `arcade-vault-game` sugiere "activar el placeholder", pero eso reemplazaría un juego del catálogo en lugar de sumar uno; es la misma decisión que se tomó con CAÍDA en la SPEC 07.
- **El spritesheet es un asset binario.** Es el primer juego que lo necesita. Se copia (nunca se mueve) a `public/` y el motor lo carga con `Image`; hasta que carga, o si falla, el motor dibuja rectángulos de color planos, de modo que el juego nunca queda sin bloques ni pelota.
- **La victoria termina la partida.** El original muestra "¡Completaste el juego!" al limpiar el nivel 5. La plataforma no tiene pantalla de victoria (ni se cambia aquí), así que limpiar el nivel 5 emite `onGameOver(score)` y abre el modal de guardado.

Decisiones ya cerradas con el usuario:

1. **Entrada nueva** `arkanoid` en `games`; BLOQUE BUSTER queda intacto.
2. **Spritesheet PNG copiado a `public/games/arkanoid/`**; el original en `resources/` no se modifica.
3. **Sin sonido** (ni ROCAS ni TETRIS lo tienen y la plataforma no tiene mute).
4. **Controles:** flechas `←`/`→` y mouse sobre el canvas. El selector de nivel de la pausa del original se descarta, porque la pausa la pone la plataforma.
5. **Limpiar el nivel 5 termina la partida** con `onGameOver`.
6. **Port 1:1** de reglas y constantes, incluidos los 5 niveles y sus velocidades.

---

## Scope

**In:**

- Migración de datos `supabase/migrations/<version>_add_arkanoid_game.sql` que inserta la fila `arkanoid` en `games` con `playable = true`. Sin cambios de esquema ni de `lib/supabase/database.types.ts`.
- `lib/games/arkanoid/` (TypeScript puro, sin React): `constants.ts`, `levels.ts`, `sprites.ts`, `input.ts`, `render.ts` y `engine.ts` (`createArkanoidGame`).
- Asset `public/games/arkanoid/spritesheet-breakout.png`, copiado desde `resources/started-games/04-arkanoid/assets/`.
- Registro en `lib/games/registry.ts`: `arkanoid: createArkanoidGame`.
- `app/globals.css`: clase de cover `.cover-arkanoid` en CSS puro, distinta de `.cover-bricks`.
- Verificación de RLS contra la API REST con la publishable key, y limpieza de las filas de prueba.

**Out of scope (para specs futuras):**

- Cualquier cambio a BLOQUE BUSTER (`bloque-buster` sigue con arena falsa y `playable = false`).
- Motores para los demás juegos pendientes (Serpentina, Glotón, Invasores, Ranaria, Duelo Pixel).
- Sonido: los dos mp3 del original (`ball-bounce.mp3`, `break-sound.mp3`) no se copian.
- Selector de nivel en la pausa, teclas `Escape` y `P` propias: la pausa es de la plataforma.
- Pantalla de victoria propia o cambios en `GamePlayer` / `GameCallbacks` (no hace falta ningún cambio de plataforma).
- Mecánicas nuevas: power-ups, bloques de varios golpes, ángulo de rebote según el punto de impacto en la paleta, lanzamiento manual de la pelota. El original no los tiene.
- Corregir las rarezas de física del original (ver Decisiones): se portan tal cual.
- Controles táctiles; el aviso "REQUIERE TECLADO" de `GameCanvas` ya cubre el caso.
- Soporte HiDPI/retina del canvas y canvas con proporción distinta de 4:3.
- Mover `createInput` a un módulo compartido `lib/games/input.ts` (hoy habría tres copias).
- Cambios de esquema, nuevas tablas o regenerar `database.types.ts`.
- Tests automatizados: el proyecto sigue sin test runner configurado.
- Modificar los archivos de `resources/started-games/04-arkanoid/`: quedan como referencia intacta.

---

## Data model

**Fila nueva en `public.games`** (la inserta la migración; el resto de columnas toma sus valores por defecto):

```sql
insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order) values
('arkanoid', 'ARKANOID',
 'Rompe el muro de bloques sin dejar caer la pelota.',
 'Cinco muros de bloques de colores, cada uno con su propio patrón y una pelota más rápida que el anterior. Mueve la paleta con las flechas o con el mouse, rebota la pelota y destruye todos los bloques. Tienes tres vidas.',
 'ARCADE', 'cover-arkanoid', 'yellow', true, 10);
```

Estado esperado antes de la migración: 9 juegos, `rocas` y `tetris` con `playable = true`. Después: 10 juegos, `rocas`, `tetris` y `arkanoid` jugables. `sort_order = 10` se confirma contra la base antes de aplicar (la columna es única).

**Constantes del motor (`lib/games/arkanoid/constants.ts`)**, valores idénticos a `game.js`:

- Canvas: `W = 800`, `H = 600`; `MAX_DT = 0.05` s. Origen arriba a la izquierda.
- Paleta: `y = 560`, `w = 81`, `h = 14`; velocidad con teclado `PADDLE_SPEED = 400` px/s; arranca centrada.
- Pelota: `16×16`; velocidad base `BASE_BALL_VX = 200`, `BASE_BALL_VY = -300`, multiplicada por la velocidad del nivel. Al (re)aparecer queda centrada sobre la paleta (`y = paddle.y − 16`) y sale hacia arriba y a la derecha.
- Bloques: `BLOCK_COLS = 10`, `BLOCK_ROWS = 6`, `BLOCK_W = 64`, `BLOCK_H = 24`, origen `BLOCKS_ORIGIN_X = (800 − 10 × 64) / 2 = 80`, `BLOCKS_ORIGIN_Y = 80`.
- Vidas iniciales: `3`. Puntaje: `+10` por bloque (siempre entero). Explosión: `EXPLOSION_DURATION = 150` ms, 4 cuadros.

**Niveles (`lib/games/arkanoid/levels.ts`)**: `LEVELS` con 5 entradas `{ speed, blocks: { col, row, color }[] }`, mismo contenido que `levels.js`:

| Nivel | Patrón | `speed` |
| --- | --- | --- |
| 1 | Parrilla completa 10×6 | 1.00 |
| 2 | Pirámide centrada | 1.10 |
| 3 | Tablero de ajedrez (`(col + row) % 2 === 0`) | 1.21 |
| 4 | Filas con huecos | 1.33 |
| 5 | Marco + cruz central | 1.46 |

**Sprites (`lib/games/arkanoid/sprites.ts`)**: tipo `Sprite = { sx; sy; sw; sh }`, tabla `SPRITES` (paleta, pelota, bloques `gray | red | yellow | cyan | magenta | hotpink | green`) y `EXPLOSION_FRAMES` por color, con las coordenadas de `assets/spritesheet.js`. Ruta de carga: `/games/arkanoid/spritesheet-breakout.png`. Tabla de colores planos de respaldo (`FALLBACK_COLORS`) para bloques, paleta y pelota.

**Estado del motor (en el closure de `createArkanoidGame`):**

```ts
type GameState = "playing" | "gameover"; // más un flag interno `paused`

interface Block { x: number; y: number; w: number; h: number; color: BlockColor; alive: boolean }
interface Explosion { x: number; y: number; w: number; h: number; color: BlockColor; elapsed: number } // ms
```

**Teclado y mouse (`lib/games/arkanoid/input.ts`)**: copia de la lógica de `lib/games/tetris/input.ts` (sin `repeatKeys`; `ArrowLeft` y `ArrowRight` se leen como teclas mantenidas vía `input.keys`). `captureKeys`: flechas y `Space`, con `preventDefault` solo si el juego corre. El mouse se maneja en el motor: `attach()` registra `mousemove` en el `canvas`, `detach()` lo remueve; la posición se convierte con `canvas.width / rect.width` y centra la paleta bajo el cursor, limitada a `[0, W − paddle.w]`.

**Layout del canvas (800×600):** el área de juego ocupa todo el canvas. El canvas **no** dibuja puntaje, nivel, vidas, `PAUSA`, `GAME OVER` ni mensaje de victoria.

**Contrato de eventos del motor:**

- Al crearse y en cada `restart()`, el motor emite `onScore(0)`, `onLives(3)` y `onLevel(1)`.
- `onScore`, `onLives` y `onLevel` se emiten solo cuando el valor cambia.
- `onGameOver(finalScore)` se emite una sola vez por partida, de inmediato, en dos casos: se pierde la última vida (tras emitir `onLives(0)`), o se limpia el último bloque del nivel 5.

---

## Implementation plan

Antes de escribir código, consultar la guía de Next.js 16 en `node_modules/next/dist/docs/` (según `AGENTS.md`) y la skill `arcade-vault-game`. Si `node_modules/` no existe, instalar dependencias primero. Cada paso deja la app compilando y las pantallas existentes funcionando. Verificaciones estáticas por paso: `npm run lint` y `npx tsc --noEmit`; no se ejecuta ningún build.

1. **Constantes, niveles y sprites.** Crear `lib/games/arkanoid/constants.ts`, `levels.ts` y `sprites.ts` portados de `game.js`, `levels.js` y `spritesheet.js`, sin globals. Prueba: lint y `tsc --noEmit`.
2. **Asset.** Copiar `resources/started-games/04-arkanoid/assets/spritesheet-breakout.png` a `public/games/arkanoid/spritesheet-breakout.png` (`resources/` no se modifica). Prueba manual: abrir `/games/arkanoid/spritesheet-breakout.png` en `npm run dev` y ver la imagen.
3. **Input.** Crear `lib/games/arkanoid/input.ts` con `createInput(shouldCapture, captureKeys)`. `attach` registra `keydown`/`keyup` en `window` y `detach` los remueve; `Space` también se cancela en `keyup` (Firefox activa el botón enfocado). Prueba: lint y `tsc --noEmit`.
4. **Render.** Crear `lib/games/arkanoid/render.ts` con `drawFrame(ctx, frame, sheet)`: fondo negro, bloques vivos, explosiones (índice `min(floor(elapsed / 150 × 4), 3)`), paleta y pelota. Si `sheet` es `null` (aún no cargó, o falló), dibuja rectángulos planos con `FALLBACK_COLORS`. Sin textos de estado. Prueba: lint y `tsc --noEmit`.
5. **Motor.** Crear `lib/games/arkanoid/engine.ts` con `createArkanoidGame` (`GameEngineFactory`): estado en el closure; `initGame`; `loadLevel(n)` que arma los bloques desde `LEVELS`, limpia explosiones y recoloca la pelota sobre la paleta con la velocidad del nivel; carga del spritesheet con `Image` (con `onload`/`onerror` que no hacen nada si el motor fue destruido); paleta por teclado y por mouse; rebotes en paredes izquierda, derecha y techo; rebote en la paleta; colisión AABB con bloques, uno por cuadro, `+10` puntos y `vy` invertido; pasar al nivel siguiente al limpiar los bloques y `onGameOver` al limpiar el nivel 5; pérdida de vida al caer la pelota (`onLives`, reposicionar la pelota, `onGameOver` con 0 vidas); loop de `requestAnimationFrame` cancelable con `dt` capado a `MAX_DT` y `dt = 0` en el primer cuadro; `pause()`, `resume()`, `restart()` y `destroy()` (idempotente, cancela el rAF, llama a `input.detach()` y remueve el listener de mouse). Prueba: lint y `tsc --noEmit`.
6. **Cover.** Agregar `.cover-arkanoid` en `app/globals.css` (CSS puro, tokens existentes): un muro de bloques de colores con una pelota y una paleta debajo, visualmente distinto de `.cover-bricks`. Prueba manual: asignar la clase de forma temporal a un elemento `.cover-bg` y revisarla en 375 px y en desktop; el elemento temporal no se commitea.
7. **Registro y migración, en este orden.** Primero agregar `arkanoid: createArkanoidGame` en `lib/games/registry.ts`. Después consultar `select id, sort_order from public.games order by 2`, aplicar con `apply_migration` el insert del Data model (nombre `add_arkanoid_game`), leer la versión real asignada (`select version, name from supabase_migrations.schema_migrations order by version desc limit 1`) y guardar el mismo SQL en `supabase/migrations/<version>_add_arkanoid_game.sql`. Verificar con `execute_sql`: 10 filas en `games`, `arkanoid` jugable y `bloque-buster` con `playable = false`. Prueba manual: `/games` muestra 10 tarjetas y `/games/arkanoid/play` muestra el juego.
8. **Verificación de RLS por REST.** Con `curl` y la publishable key (`apikey` + `Authorization: Bearer`): un `POST /rest/v1/scores` válido para `arkanoid` responde `201`; son rechazados un `score` `0`, un `player_name` de 11 caracteres, un `game_id` inexistente y un `game_id` de un juego no jugable (por ejemplo `bloque-buster`). Borrar con `execute_sql` las filas de prueba al terminar.
9. **Pase final de integración.** Recorrer los criterios de aceptación en `npm run dev` (incluido el doble montaje de Strict Mode y la navegación de ida y vuelta), revisar la consola del navegador y correr `npm run lint` y `npx tsc --noEmit`.

---

## Acceptance criteria

- [ ] `games` tiene 10 filas; `arkanoid` tiene `title = 'ARKANOID'`, `cat = 'ARCADE'`, `color = 'yellow'`, `cover = 'cover-arkanoid'`, `sort_order = 10` y `playable = true`.
- [ ] `bloque-buster` conserva exactamente sus valores anteriores, con `playable = false`; solo `rocas`, `tetris` y `arkanoid` tienen `playable = true`.
- [ ] `list_migrations` muestra `add_arkanoid_game` y `supabase/migrations/` contiene su SQL con la misma versión.
- [ ] `/games` muestra 10 tarjetas, con ARKANOID en último lugar y su cover distinto del de BLOQUE BUSTER; los filtros por categoría siguen funcionando.
- [ ] `/games/arkanoid` muestra el título y la descripción de la base, `—` como mejor marca y `0` como partidas cuando no hay puntajes.
- [ ] `/games/arkanoid/play` muestra un `<canvas>` de 800×600 dentro del marco CRT y no contiene los elementos `.enemy` ni `.player-ship` de la arena falsa.
- [ ] `/games/bloque-buster/play` sigue mostrando la arena falsa con `♥ ♥ ♥`, y su modal de fin de juego dice "ESTE JUEGO AÚN NO TIENE RANKING." sin ofrecer guardar.
- [ ] `GET /games/arkanoid/spritesheet-breakout.png` responde `200` y los bloques, la paleta y la pelota se ven con los sprites del original.
- [ ] Si el PNG no carga (por ejemplo, bloqueando la URL en las herramientas del navegador), el juego sigue jugable con rectángulos de colores planos y sin errores no capturados.
- [ ] El nivel 1 arranca con una parrilla de 10×6 bloques en seis filas de colores, la paleta centrada y la pelota sobre ella moviéndose hacia arriba y a la derecha.
- [ ] `←` y `→` mueven la paleta mientras se mantienen apretadas y no la sacan del canvas.
- [ ] Mover el mouse sobre el canvas centra la paleta bajo el cursor, también con el canvas escalado por CSS, y no la saca del canvas.
- [ ] Presionar flechas o `Espacio` mientras el juego corre no hace scroll de la página.
- [ ] La pelota rebota en las paredes laterales y en el techo; al golpear la paleta sube.
- [ ] Romper un bloque suma exactamente 10 puntos, el HUD "Puntuación" se actualiza en el momento y se ve una explosión de 4 cuadros durante unos 150 ms.
- [ ] Limpiar todos los bloques del nivel 1 muestra el nivel 2 (pirámide), con el HUD en nivel `02`, la pelota sobre la paleta y velocidad ×1.10; los niveles 3, 4 y 5 usan sus patrones y velocidades de la tabla.
- [ ] Al caer la pelota se pierde una vida, el HUD baja de `♥ ♥ ♥` a `♥ ♥` y la pelota reaparece sobre la paleta con la velocidad del nivel; los bloques ya rotos y el puntaje se conservan.
- [ ] Al perder la tercera vida se abre el modal "FIN DEL JUEGO" exactamente una vez, con el puntaje final correcto.
- [ ] Al limpiar el último bloque del nivel 5 se abre el modal "FIN DEL JUEGO" exactamente una vez, con el puntaje final correcto, sin mensaje de victoria dibujado en el canvas.
- [ ] El canvas no dibuja puntaje, nivel, vidas, `PAUSA`, `GAME OVER` ni mensaje de victoria.
- [ ] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'arkanoid'`, el nombre en mayúsculas y el puntaje final, y el modal muestra "PUNTUACIÓN GUARDADA".
- [ ] Tras guardar, `/games/arkanoid` y la pestaña ARKANOID de `/hall-of-fame` muestran ese puntaje, y `best` y `plays` se actualizan.
- [ ] El botón PAUSA y la tecla `P` congelan el juego y muestran "EN PAUSA"; reanudar continúa sin saltos de posición de la pelota.
- [ ] Con el juego en pausa, mover el mouse no mueve la paleta.
- [ ] El botón FIN detiene el juego y abre el modal con el puntaje actual.
- [ ] "JUGAR DE NUEVO" deja la partida en puntaje 0, 3 vidas, nivel 1, nivel 1 reconstruido y el juego corriendo.
- [ ] Con el modal abierto, escribir iniciales (incluidos espacios y flechas) funciona y no mueve la paleta.
- [ ] Al salir con SALIR y volver a entrar (y bajo Strict Mode en `npm run dev`), cada tecla mueve la paleta una sola vez y no quedan listeners de teclado ni de mouse activos fuera de `/games/arkanoid/play`.
- [ ] En un ancho de 375 px el canvas escala sin scroll horizontal y mantiene proporción 4:3; en emulación `pointer: coarse` aparece "REQUIERE TECLADO".
- [ ] ROCAS y TETRIS se juegan igual que antes.
- [ ] Con la publishable key, un `POST /rest/v1/scores` válido para `arkanoid` responde `201`, y se rechazan `score` `0`, `player_name` de 11 caracteres, `game_id` inexistente y `game_id = 'bloque-buster'`; las filas de prueba quedan borradas.
- [ ] `lib/games/arkanoid/` no importa React ni `next/*` (`rg` sin resultados).
- [ ] `git diff` no muestra cambios en `lib/supabase/`, `lib/session-context.tsx`, `components/nav/`, `components/player/`, `resources/` ni `package.json`, y `database.types.ts` no cambió.
- [ ] La consola del navegador no muestra errores ni warnings de React durante una partida completa.
- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.

---

## Decisions taken and discarded

**Tomadas:**

- **Arkanoid como entrada nueva (`arkanoid`), no sobre BLOQUE BUSTER.** La galería suma juegos: BLOQUE BUSTER es otra entrada del catálogo y debe seguir existiendo. A cambio, el catálogo muestra dos juegos de bloques (uno jugable y un placeholder). Se contradice a propósito la sugerencia de la skill "solo activar `playable`", por la misma razón que en la SPEC 07.
- **Spritesheet PNG copiado a `public/games/arkanoid/`.** Es fiel al aspecto original y es el único camino donde el motor sigue siendo TypeScript puro (la URL se pasa a `Image`, sin imports de `next/*`). Se paga una carga asíncrona y un binario versionado en el repo; el respaldo de rectángulos planos acota ese costo.
- **Rectángulos planos como respaldo.** Evita una partida con bloques invisibles si el PNG tarda o falla. Es una decisión de robustez, no de estilo.
- **Sin sonido.** Ni ROCAS ni TETRIS lo tienen y la plataforma no tiene un control de mute; agregar audio sin él obliga a decidir autoplay y volumen en esta spec.
- **Controles: flechas y mouse, sin selector de nivel.** El mouse es lo natural en Arkanoid y el original lo trae. El selector de nivel vivía en el overlay de pausa del canvas, que ahora pertenece a la plataforma; reimplementarlo exigiría cambios en `GamePlayer`.
- **Limpiar el nivel 5 emite `onGameOver`.** Cumple el contrato existente sin tocar la plataforma y permite guardar el puntaje de quien termina el juego. A cambio se pierde el mensaje "¡Completaste el juego!".
- **Port 1:1, incluidas las rarezas del original.** Se conservan: la pelota nace siempre hacia arriba y a la derecha; solo se procesa un bloque por cuadro; cualquier choque con un bloque invierte `vy` sin mirar de qué lado llegó; el rebote en la paleta siempre sube con la misma `vx`, sin ángulo según el punto de impacto; la paleta mide 81 px aunque el sprite sea de 162; el puntaje es fijo en 10 por bloque. Son reglas del juego fuente y cambiarlas es una decisión de diseño nueva.
- **`MAX_DT = 0.05` y `dt = 0` en el primer cuadro.** El original no capa `dt`; sin tope, volver de otra pestaña haría atravesar bloques. Es una desviación mínima y deliberada, necesaria por la pausa de la plataforma.
- **Una copia propia de `input.ts` en `lib/games/arkanoid/`.** Sería la tercera copia (ROCAS, TETRIS, ARKANOID); promoverla a `lib/games/input.ts` pasa a ser deseable, pero refactorizar juegos ya implementados queda fuera de esta spec.
- **Sin cambios de plataforma.** `onLives` ya es opcional desde la SPEC 07 y ARKANOID usa vidas y niveles reales, así que `GamePlayer` funciona sin tocarse.
- **Versión de la migración tomada de Supabase** y **registro antes que migración**, por las mismas razones de la SPEC 07.
- **Cover en CSS puro** con los tokens existentes, como los demás covers.
- **Verificación de tipos con `npx tsc --noEmit`** además de lint, porque ESLint no detecta errores de tipos.

**Descartadas:**

- **Activar `bloque-buster`:** es el atajo más barato (un `update`, sin cover nuevo), pero reemplaza una entrada existente de la galería.
- **Dibujar todo con rectángulos, sin sprites:** coherente con ROCAS y TETRIS y sin assets, pero cambia el aspecto del juego fuente.
- **Mover el PNG a `public/` o editar `resources/`:** `resources/` es referencia intacta; solo se copia.
- **Importar el PNG desde el motor (`import img from "...png"`):** acopla el motor al bundler de Next.js y rompe la regla de "sin `next/*`".
- **Incluir los dos mp3:** riesgo de autoplay bloqueado y sin botón de silencio.
- **Selector de nivel en la pausa:** exigiría cambiar `GamePlayer`; además es una herramienta de desarrollo del original más que una mecánica.
- **Reciclar los niveles en bucle tras el 5:** no tiene fin natural y cambia las reglas del original.
- **Pantalla de victoria en la plataforma:** es un cambio de contrato (`GameCallbacks`) que merece su propia spec.
- **Solo flechas:** más uniforme con los demás juegos, pero quita el control por mouse del original.
- **Ángulo de rebote según el punto de impacto, power-ups, bloques de varios golpes:** mejoran el juego, pero son mecánicas nuevas que el código fuente no tiene.
- **Iframe a `resources/` o pegar `game.js` en un `useEffect`:** mismas razones que en las SPEC 05 y 07.

---

## Identified risks

| Riesgo | Mitigación |
| --- | --- |
| `arkanoid` queda `playable = true` sin motor en el registro (o al revés), y el ranking acepta puntajes de la arena falsa o el modal ofrece guardar y RLS rechaza | El paso 7 fija el orden: registro primero, migración después. Criterios de aceptación sobre las dos condiciones. |
| `sort_order = 10` ya está ocupado y la migración falla por la restricción de unicidad | El paso 7 consulta los `sort_order` existentes antes de aplicar y ajusta el valor y los criterios si hace falta. |
| El spritesheet no carga (404, red, `Image` tras destruir el motor) y el juego queda sin gráficos o lanza errores | Respaldo con rectángulos planos; `onload`/`onerror` no hacen nada si `destroyed`; criterio de aceptación explícito. |
| React Strict Mode monta, desmonta y vuelve a montar el efecto, y deja dos loops, dos listeners de teclado o de mouse duplicados | `destroy()` cancela el rAF, llama a `input.detach()`, remueve el listener de mouse y es idempotente; `GameCanvas` lo invoca en el cleanup. Criterio de aceptación explícito. |
| Se pierde la última vida y se limpia el último bloque en el mismo cuadro, y `onGameOver` se emite dos veces | El estado cambia a `gameover` antes de emitir y el motor emite solo si el estado no era `gameover`; el orden de actualización resuelve primero los bloques y después la pelota perdida. Criterio sobre "exactamente una vez". |
| La pelota a velocidad ×1.46 atraviesa bloques o la paleta (túnel) en cuadros largos | `MAX_DT = 0.05` acota el desplazamiento por cuadro (≈ 35 px a la mayor velocidad vertical, menos que la altura de un bloque más la pelota). Es un límite conocido del port 1:1 en caídas de rendimiento severas. |
| La pelota queda atrapada en un ciclo horizontal sin bajar, por la física 1:1 (`vx` constante, sin ángulo de paleta) | Aceptado como límite del port fiel; cualquier cambio de física queda para una spec propia. |
| El mouse mueve la paleta con el modal abierto o en pausa | El motor ignora `mousemove` si `paused` o `gameover`; criterios de aceptación sobre pausa y modal. |
| El puntaje se calcula en el cliente y se puede falsificar | Mismo riesgo aceptado en la SPEC 06: solo hay validación de forma en la base. |
| La versión de la migración se ordena antes de las existentes si se toma de la hora local | La versión se lee de `supabase_migrations.schema_migrations` después de aplicar. |
| Canvas borroso en pantallas grandes o retina | Aceptado como límite conocido; HiDPI queda fuera de alcance. |

---

## What is **not** in this spec

- Cambios a BLOQUE BUSTER ni a ningún otro juego del catálogo.
- Motores de los demás juegos pendientes.
- Sonido, música o control de mute.
- Selector de nivel, pantalla de victoria o cualquier cambio en `GamePlayer` y `GameCallbacks`.
- Mecánicas nuevas (power-ups, ángulo de rebote, bloques resistentes, lanzamiento manual) y correcciones de la física del original.
- Controles táctiles.
- Cambios de esquema, tablas nuevas o regenerar `database.types.ts`.
- Mover `createInput` a un módulo compartido.
- HiDPI, canvas con otra proporción o pantalla completa.
- Tests automatizados de cualquier tipo.

Cada uno de estos, si se necesita, va en su propia spec.
