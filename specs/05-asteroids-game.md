# SPEC 05 — Juego Asteroids (ROCAS) jugable en el reproductor

> **Status:** Approved
> **Depends on:** SPEC 01 (arcade-vault-mvp-visual)
> **Date:** 2026-10-02
> **Objective:** Reemplazar la arena falsa del reproductor de ROCAS (`/games/rocas/play`) por el juego Asteroids real de `resources/started-games/02-asteroids/`, reescrito como motor TypeScript desacoplado de React y conectado al HUD, la pausa y el modal de fin de juego de la plataforma.

---

## Por qué existe esta spec

Hoy `components/player/GamePlayer.tsx` no ejecuta ningún juego: dibuja una arena decorativa (`.game-arena`) y suma puntaje aleatorio con un `setInterval`. Es el primer juego real que entra a Arcade Vault, así que lo que se decida acá sienta el patrón para los siguientes (`03-tetris` y `04-arkanoid` ya esperan en `resources/started-games/`).

El `game.js` original (≈510 líneas, canvas 800×600) funciona, pero **no se puede pegar tal cual en Next.js**:

- Usa variables globales de módulo (`ship`, `score`, `state`…) y `document.getElementById('canvas')` al cargarse.
- Registra listeners en `window` que nunca se remueven y arranca un `requestAnimationFrame` que nunca se cancela. Con React Strict Mode (doble montaje en dev) o al navegar y volver, quedarían motores duplicados corriendo en paralelo.
- Pinta su propio HUD y su propio "GAME OVER" dentro del canvas, duplicando lo que la plataforma ya tiene (HUD DOM, modal "FIN DEL JUEGO" con guardar puntuación).

El catálogo ya tiene el juego como `rocas` (cover `cover-rocas`, categoría SHOOTER), así que no se agrega ninguna entrada nueva: se le da un motor real al id existente.

Decisiones ya cerradas con el usuario:

1. **Integración:** módulo TypeScript + wrapper React (no iframe, no pegar `game.js` en un `useEffect`).
2. **HUD y game over:** los dibuja la plataforma. El canvas pinta solo el juego (más el indicador del power-up 3x).
3. **Mobile:** canvas responsive sin controles táctiles; en pantallas táctiles se muestra un aviso "REQUIERE TECLADO".
4. **Visual:** se mantiene el estilo original (líneas blancas sobre negro) dentro del marco CRT existente.
5. **Persistencia:** se sigue usando `localStorage` (`av_scores`). Supabase queda para la spec de puntajes.
6. **Catálogo:** se corrige el `long` de ROCAS, que promete OVNIs que el juego no tiene.
7. **Pausa y teclado:** botón PAUSA + tecla `P`; los listeners de teclado viven solo mientras el reproductor está montado.

---

## Scope

**In:**

- `lib/games/types.ts`: contratos `GameEngine`, `GameCallbacks` y `GameEngineFactory`, comunes a cualquier juego futuro.
- `lib/games/registry.ts`: mapa `id de juego → GameEngineFactory`. En esta spec solo contiene `rocas`.
- `lib/games/asteroids/` (TypeScript puro, sin React): `constants.ts`, `utils.ts`, `entities.ts` (`Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`), `input.ts` y `engine.ts` (`createAsteroidsGame`). Es un port fiel de la lógica de `game.js` sin globals y con ciclo de vida limpio.
- `components/player/GameCanvas.tsx` (`"use client"`): monta el `<canvas>`, crea el motor desde el registro en un `useEffect` y lo destruye en el cleanup.
- Cambios en `components/player/GamePlayer.tsx`: si el juego tiene motor en el registro, renderiza `GameCanvas` en lugar de la arena falsa, y puntaje, vidas y nivel salen del motor. Los demás juegos conservan el comportamiento actual sin cambios.
- Fin de juego: al perder la última vida se abre el modal "FIN DEL JUEGO" existente; "GUARDAR PUNTUACIÓN" usa el `saveScore` actual (`av_scores`) con `game: "rocas"`; "JUGAR DE NUEVO" reinicia el motor.
- Botones PAUSA/REANUDAR y FIN conectados al motor real, más la tecla `P` para pausar y reanudar.
- Estilos en `app/globals.css`: `.game-canvas` (escala al ancho disponible manteniendo 4:3) y `.touch-notice` (aviso visible solo con `@media (pointer: coarse)`), usando los tokens existentes.
- Corrección de `long` de ROCAS en `lib/games.ts` para reemplazar la mención a OVNIs por el power-up de disparo triple.

