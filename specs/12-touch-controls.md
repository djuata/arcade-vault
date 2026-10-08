# SPEC 12 — Controles táctiles para mobile

> **Status:** Implemented
> **Depends on:** SPEC 05 (asteroids-game), SPEC 07 (tetris-game), SPEC 08 (arkanoid-game), SPEC 09 (snake-game), SPEC 11 (snake-skins)
> **Date:** 2026-10-08
> **Objective:** Que los juegos con motor se puedan jugar en dispositivos táctiles con un panel de controles (D-pad a la izquierda y botones de acción a la derecha) dentro del marco CRT, debajo del canvas, que despacha eventos de teclado sintéticos sin tocar los motores.

---

## Por qué existe esta spec

Hoy en un teléfono los juegos no se pueden jugar: `GameCanvas` muestra el aviso "REQUIERE TECLADO" con `@media (pointer: coarse)` y nada más. La idea de diseño (`idea-canvas-controls.png`) propone un D-pad en cruz y botones en rombo estilo gamepad. Hay tres puntos que no son obvios:

- **Los motores no se tocan.** Los cuatro `input.ts` (`asteroids`, `tetris`, `arkanoid`, `snake`) escuchan `keydown`/`keyup` en `window` y solo leen `e.code` (y `e.repeat` en SNAKE). Un `KeyboardEvent` sintético despachado en `window` con el `code` correcto es indistinguible para ellos. Ningún motor revisa `isTrusted`. Los juegos nuevos heredan el soporte táctil sin escribir input propio.
- **Cada juego necesita cosas distintas.** ROCAS necesita multitouch (rotar + propulsar con el D-pad y disparar a la vez). TETRIS depende de la autorrepetición del teclado en `←`/`→`/`↓` (`REPEAT_KEYS` en `tetris/engine.ts`). ARKANOID lee teclas sostenidas (`keys[...]`). SNAKE solo quiere pulsaciones nuevas. Por eso el layout es un **mapa por juego**, no un control fijo.
- **El D-pad es una sola zona, no cuatro botones.** En SNAKE el pulgar se desliza de `↑` a `←` sin levantarse. Con cuatro botones separados y pointer capture, ese deslizamiento no cambia la dirección. El D-pad calcula la dirección por el ángulo del dedo respecto de su centro y la actualiza en cada `pointermove`.

---

## Alcance

**Dentro:**

- Plataforma de controles táctiles:
  - `lib/games/touch-controls.ts` (nuevo, sin React): tipos del layout, constantes de autorrepetición, `dispatchGameKey` y `directionFromVector`.
  - `lib/games/registry.ts`: se agrega `GAME_TOUCH_CONTROLS`.
  - `components/player/TouchControls.tsx` (nuevo, `"use client"`): panel con el D-pad y los botones de acción.
  - `components/player/GameCanvas.tsx`: el aviso "REQUIERE TECLADO" pasa a depender de una prop.
  - `components/player/GamePlayer.tsx`: monta el panel dentro de `.crt`, entre `.crt-screen` y `.crt-bottom`.
  - `app/globals.css`: solo reglas nuevas con prefijo `.av-touch-*`.
- Un layout por juego, en su carpeta: `lib/games/asteroids/touch.ts`, `lib/games/tetris/touch.ts`, `lib/games/arkanoid/touch.ts`, `lib/games/snake/touch.ts`.
- Documentación: `GAMES.md` (controles táctiles por juego), `.agents/skills/arcade-vault-game/SKILL.md` (el layout táctil pasa a ser parte de crear un juego) y `CLAUDE.md` (sección Game engines).

**Fuera de alcance (para specs futuras):**

