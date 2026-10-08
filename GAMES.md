# Juegos implementados — Arcade Vault

Juegos **jugables** de la galería: tienen motor real registrado en `lib/games/registry.ts` (`GAME_ENGINES`) y `playable = true` en la tabla `games` de Supabase, por lo que guardan puntajes en el ranking.

> Actualizado: 2026-10-08 · 5 juegos jugables de 5 en el catálogo.

## Resumen

| # | Juego | Slug | Categoría | Color | Vidas | Spec | Origen |
| - | ----- | ---- | --------- | ----- | ----- | ---- | ------ |
| 1 | ROCAS | `rocas` | SHOOTER | yellow | 3 | [05](specs/05-asteroids-game.md) | `resources/started-games/02-asteroids` |
| 2 | TETRIS | `tetris` | PUZZLE | cyan | — | [07](specs/07-tetris-game.md) | `resources/started-games/03-tetris` |
| 3 | ARKANOID | `arkanoid` | ARCADE | yellow | 3 | [08](specs/08-arkanoid-game.md) | `resources/started-games/04-arkanoid` |
| 4 | SNAKE | `snake` | ARCADE | green | — | [09](specs/09-snake-game.md) | Implementación propia (sprites de frutas) |
| 5 | CROAC | `croac` | ARCADE | magenta | 3 | [10](specs/10-croac-game.md) | Implementación propia (game jam, todo en canvas) |

Todos se juegan en `/games/<slug>/play`, con lienzo interno de 800×600 escalado a 4:3. La plataforma (`GamePlayer`) pone el HUD, la pausa con `P`, el modal "FIN DEL JUEGO" y el guardado del puntaje.

En dispositivos táctiles (`pointer: coarse`) aparece un panel de controles dentro del marco CRT, debajo del canvas ([spec 12](specs/12-touch-controls.md)): D-pad a la izquierda y botones de acción a la derecha. Despacha eventos de teclado sintéticos en `window`, así que los motores no cambian. El layout de cada juego vive en `lib/games/<slug>/touch.ts` y se registra en `GAME_TOUCH_CONTROLS`; un juego con motor sin layout muestra "REQUIERE TECLADO".

---

## ROCAS (Asteroids)

*Pulveriza asteroides en gravedad cero.*

- **Ruta:** `/games/rocas` · **Motor:** `lib/games/asteroids/` (`createAsteroidsGame`)
- **Cover:** `.cover-rocas` · **Migración:** `20261005171227_seed_games.sql` (fila del catálogo inicial)

| Control | Acción |
| ------- | ------ |
| `←` / `→` | Rotar la nave |
| `↑` | Propulsar |
| `Espacio` | Disparar |

**Táctil** (`lib/games/asteroids/touch.ts`): D-pad `←` `→` `↑` con diagonales (arriba-izquierda/derecha rota y propulsa a la vez) · botón `DISPARO` (`Espacio`).

**Reglas**
- 3 vidas; reaparición tras 2 s.
- Arranca con 4 asteroides; cada asteroide se divide al recibir un disparo (grande → mediano → pequeño).
- Puntos: grande 20, mediano 50, pequeño 100.
- Power-up de **disparo triple** (5 s): 15 % de probabilidad al destruir un asteroide, garantizado cada 5 destrucciones.
- Limpiar el campo sube de nivel.

---

## TETRIS

*Encaja las piezas y limpia líneas sin tocar el techo.*

- **Ruta:** `/games/tetris` · **Motor:** `lib/games/tetris/` (`createTetrisGame`)
- **Cover:** `.cover-tetris` · **Migración:** `20261005193646_add_tetris_game.sql`

| Control | Acción |
| ------- | ------ |
| `←` / `→` | Mover la pieza (con autorrepetición) |
| `↓` | Caída suave |
| `↑` / `X` | Rotar (con wall kicks) |
| `Espacio` | Caída instantánea |

**Táctil** (`lib/games/tetris/touch.ts`): D-pad `←` `→` `↓` con autorrepetición al mantener · botones `ROTAR` (`↑`, sin autorrepetición) y `CAÍDA` (`Espacio`).

**Reglas**
- Tablero de 10×20, con vista previa de la siguiente pieza y pieza fantasma.
- 7 piezas clásicas más la pieza "N" (tuerca) del juego original.
- Puntos por líneas: 1 → 100, 2 → 300, 3 → 500, 4 → 800. Caída suave +1 y caída instantánea +2 por celda.
- Sube de nivel cada 10 líneas; la caída acelera de 1000 ms a un mínimo de 100 ms (−90 ms por nivel).
- Sin vidas: la partida termina cuando una pieza no cabe al aparecer.