**Out of scope (para specs futuras):**

- Controles táctiles (botones en pantalla para rotar, propulsar y disparar).
- Persistir puntajes en Supabase, ranking real y Salón de la Fama real. El `best` de `lib/games.ts` y los datos de `seededScores` siguen siendo mock.
- Sonido y música.
- OVNIs u otros enemigos que no existen en el `game.js` original.
- Port de `03-tetris` y `04-arkanoid`.
- Soporte HiDPI/retina del canvas (resolución interna fija 800×600, escalada por CSS).
- Auto-pausa al perder foco o al ocultar la pestaña.
- Pantalla completa, gamepad, ajustes de dificultad.
- Modificar o mover los archivos de `resources/started-games/02-asteroids/`: quedan como referencia intacta.
- Tests automatizados — el proyecto sigue sin test runner configurado.

---

## Data model

Esta spec **no introduce datos persistentes nuevos**: reutiliza el registro `av_scores` de `localStorage` tal como está hoy (`{ game, score, name, at }`). Introduce contratos de código y constantes del motor:

**Contratos comunes (`lib/games/types.ts`):**

```ts
export interface GameCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface GameEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
}

export type GameEngineFactory = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
) => GameEngine;
```

**Registro (`lib/games/registry.ts`):**

```ts
export const GAME_ENGINES: Record<string, GameEngineFactory> = {
  rocas: createAsteroidsGame,
};
```

**Constantes del motor (`lib/games/asteroids/constants.ts`)**, valores idénticos a `game.js`:

- Canvas: `W = 800`, `H = 600`. Origen arriba a la izquierda; velocidades en px/s; `dt` máximo 0.05 s.
- Asteroides por tamaño (índice 1 = pequeño, 2 = mediano, 3 = grande): `RADII = [0, 16, 30, 50]`, `SPEEDS = [0, 85, 55, 32]`, `POINTS = [0, 100, 50, 20]`.
- Power-up de disparo triple: `POWERUP_DROP_CHANCE = 0.15`, `POWERUP_DURATION = 5`, `POWERUP_TTL = 12`, `TRIPLE_SPREAD = 0.18`.
- Estado del motor: `'playing' | 'dead' | 'gameover'` (más un flag interno `paused`).

**Contrato de eventos del motor:**

- Al crearse y en cada `restart()`, el motor emite `onScore(0)`, `onLives(3)` y `onLevel(1)`.
- `onScore`, `onLives` y `onLevel` se emiten solo cuando el valor cambia.
- `onGameOver(finalScore)` se emite una sola vez por partida, en el instante en que las vidas llegan a 0.

---

## Implementation plan

Antes de escribir código, consultar la guía de Next.js 16 en `node_modules/next/dist/docs/` (según `AGENTS.md`) para confirmar la convención de Client Components. Si `node_modules/` no existe, instalar dependencias primero. Cada paso deja la app compilando y las pantallas existentes funcionando.