- Arrastrar el dedo sobre el canvas de ARKANOID para mover la paleta (obligaría a tocar el motor).
- Botón o preferencia para ocultar/mostrar los controles (toggle en el HUD, `localStorage`).
- Compactar u ocultar el HUD en mobile. El HUD queda como está.
- Controles superpuestos sobre el canvas.
- Vibración (`navigator.vibrate`).
- Layout específico para horizontal (landscape) o pantalla completa.
- Personalizar posición, tamaño u opacidad de los controles.
- Soporte de gamepads físicos (Gamepad API).
- Controles para los juegos sin motor (arena mock).
- Layout táctil de CROAC (SPEC 10): todavía no tiene motor; cuando se implemente, agrega su `touch.ts` según el skill actualizado.
- Configurar un test runner o tests automatizados.

---

## Modelo de datos

```ts
// lib/games/touch-controls.ts

export type DpadDirection = "up" | "down" | "left" | "right";

/** A keyboard key the touch control emulates. */
export interface TouchKey {
  /** KeyboardEvent.code the engine reads, e.g. "ArrowLeft", "Space". */
  code: string;
  /** Holding re-emits keydown with repeat: true, like a held keyboard key. */
  repeat?: boolean;
}

export interface TouchActionButton extends TouchKey {
  /** Stable id, used as React key. */
  id: string;
  /** Spanish action label shown on the button, e.g. "DISPARO". */
  label: string;
}

export interface TouchControlsLayout {
  /** Only mapped directions react; an unmapped sector does nothing. */
  dpad: Partial<Record<DpadDirection, TouchKey>>;
  /** Diagonal sectors press two directions at once (ROCAS: rotate + thrust). */
  diagonals?: boolean;
  /** 0 to 4 action buttons, right side. */
  buttons: readonly TouchActionButton[];
}

export const TOUCH_REPEAT_DELAY_MS = 170;
export const TOUCH_REPEAT_INTERVAL_MS = 50;
/** Fraction of the D-pad radius where touches are ignored. */
export const DPAD_DEAD_ZONE = 0.25;
```

```ts
// lib/games/registry.ts — slug → layout. Games without an entry show "REQUIERE TECLADO".
export const GAME_TOUCH_CONTROLS: Readonly<Record<string, TouchControlsLayout | undefined>>;
```

Funciones puras de `lib/games/touch-controls.ts` (firmas, la implementación va en el código):

- `dispatchGameKey(type: "keydown" | "keyup", code: string, repeat = false): void` → `window.dispatchEvent(new KeyboardEvent(type, { code, repeat, bubbles: true, cancelable: true }))`.
- `directionFromVector(dx: number, dy: number, radius: number, diagonals: boolean): DpadDirection[]` → `[]` dentro de la zona muerta; con `diagonals: false`, 4 sectores de 90°; con `diagonals: true`, 8 sectores de 45° y los diagonales devuelven dos direcciones (p. ej. `["up", "left"]`).

### Layouts por juego

| Juego | D-pad | Diagonales | Botones |
| ----- | ----- | ---------- | ------- |
| ROCAS (`rocas`) | `←` `ArrowLeft`, `→` `ArrowRight`, `↑` `ArrowUp` | Sí | `DISPARO` → `Space` |
| TETRIS (`tetris`) | `←` `ArrowLeft` (repeat), `→` `ArrowRight` (repeat), `↓` `ArrowDown` (repeat) | No | `ROTAR` → `ArrowUp`, `CAÍDA` → `Space` |
| ARKANOID (`arkanoid`) | `←` `ArrowLeft`, `→` `ArrowRight` | No | — |
| SNAKE (`snake`) | `↑` `ArrowUp`, `↓` `ArrowDown`, `←` `ArrowLeft`, `→` `ArrowRight` | No | — |

Convenciones:

- Cada `touch.ts` exporta `<NOMBRE>_TOUCH_CONTROLS: TouchControlsLayout` (p. ej. `SNAKE_TOUCH_CONTROLS`), igual que `SNAKE_SKINS`.
- Una dirección sin mapear no se dibuja en el D-pad (queda el hueco de la cruz) y su sector no despacha nada.
- Sin botones, la columna derecha no se renderiza y el D-pad queda centrado.
- No se persiste nada: no hay `localStorage`, ni Supabase, ni migraciones.