---

## ARKANOID

*Rompe el muro de bloques sin dejar caer la pelota.*

- **Ruta:** `/games/arkanoid` · **Motor:** `lib/games/arkanoid/` (`createArkanoidGame`)
- **Cover:** `.cover-arkanoid` · **Migración:** `20261005203853_add_arkanoid_game.sql`
- **Assets:** `public/games/arkanoid/spritesheet-breakout.png`

| Control | Acción |
| ------- | ------ |
| `←` / `→` | Mover la paleta |
| Mouse | La paleta sigue al cursor |

**Táctil** (`lib/games/arkanoid/touch.ts`): D-pad `←` `→` (la paleta se mueve mientras se mantiene) · sin botones de acción.

**Reglas**
- 3 vidas; se pierde una cuando la pelota cae.
- 5 niveles, cada uno con su patrón de bloques y una pelota más rápida.
- 10 puntos por bloque.
- Superar el nivel 5 termina la partida.

---

## SNAKE

*Come frutas, crece y no te muerdas la cola.*

- **Ruta:** `/games/snake` · **Motor:** `lib/games/snake/` (`createSnakeGame`)
- **Cover:** `.cover-snake-fruit` · **Migración:** `20261006183212_add_snake_game.sql`
- **Assets:** `public/games/snake/fruits.png`
- **Skins:** classic (default), neon, retro

| Control | Acción |
| ------- | ------ |
| `↑` `↓` `←` `→` / `W` `A` `S` `D` | Cambiar de dirección (hasta 2 giros en cola) |

**Táctil** (`lib/games/snake/touch.ts`): D-pad `↑` `↓` `←` `→` sin diagonales (deslizar el pulgar cambia la dirección) · sin botones de acción.

**Reglas**
- Tablero de 20×15 celdas; la serpiente empieza con largo 3.
- 10 puntos por fruta; cada fruta alarga la serpiente.
- Sube de nivel cada 5 frutas; el paso acelera de 150 ms a un mínimo de 70 ms (−10 ms por nivel).
- Sin vidas: chocar con una pared o con uno mismo termina la partida.

---

## CROAC

*Cruza la carretera y el río sin convertirte en papilla.*

- **Ruta:** `/games/croac` · **Motor:** `lib/games/croac/` (`createCroacGame`)
- **Cover:** `.cover-croac` · **Migración:** `20261008203423_add_croac_game.sql`
- **Assets:** ninguno (todo se dibuja en el canvas)

| Control | Acción |
| ------- | ------ |
| `↑` `↓` `←` `→` / `W` `A` `S` `D` | Saltar una celda (40 px); una pulsación = un salto, hasta 2 en cola |

**Táctil** (`lib/games/croac/touch.ts`): D-pad `↑` `↓` `←` `→` sin diagonales ni autorrepetición (cada toque es un salto) · sin botones de acción.

**Reglas**
- Grilla de 20×15 celdas: seto con 5 bahías, río (filas 2–6), franja segura, carretera (filas 8–12), vereda de salida y barra de tiempo.
- 3 vidas; 30 s por rana (la barra pasa a amarillo bajo 10 s y a magenta bajo 5 s). Al morir, 1 s de animación y reaparece en la salida.
- Muere al tocar un vehículo, caer al agua, salir del canvas arrastrada por el río, quedarse sin tiempo o saltar al seto o a una bahía ocupada.
- En el río la rana viaja sobre troncos y tortugas; las tortugas que se sumergen (una por fila, filas 3 y 6) avisan hundiéndose 0,6 s y quedan 1,2 s bajo el agua.
- Puntos: 10 por cada fila nueva, 50 por bahía + 10 por cada medio segundo restante (máx. 600), 1000 al llenar las 5 bahías.
- Llenar las 5 bahías sube de nivel: las bahías se vacían y el tráfico acelera +12 % por nivel hasta ×1,96 en el nivel 9.
- Determinista: no hay azar en el tráfico.

---

## Cómo agregar un juego

Usá el skill `arcade-vault-game`: primero escribe la spec en `specs/NN-<slug>-game.md` (Draft) y espera aprobación; después crea el motor, lo registra en `GAME_ENGINES`, aplica la migración con `playable = true`, agrega la clase `.cover-*` y su layout táctil (`lib/games/<slug>/touch.ts` en `GAME_TOUCH_CONTROLS`). Al terminar, sumá el juego a este archivo.