1. **Corregir el catálogo.** En `lib/games.ts`, reemplazar en `long` de `rocas` la frase sobre OVNIs por una mención al power-up de disparo triple. Prueba manual: `/games/rocas` muestra el texto nuevo.
2. **Contratos.** Crear `lib/games/types.ts` con `GameCallbacks`, `GameEngine` y `GameEngineFactory`. Prueba: `npm run lint` sin errores.
3. **Constantes y utilidades.** Crear `lib/games/asteroids/constants.ts` y `lib/games/asteroids/utils.ts` (`wrap`, `dist`, `rand`, `randInt`) portados de `game.js`. Prueba: `npm run lint`.
4. **Entidades.** Crear `lib/games/asteroids/entities.ts` con `Bullet`, `Asteroid`, `PowerUp`, `Ship` y `Particle`. Cada una expone `update(dt)` y `draw(ctx)` recibiendo el contexto por parámetro (sin globals) y un flag `dead`. `Ship.update` recibe el estado de input por parámetro. Prueba: `npm run lint`.
5. **Input.** Crear `lib/games/asteroids/input.ts` con `createInput()` que expone `keys`, `pressed(code)` (semántica de "recién presionada", se consume al leer, ignorando `e.repeat`), `attach()` y `detach()`. `attach` registra `keydown`/`keyup` en `window`; `detach` los remueve. Hace `preventDefault` sobre `ArrowUp`, `ArrowLeft`, `ArrowRight` y `Space` solo mientras el juego esté corriendo (ni pausado ni terminado), para no bloquear la escritura en el input de iniciales del modal. Prueba: `npm run lint`.
6. **Motor: estado y reglas.** Crear `lib/games/asteroids/engine.ts` con `createAsteroidsGame(canvas, callbacks)`: estado de partida encapsulado en el closure, `initGame`, `nextLevel`, `killShip`, `update(dt)` con disparo, colisiones bala-asteroide y nave-asteroide, power-ups y cambio de nivel, y emisión de los callbacks según el contrato. Las reglas se portan 1:1; lo único que cambia es que `Space` ya no reinicia en `gameover` (eso lo hace el modal).
7. **Motor: dibujo y ciclo de vida.** Completar `engine.ts` con `draw()` (sin HUD de score/nivel/vidas ni overlay de GAME OVER; solo el indicador `3x  N.Ns` del power-up), el loop de `requestAnimationFrame` con `dt` capado a 0.05 s, y `pause()`, `resume()` (resetea `lastTime` para evitar un salto de `dt`), `restart()` y `destroy()` (cancela el `requestAnimationFrame` y llama a `input.detach()`). `destroy()` debe ser idempotente.
8. **Registro y canvas en el reproductor.** Crear `lib/games/registry.ts` y `components/player/GameCanvas.tsx` (`<canvas width={800} height={600} tabIndex={-1}>`, motor creado y destruido en un `useEffect`). En `GamePlayer.tsx`, renderizar `GameCanvas` en lugar de `.game-arena` cuando `GAME_ENGINES[game.id]` exista. Prueba manual: `/games/rocas/play` muestra la nave y se controla con el teclado; `/games/caida/play` sigue mostrando la arena falsa.
9. **HUD, fin de juego y pausa.** Conectar los callbacks al estado de `GamePlayer`: puntaje, vidas y nivel reales en el HUD (se elimina el `setInterval` aleatorio y el nivel derivado del puntaje para los juegos con motor); `onGameOver` abre el modal "FIN DEL JUEGO"; FIN pausa el motor y abre el modal con el puntaje actual; "JUGAR DE NUEVO" llama a `restart()`; PAUSA/REANUDAR y la tecla `P` llaman a `pause()`/`resume()`. Tras pausar, reanudar o reiniciar, devolver el foco al canvas para que `Espacio` no active el botón enfocado. Prueba manual: perder las 3 vidas, guardar el puntaje y verificar `av_scores` en devtools.
10. **Responsive y aviso táctil.** Agregar `.game-canvas` (`width: 100%; height: 100%; display: block`, dentro de `.crt-screen` que ya fuerza 4:3) y `.touch-notice` en `app/globals.css`, y renderizar el aviso "REQUIERE TECLADO" en `GameCanvas`. Prueba manual: ancho de 375 px sin scroll horizontal; con emulación táctil aparece el aviso.
11. **Pase final de integración.** Recorrer los criterios de aceptación en `npm run dev` (incluido el doble montaje de Strict Mode y la navegación de ida y vuelta), revisar la consola del navegador y correr `npm run lint`.

---

## Acceptance criteria