---

## Comportamiento

**Visibilidad.** El panel `.av-touch-controls` tiene `display: none` y se muestra con `@media (pointer: coarse)`. En esos dispositivos reemplaza al aviso "REQUIERE TECLADO". Si el juego tiene motor pero no tiene entrada en `GAME_TOUCH_CONTROLS`, el aviso sigue apareciendo como hoy. Los juegos sin motor no muestran ni panel ni aviso.

**Botón de acción.**

- `pointerdown` → `setPointerCapture`, `dispatchGameKey("keydown", code)` y estado presionado.
- Si `repeat`, tras `TOUCH_REPEAT_DELAY_MS` re-emite `keydown` con `repeat: true` cada `TOUCH_REPEAT_INTERVAL_MS` hasta soltar.
- `pointerup`, `pointercancel` o `lostpointercapture` → `dispatchGameKey("keyup", code)`, corta la repetición y quita el estado presionado.
- Cada botón es independiente: dos dedos en dos botones (o D-pad + botón) funcionan a la vez.

**D-pad.**

- Una sola zona circular con `setPointerCapture` y un solo puntero activo a la vez (un segundo dedo sobre el D-pad se ignora).
- En `pointerdown` y en cada `pointermove` calcula las direcciones con `directionFromVector`. Hace `keyup` de las direcciones que dejaron de estar activas y `keydown` de las nuevas. Las que siguen activas no se re-emiten (salvo la autorrepetición de las marcadas `repeat`).
- Al soltar o cancelar, `keyup` de todas las direcciones activas.

**Liberación garantizada.** Ninguna tecla queda "pegada". El componente suelta todo lo presionado (`keyup` + cortar timers) en: desmontaje, `window` `blur`, `document` `visibilitychange` a oculto y `pointercancel`. Pausar no suelta nada: el motor ya ignora la entrada en pausa, igual que con teclado físico.

**Gestos del navegador.** El panel usa `touch-action: none`, `user-select: none` y `-webkit-touch-callout: none`. `onContextMenu` hace `preventDefault()` para que el long-press de Android no abra el menú. Presionar los controles no hace scroll, ni zoom por doble toque, ni selecciona texto.

**Foco y accesibilidad.** El panel es `role="group"` con `aria-label="Controles táctiles"`. Cada botón es un `<button type="button" tabIndex={-1}>` con `aria-label` (las direcciones: "Arriba", "Abajo", "Izquierda", "Derecha"; los botones: su `label`). No entran en el orden de tabulación porque el teclado físico ya cubre esos controles. No se despacha `KeyP`: la pausa sigue en el botón PAUSA del HUD.

**Feedback.** Solo visual: el estado presionado (`data-pressed="true"`) aplica glow neón con los tokens existentes (`--cyan` para el D-pad, `--magenta` para los botones de acción).

**Layout visual.** Mobile-first. Dentro de `.crt`, debajo de `.crt-screen` y encima de `.crt-bottom`. Grid de dos columnas (D-pad izquierda, botones derecha), con `min-width: 0` en los ítems. El D-pad mide `clamp(8rem, 38vw, 10rem)` de lado. Los botones de acción tienen como mínimo `3.5rem` × `3.5rem` (por encima de los 44 px), fuente `var(--font-press-start)` y tamaño mínimo `0.875rem`. Con dos botones van en diagonal (rombo parcial); con uno va centrado verticalmente.

---

## Plan de implementación

Antes de escribir código, consultar en `node_modules/next/dist/docs/` lo necesario de React 19 / Next 16 (según `AGENTS.md`). Cada paso deja la app compilando y los cuatro juegos funcionando con teclado. Verificación estática por paso: `npm run lint` y `npx tsc --noEmit` (sin build).

1. **Plataforma pura.** Crear `lib/games/touch-controls.ts` con los tipos, constantes, `dispatchGameKey` y `directionFromVector` del modelo de datos (sin React, sin `next/*`). Prueba: lint y `tsc --noEmit`.
2. **Layouts y registro.** Crear los cuatro `lib/games/<slug>/touch.ts` con la tabla de layouts. En `lib/games/registry.ts` agregar `GAME_TOUCH_CONTROLS` con las cuatro entradas. Prueba: lint y `tsc --noEmit`; nada cambia en pantalla.
3. **Aviso condicional.** En `GameCanvas.tsx`, agregar la prop `requiresKeyboard: boolean` y renderizar `.touch-notice` solo si es `true`. En `GamePlayer.tsx`, pasar `requiresKeyboard={GAME_TOUCH_CONTROLS[game.id] === undefined}`. Prueba manual en emulación mobile: el aviso desaparece en los cuatro juegos (todavía sin controles).
4. **Botones de acción.** Crear `components/player/TouchControls.tsx` con la prop `layout: TouchControlsLayout`. Renderizar solo la columna de botones con el comportamiento de "Botón de acción" y la "Liberación garantizada". Montarlo en `GamePlayer.tsx` dentro de `.crt`, entre `.crt-screen` y `.crt-bottom`, solo si hay motor y layout. Agregar en `app/globals.css` las reglas `.av-touch-controls`, `.av-touch-actions`, `.av-touch-btn` y la visibilidad con `pointer: coarse`. Prueba manual: en ROCAS, `DISPARO` dispara; en TETRIS, `CAÍDA` y `ROTAR` funcionan.
5. **D-pad.** Agregar el D-pad al mismo componente con el comportamiento de "D-pad" (zona única, ángulo, zona muerta, diagonales opcionales, autorrepetición para las direcciones `repeat`). Agregar `.av-touch-dpad` y `.av-touch-dir` en `app/globals.css`. Prueba manual: SNAKE gira deslizando el pulgar sin levantarlo; TETRIS mueve con autorrepetición al mantener.
6. **Gestos y pulido visual.** Aplicar `touch-action`, `user-select`, `-webkit-touch-callout`, `onContextMenu`, el estado `data-pressed` con glow y el layout de grid de "Layout visual". Prueba manual: mantener presionado no abre menú, no selecciona texto, no hace scroll ni zoom.
7. **Documentación.** En `GAMES.md`, agregar en cada juego una fila o línea `Táctil` con su layout. En `.agents/skills/arcade-vault-game/SKILL.md`, agregar el paso "crear `lib/games/<slug>/touch.ts` y registrarlo en `GAME_TOUCH_CONTROLS`" y la regla "los motores leen `e.code`, nunca `e.key` ni `isTrusted`". En `CLAUDE.md`, sección Game engines, mencionar `GAME_TOUCH_CONTROLS` y `TouchControls.tsx`. Prueba: `rg GAME_TOUCH_CONTROLS CLAUDE.md .agents/skills/arcade-vault-game/SKILL.md` devuelve resultados en ambos.

---

## Criterios de aceptación

**Visibilidad**

- [ ] En desktop (`pointer: fine`), `/games/rocas/play`, `/games/tetris/play`, `/games/arkanoid/play` y `/games/snake/play` se ven igual que antes: sin panel táctil y sin aviso.
- [ ] En emulación mobile (Playwright MCP, 390×844, touch), los cuatro juegos muestran el panel dentro del CRT, entre la pantalla y la barra "SEÑAL OK", y no muestran "REQUIERE TECLADO".
- [ ] En emulación mobile, un juego sin motor (p. ej. `/games/serpentina/play`) no muestra panel ni aviso.
- [ ] El panel de SNAKE y ARKANOID no tiene columna de botones de acción.
- [ ] El D-pad de ARKANOID solo dibuja `←` y `→`; el de ROCAS no dibuja `↓`; el de TETRIS no dibuja `↑`.
- [ ] A 375 px de ancho no hay scroll horizontal en la página del player.

**Juego (en un teléfono real o emulación con touch)**