- [ ] `/games/rocas/play` muestra un `<canvas>` de 800×600 dentro del marco CRT y no contiene los elementos `.enemy` ni `.player-ship` de la arena falsa; `/games/caida/play` (y los demás juegos) sigue mostrando la arena falsa.
- [ ] `←` y `→` rotan la nave, `↑` propulsa y `Espacio` dispara una bala por pulsación (mantener `Espacio` no dispara en ráfaga).
- [ ] Presionar flechas o `Espacio` mientras el juego corre no hace scroll de la página.
- [ ] La partida empieza con 3 vidas, nivel 1 y 4 asteroides grandes; el HUD DOM muestra `♥ ♥ ♥` y nivel `01`.
- [ ] Destruir un asteroide grande suma 20 puntos, uno mediano 50 y uno pequeño 100, y el HUD "Puntuación" se actualiza en el momento.
- [ ] Un asteroide grande se parte en 2 medianos, uno mediano en 2 pequeños, y uno pequeño no se parte.
- [ ] Chocar con un asteroide resta una vida; la nave reaparece a los 2 s en el centro, invencible 3 s y parpadeando.
- [ ] Destruir todos los asteroides sube el nivel, el HUD muestra `02` y aparecen 5 asteroides (`3 + nivel`).
- [ ] Recoger el power-up activa el disparo triple por 5 s y el canvas muestra el contador `3x  N.Ns`.
- [ ] El canvas no dibuja `SCORE`, `NIVEL`, íconos de vidas ni el texto `GAME OVER`; solo el indicador del power-up.
- [ ] Al perder la última vida se abre el modal "FIN DEL JUEGO" con el puntaje final correcto, exactamente una vez.
- [ ] "GUARDAR PUNTUACIÓN" agrega a `localStorage["av_scores"]` un registro `{ game: "rocas", score, name, at }` y muestra "PUNTUACIÓN GUARDADA".
- [ ] "JUGAR DE NUEVO" cierra el modal y deja la partida en puntaje 0, 3 vidas, nivel 1 y el juego corriendo.
- [ ] El botón PAUSA y la tecla `P` congelan los asteroides y muestran el overlay "EN PAUSA"; REANUDAR (o `P` de nuevo) continúa sin saltos de posición.
- [ ] El botón FIN detiene el juego y abre el modal con el puntaje actual.
- [ ] Con el modal abierto, escribir iniciales en el input (incluyendo espacios y flechas) funciona y no dispara acciones del juego.
- [ ] Tras pulsar PAUSA con el mouse y reanudar, `Espacio` dispara y no vuelve a pausar.
- [ ] Al salir con SALIR y volver a entrar (y bajo Strict Mode en `npm run dev`), `Espacio` crea una sola bala por pulsación y no quedan listeners activos fuera de `/games/rocas/play`.
- [ ] En un ancho de 375 px el canvas escala sin scroll horizontal y mantiene proporción 4:3.
- [ ] En emulación de puntero táctil (`pointer: coarse`) se muestra el aviso "REQUIERE TECLADO"; en desktop no se muestra.
- [ ] `lib/games.ts` ya no menciona OVNIs en el texto de ROCAS.
- [ ] `lib/games/asteroids/` no importa React ni `next/*`.
- [ ] `git diff` no muestra cambios en `lib/supabase/`, `lib/session-context.tsx`, `components/nav/` ni `resources/started-games/`.
- [ ] La consola del navegador no muestra errores ni warnings de React durante una partida completa.
- [ ] `npm run lint` termina sin errores.

---

## Decisions taken and discarded

**Tomadas:**

- **Motor TypeScript desacoplado + wrapper React.** Es más trabajo hoy que pegar el script, pero el motor no sabe nada de React: se testea y se reemplaza solo, y Tetris y Arkanoid reusan `GameEngine`/`GameCallbacks`/registro sin rediseñar nada. Cumple la regla de dependencias del proyecto: la lógica de juego no depende del framework de UI.
- **Contrato mínimo de cuatro callbacks** (`onScore`, `onLives`, `onLevel`, `onGameOver`) en vez de exponer el estado interno: la UI no puede romper el motor y el motor no puede forzar renders.
- **HUD y modal de la plataforma.** Se pierde el GAME OVER dentro del canvas, pero se gana guardar puntaje y un HUD coherente con el resto del sitio.
- **Port fiel de las reglas.** Constantes, física y colisiones se portan sin retoques de balance (incluido el factor `0.82` en la colisión de la nave). El cambio de jugabilidad es solo el que fuerza la integración: `Espacio` ya no reinicia tras perder.
- **`onGameOver` se emite de inmediato**, sin retardo para ver la explosión final. Simple y predecible; un retardo se puede agregar después sin cambiar el contrato.
- **Estilo original blanco sobre negro.** El marco CRT con scanlines ya aporta el look retro, y no se paga el costo de rendimiento de `shadowBlur` en canvas.
- **Canvas con resolución interna fija 800×600 escalada por CSS.** Mantiene la lógica de coordenadas idéntica al original; se acepta cierta suavidad en pantallas grandes o retina.
- **`pause()` sin offset de tiempo**: al reanudar se resetea `lastTime`, y el tope de `dt` en 0.05 s cubre el resto.
- **`preventDefault` solo con el juego corriendo.** Evita el scroll de la página sin romper la escritura en el input del modal ni la navegación por teclado cuando el juego está pausado o terminado.
- **Corregir el `long` del catálogo** en vez de agregar OVNIs: el texto debe describir el juego que existe.