- [ ] ROCAS: mantener `↑` propulsa mientras se mantiene; `←`/`→` rotan; `DISPARO` dispara una vez por toque.
- [ ] ROCAS: con un dedo en el D-pad (rotando o propulsando) y otro en `DISPARO`, la nave dispara sin dejar de rotar o propulsar.
- [ ] ROCAS: el sector diagonal arriba-izquierda rota a la izquierda y propulsa a la vez.
- [ ] TETRIS: un toque corto en `←` mueve la pieza exactamente una celda.
- [ ] TETRIS: mantener `←` más de ~170 ms mueve la pieza de forma continua hasta soltar.
- [ ] TETRIS: `ROTAR` rota una vez por toque y `CAÍDA` hace caída instantánea.
- [ ] ARKANOID: mantener `←` o `→` mueve la paleta mientras se mantiene y se detiene al soltar.
- [ ] SNAKE: deslizar el pulgar de `↑` a `←` sin levantarlo gira la serpiente hacia la izquierda.
- [ ] SNAKE: un toque en el centro del D-pad (zona muerta) no cambia la dirección.

**Robustez**

- [ ] Mantener `↑` en ROCAS y cambiar de pestaña: al volver, la nave no sigue propulsando.
- [ ] Mantener `→` en ARKANOID y arrastrar el dedo fuera del panel antes de soltar: al soltar, la paleta se detiene.
- [ ] Mantener presionado cualquier control más de 1 s no abre el menú contextual, no selecciona texto y no hace scroll.
- [ ] Con el juego en pausa, tocar los controles no mueve nada; al reanudar, el juego responde de nuevo.
- [ ] Tocar los controles no hace que la página haga zoom por doble toque.
- [ ] El teclado físico sigue funcionando igual en los cuatro juegos, incluida `P` para pausar.

**Código**

- [ ] `git diff` no muestra cambios en `lib/games/*/engine.ts`, `lib/games/*/input.ts`, `lib/games/types.ts`, `supabase/`, `public/`, `resources/` ni `package.json`.
- [ ] `lib/games/touch-controls.ts` y los `lib/games/<slug>/touch.ts` no importan React ni `next/*`.
- [ ] Las reglas nuevas de `app/globals.css` usan solo el prefijo `.av-touch-*`.
- [ ] `npm run lint` y `npx tsc --noEmit` pasan sin errores y la consola del navegador no muestra errores al jugar.

---

## Decisiones