**Descartadas:**

- **Iframe apuntando a `public/`:** cero reescritura, pero el HUD, la pausa y el puntaje final quedarían desconectados (habría que usar `postMessage`) y no escala a otros juegos.
- **Pegar `game.js` en un `useEffect`:** arrastra globals y listeners sin limpiar; con Strict Mode corren dos loops a la vez.
- **Mantener HUD y GAME OVER dentro del canvas:** más fiel al original, pero duplica el HUD y deja afuera el guardado de puntaje.
- **Recolorear a paleta neón:** más integrado con la marca, pero agrega decisiones de diseño y costo de rendimiento que no pertenecen a "hacer jugable el juego".
- **Controles táctiles ahora:** hace crecer la spec con UI, estados y pruebas en dispositivo reales; va en su propia spec.
- **Guardar el puntaje en Supabase ahora:** requiere tablas, RLS y auth real, y viola "una spec, un objetivo".
- **Auto-pausa al perder foco:** útil, pero es comportamiento nuevo que no existe en el original ni se pidió.

---

## Identified risks

| Riesgo | Mitigación |
| --- | --- |
| React Strict Mode monta, desmonta y vuelve a montar el efecto en dev, y podría dejar dos loops o listeners duplicados | `destroy()` cancela el `requestAnimationFrame` y llama a `input.detach()`, es idempotente, y el `useEffect` siempre lo invoca en el cleanup. Criterio de aceptación explícito de una sola bala por pulsación. |
| Un botón con foco (PAUSA) se activa con `Espacio` y pausa el juego en mitad de una partida | Devolver el foco al canvas (`tabIndex={-1}`) tras pausar, reanudar o reiniciar, y hacer `preventDefault` sobre `Espacio` mientras el juego corre. |
| `preventDefault` sobre `Espacio` y flechas rompe la escritura en el input de iniciales del modal | Solo se aplica con el motor en estado corriendo; con el modal abierto el motor está pausado o en `gameover`. Criterio de aceptación sobre el input. |
| Salto de `dt` al reanudar tras una pausa larga hace que los objetos "teletransporten" | `resume()` resetea `lastTime`, y el tope de 0.05 s por frame limita cualquier salto residual. |
| `onGameOver` se emite dos veces o el modal se abre con estado inconsistente | El motor emite el evento una sola vez por partida (flag interno que se limpia en `restart()`), y el modal depende del callback. Criterio de aceptación sobre "exactamente una vez". |
| Canvas borroso en pantallas grandes o retina por escalar 800×600 con CSS | Aceptado como límite conocido de esta spec; HiDPI queda fuera de alcance. |
| En móvil el juego es injugable sin teclado | Aviso visible "REQUIERE TECLADO" en `pointer: coarse`; los controles táctiles quedan para otra spec. |
| El `localStorage` no está disponible (modo privado) al guardar puntaje | Se reusa el `saveScore` actual, que ya hace `try/catch` y simplemente no persiste. |

---

## What is **not** in this spec

- Controles táctiles ni gamepad.
- Persistencia de puntajes en Supabase, ranking real o Salón de la Fama real.
- Sonido, música u OVNIs.
- Port de Tetris y Arkanoid (cada uno va en su propia spec).
- HiDPI/retina, pantalla completa y auto-pausa al perder foco.
- Cambios en cualquier pantalla distinta del reproductor (más la corrección de texto del catálogo).
- Tests automatizados de cualquier tipo.

Cada uno de estos, si se necesita, va en su propia spec.