- **Sí:** panel debajo del canvas, dentro del marco CRT. No tapa el juego y queda cerca del pulgar, como el panel de una maquinita arcade.
- **No:** controles superpuestos semitransparentes (como en la imagen original). En un canvas 4:3 de un teléfono vertical tapan buena parte del área de juego.
- **No:** panel fuera del CRT. Queda más lejos del juego y obliga a más scroll.
- **Sí:** `KeyboardEvent` sintéticos en `window`. Cero cambios en los cuatro motores, y los juegos nuevos los heredan.
- **No:** nuevo contrato `engine.press(action)` en `GameEngine`. Más tipado, pero obliga a tocar los cuatro motores y el template del skill.
- **Sí:** un `touch.ts` por juego, registrado en `GAME_TOUCH_CONTROLS`. Mismo patrón que `SNAKE_SKINS` + `GAME_SKINS`, y los `code` quedan junto al motor que los lee.
- **No:** un layout fijo para todos. Mostraría botones muertos y etiquetas sin sentido para cada juego.
- **Sí:** D-pad como zona única con detección por ángulo. Permite deslizar el pulgar entre direcciones, crítico para SNAKE.
- **No:** cuatro botones de dirección independientes. Con pointer capture, deslizar el dedo no cambia de dirección.
- **Sí:** diagonales opcionales por layout (`diagonals`), activas solo en ROCAS. En SNAKE una diagonal encolaría dos giros; en TETRIS movería y bajaría a la vez.
- **Sí:** tecla sostenida + autorrepetición opcional por tecla (170 ms / 50 ms). Imita el teclado; TETRIS necesita repetir `←`/`→`/`↓`.
- **No:** autorrepetición en `ROTAR` de TETRIS, aunque `ArrowUp` está en `REPEAT_KEYS` del motor. En táctil, rotar sin querer es más frecuente que querer rotar varias veces.
- **Sí:** visibilidad automática con `@media (pointer: coarse)`, solo CSS. Sin estado ni persistencia.
- **No:** toggle para ocultar/mostrar en el HUD. Suma estado y `localStorage`; queda para otra spec si hace falta.
- **Sí:** ARKANOID solo con botones `←`/`→`. Mantiene la regla de no tocar motores.
- **No:** arrastrar sobre el canvas en ARKANOID. Requiere pointer events en el motor; otra spec.
- **Sí:** etiquetas de acción en español (`DISPARO`, `ROTAR`, `CAÍDA`). Se entienden sin leer instrucciones.
- **No:** letras estilo gamepad (A/B/X/Y). Hay que aprender qué hace cada una en cada juego.
- **Sí:** solo feedback visual. `navigator.vibrate` no existe en iOS Safari.
- **Sí:** el HUD no cambia. Las líneas sobre el HUD en la imagen solo marcaban zonas.
- **Sí:** botones con `tabIndex={-1}`. El teclado físico ya cubre esos controles; no ensucian la tabulación.
- **No:** despachar `KeyP` desde el panel. La pausa ya está en el HUD.
- **Sí:** verificación manual en teléfono real + emulación mobile de Playwright MCP. El proyecto no tiene test runner; configurarlo merece su propia spec.
- **Sí:** actualizar `GAMES.md`, el skill `arcade-vault-game` y `CLAUDE.md`. Así un juego nuevo no sale sin controles táctiles.

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Un motor futuro lee `e.key` o `isTrusted` y deja de responder a los eventos sintéticos | El skill `arcade-vault-game` documenta que los motores leen solo `e.code`. Los cuatro motores actuales ya lo cumplen. |
| Una tecla queda "pegada" (la nave sigue propulsando) si se pierde el `pointerup` | `setPointerCapture` + `lostpointercapture`, `pointercancel`, `blur`, `visibilitychange` y desmontaje sueltan todo. Hay criterios de aceptación específicos. |
| El panel suma altura y en teléfonos chicos el canvas + controles no entran sin scroll | Aceptado. `touch-action: none` en el panel evita scroll accidental mientras se juega. El modo landscape queda para otra spec. |
| Long-press abre el menú contextual o selecciona texto en Android/iOS | `onContextMenu` con `preventDefault`, `user-select: none`, `-webkit-touch-callout: none`. |
| Tablets o laptops táctiles con teclado físico ven el panel sin necesitarlo | Inofensivo: el teclado sigue funcionando. Un toggle queda para otra spec. |
| Laptops táctiles que reportan `pointer: fine` no muestran el panel | Aceptado: tienen teclado. |
| La autorrepetición sintética difiere del ritmo del teclado del sistema | Constantes `TOUCH_REPEAT_DELAY_MS` y `TOUCH_REPEAT_INTERVAL_MS` en un solo lugar para ajustar. |
| `KeyboardEvent` sintético con `Space` activa un botón con foco | Los botones del panel tienen `tabIndex={-1}` y el `preventDefault` de `Space` de los motores sigue activo. |

---

## Lo que **no** está en esta spec

- Arrastre táctil sobre el canvas de ARKANOID.
- Toggle para ocultar/mostrar los controles.
- Cambios al HUD en mobile.
- Controles superpuestos sobre el canvas.
- Vibración.
- Modo horizontal o pantalla completa.
- Personalización de los controles.
- Gamepads físicos.
- Controles para juegos sin motor.
- Layout táctil de CROAC (llega con su motor).
- Cambios en los motores, migraciones o esquema.
- Test runner o tests automatizados.

Cada uno de estos, si se necesita, va en su propia spec.
