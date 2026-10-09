# SPEC 17 — Mobile de `/games/frogger` y `/games/frogger/play`

> **Status:** Approved
> **Depends on:** SPEC 12 (touch-controls), SPEC 14 (site-mobile-first), SPEC 15 (frogger-game), SPEC 16 (frogger-skins)
> **Date:** 2026-10-09
> **Objective:** Que la página de detalle y el player de FROGGER se vean y se usen bien en celular (375×667, 390×844 y 667×375 apaisado), tablet (768×1024) y desktop (1280×800). En la práctica, eso significa que en desktop y laptop se vea el canvas **entero** (incluidas la fila de salida de la rana y la barra de tiempo) sin scrollear, y que la portada `.cover-frogger` escale con su caja.

---

## Por qué existe esta spec

FROGGER (SPEC 15) acaba de entrar a la galería. La SPEC 14 ya dejó todo el sitio en mobile-first, así que esta auditoría buscó lo **propio** de FROGGER: sus 4 stats en el HUD (con hasta 4 vidas), un D-pad sin botones, una portada nueva y un juego donde lo importante pasa en la **parte de abajo** del canvas.

La auditoría (Playwright MCP contra `npm run dev`, 2026-10-09) da un resultado mayormente bueno: en los cinco viewports de la tabla no hay scroll horizontal, ningún touch target mide menos de 44px, no hay texto de menos de 14px ni inputs de menos de 16px, y el modal "FIN DEL JUEGO" entra o scrollea. Pero hay tres cosas que no son obvias:

1. **El problema más grave está en desktop, no en mobile.** A 1280×800 el canvas mide 1004×753 y empieza en y=232, así que al cargar solo se ven 11,3 de las 15 filas. Quedan **debajo del fold** la fila 13 (donde nace la rana) y la fila 14 (la barra de tiempo). Además el motor hace `preventDefault` de las flechas, así que mientras se juega no se puede scrollear con el teclado: hay que soltar el teclado y usar la rueda del mouse. Pasa lo mismo a 1366×768 (11 filas) y a 1024×768 (11,5). A 1920×1080 y a 768×1024 entra. El layout del player es compartido, así que el problema es de todos los juegos. En FROGGER se nota más porque el personaje y el temporizador están abajo.
2. **En mobile vertical el juego entra, pero se ve chico.** A 375px el canvas mide 327×245 (escala 0,41 sobre 800×600). Hay detalles que importan para jugar y quedan de 1 a 4 px: la mosca, los ojos del cocodrilo de bahía (fase segura) frente a la mandíbula (fase mortal) y los dientes del cocodrilo de río. Agrandar el canvas por CSS no alcanza: ver D3. Es un tema del motor (`lib/games/frogger/render.ts`), que esta spec no puede tocar.
3. **Los controles táctiles no se ven en Playwright.** El Chromium de desktop no emula `pointer: coarse`. Para medirlos, igual que en la SPEC 14, se forzó `.av-touch-controls { display: grid }` con un style inyectado y se simuló el bloque apaisado táctil de D9 (SPEC 14). La verificación final es manual.

---

## Auditoría

**Método.** Playwright MCP contra `http://localhost:3000/games/frogger` y `/games/frogger/play`, en 375×667, 390×844, 667×375 (player), 768×1024 y 1280×800. Además se midió 1024×768, 1366×768 y 1920×1080 para dimensionar el hallazgo 1. Por DOM (`getBoundingClientRect`, `getComputedStyle`) se midió:

- overflow horizontal;
- elementos interactivos de menos de 44px;
- texto de menos de 14px;
- inputs de menos de 16px;
- imágenes sin dimensiones.

La scrollbar clásica se ocultó con `scrollbar-width: none`. Se abrió el menú mobile y el modal "FIN DEL JUEGO", que apareció solo porque la rana muere por tiempo si no se juega. Para el peor caso del HUD se reemplazaron los valores en el DOM por un nombre de 10 caracteres, `99.999.999` y `♥ ♥ ♥ ♥`.

**Screenshots** (en `.playwright-mcp/`, gitignored):

- `mobile-frogger-play-375-touch.png`: 375×667 con los controles forzados, página completa.
- `mobile-frogger-play-1280.png`: 1280×800, la rana y la barra de tiempo quedan bajo el fold.
- `mobile-frogger-play-1280-capped-prototype.png`: 1280×800 con la regla de D1 inyectada, ya con el canvas entero.
- `mobile-frogger-detail-1280.png`: detalle a 1280.
- `mobile-frogger-card-1280.png`: tarjeta de la biblioteca (252×188).

Hay una más de la página de detalle a 375×667 que quedó en la raíz del repo como `mobile-frogger-detail-375.png`, por la ruta relativa del MCP. Hay que borrarla y no commitearla.

### Hallazgos (estado antes de esta spec)

| # | Ruta | Viewport | Problema | Evidencia | Severidad |
| - | ---- | -------- | -------- | --------- | --------- |
| 1 | `/games/frogger/play` | 1280×800 (y 1366×768, 1024×768) | El canvas mide 1004×753 (928×696 a 1024) y su borde inferior queda en y=985 (970 / 933). Al cargar se ven 11,3 filas de 15: la fila de salida de la rana (13) y la barra de tiempo (14) quedan fuera de pantalla. Las flechas no scrollean, porque el motor hace `preventDefault`. El ancho del CRT solo depende del ancho de la página (`max-width: 1100px`), no del alto del viewport. | `app/globals.css:738-745` (`.av-player`), `:830-843` (`.crt`), `:850-857` (`.crt-screen`); `mobile-frogger-play-1280.png` | alta |
| 2 | `/games/frogger/play` | 375×667, 390×844 | Con el canvas a escala 0,41 (327×245): la mosca es un punto de ≈3px (radio 4 → 1,6), los ojos del cocodrilo de bahía en fase `peek` miden ≈4×3px (10×8) y los dientes ≈1,2px (3×3). La diferencia entre `peek` (se puede entrar) y `jaws` (mata) es difícil de leer en un teléfono. En apaisado la escala es 0,465 (372×279). | `lib/games/frogger/render.ts:224`, `:233-235`, `:250`, `:309-310`; `mobile-frogger-play-375-touch.png` | media (**fuera de alcance**, ver D3) |
| 3 | `/games/frogger`, `/games` | 1280×800, 768×1024 | `.cover-frogger` ubica el río, el cocodrilo y la rana en `%`, pero el nenúfar (radio 14px), la onda (10px), la mosca y sus alas (3px) y el ojo del cocodrilo (2px) tienen radios fijos en `px`. En la tarjeta de 252×188 el nenúfar ocupa el 11% del ancho; en la portada del detalle (690×432 a 1280, 704×440 a 768) ocupa el 4%, y la mosca queda en un punto de 6px. La composición cambia según el tamaño de la caja. | `app/globals.css:639-655`; `mobile-frogger-card-1280.png` frente a `mobile-frogger-detail-1280.png` | baja |
| 4 | `/games/frogger` | 375×667 | En `.stat-strip`, "MEJOR GLOBAL" y "★ ★ ★ ☆ ☆" se parten en 2 líneas (columna de ≈100px). Se lee bien y es igual en el detalle de todos los juegos. | `components/detail/GameDetail.tsx:27-44`; `mobile-frogger-detail-375.png` | baja (aceptado, no se toca) |
| 5 | `/games/frogger/play` | iPad apaisado 1024×768 con `pointer: coarse` (fuera de la tabla, por lectura de código) | El grid lateral de D9 (SPEC 14) solo aplica con `max-height: 500px`. En un iPad apaisado el D-pad (160px) queda debajo del canvas, fuera de pantalla. D1 lo mejora (el canvas pasa de 696 a 512px de alto), pero no alcanza: el D-pad termina en ≈941px. | `app/globals.css:1091-1106` | media (**fuera de alcance**, ver Riesgos) |

**Sin problemas** (medido):

- **375×667**: sin scroll horizontal (`scrollWidth` 375), con el menú abierto y cerrado y con el modal abierto.
  - Touch targets ≥ 44px. Las únicas excepciones son las 4 flechas del D-pad (36×36, `tabIndex=-1`), cuya zona táctil es el D-pad entero (112,5px), como acepta la SPEC 14.
  - Sin texto de menos de 14px. Los inputs del modal están a 16px.
  - Player: HUD de 187px (stats en 2 filas + tira de acciones). El canvas termina en y=538 y los controles forzados en **y=659 ≤ 667** (margen de 8px).
  - Peor caso del HUD (nombre de 10, `99.999.999`, 4 vidas): sigue en 2 filas de stats y los controles no se mueven.
  - Modal: todos sus hijos quedan dentro (20..355).
- **390×844**: lo mismo. El canvas mide 342×256 y los controles terminan en y=675.
- **667×375**:
  - Sin controles: el canvas mide 372×279 y el `.crt` 330px (≤ 375).
  - Con el grid táctil simulado: el `.crt` mide 355px y el D-pad queda a la izquierda.
  - Como FROGGER no tiene botones de acción, la columna derecha queda vacía y el canvas queda casi centrado (67 / 75px a cada lado). Sin cambios.
  - El modal scrollea dentro de `.modal-bd` (467 de 375).
- **768×1024**: sin overflow. El canvas mide 672×504 y entra, y con controles el `.crt` termina en 943 ≤ 1024. Los botones de 41px del HUD son el caso tablet que la SPEC 14 (D12) dejó fuera.
- **1280×800, detalle**: sin overflow.

---

## Alcance

**Dentro:**

- `app/globals.css`:
  - un bloque nuevo `@media (min-width: 768px) and (min-height: 501px)` que acota el ancho de `.crt` según el alto del viewport (D1);
  - en `.cover-frogger::before` y `::after`, pasar a tamaños relativos los radios fijos (D4).

**Fuera de alcance:**

- El hallazgo 2. La legibilidad del canvas en mobile es del motor (`lib/games/frogger/render.ts`: tamaños de la mosca, de los ojos y de los dientes), que el mobile-porter no puede tocar. Va en su propia spec de juego si se quiere (ver D3).
- El hallazgo 5 (iPad apaisado táctil): cambia el bloque D9 de la SPEC 14 para todos los juegos y necesita medirse con un iPad real.
- El hallazgo 4: es igual en todos los detalles y se lee bien.
- `components/**`: no hace falta markup nuevo.
- `TouchControls.tsx`, `lib/games/frogger/touch.ts`, `GameCanvas.tsx` y la resolución interna de 800×600.
- El orden de las capas de `.cover-frogger::before`: los dientes del cocodrilo quedan tapados por el cuerpo, porque la capa de dientes va después de la del cuerpo y en `background` la primera capa se pinta arriba. No es de responsive; queda anotado en Riesgos para la SPEC 15.
- El export `viewport`, safe areas, PWA y pantalla completa.
- Tests automatizados: el proyecto no tiene test runner.

---

## Decisiones

**D1 — En desktop y tablet, el ancho del `.crt` se acota por el alto del viewport.**

```css
@media (min-width: 768px) and (min-height: 501px) {
  .crt {
    max-width: max(32rem, calc((100vh - 16rem) * 4 / 3 + 3rem));
    max-width: max(32rem, calc((100dvh - 16rem) * 4 / 3 + 3rem));
    margin-inline: auto;
  }
}
```

Por qué funciona:

- **`16rem` (256px)** es lo que hay arriba del canvas en desktop, con margen: nav sticky (70–85px), 32px de margen, HUD (73px), 18px de separación y 24px de padding del CRT. Eso suma 217–232px; se le agregan unos 24px de aire.
- **`+ 3rem`** es el padding horizontal del `.crt` (24px por lado). Así el canvas mide `(alto − 16rem) × 4/3` de ancho y, por el `aspect-ratio`, `alto − 16rem` de alto.
- **`max(32rem, …)`** pone un piso para alturas chicas. La tira `.crt-bottom` necesita ≈477px en pixel 8px sin `wrap` (medido: 413px de spans + paddings).
- **`min-height: 501px`** deja afuera los apaisados bajos, donde manda D9 de la SPEC 14 (`max-height: 500px`). Las dos queries no se pisan y el orden en el archivo no importa.
- **`100vh` como fallback** de `100dvh`: en desktop valen lo mismo.

**Medido con la regla inyectada** (screen = ancho × alto del canvas; bottom = borde inferior en `scrollY = 0`):

| Viewport | Antes | Con D1 | ¿Entra? |
| -------- | ----- | ------ | ------- |
| 1280×800 | 1004×753 | 725×544, bottom 776 | sí |
| 1366×768 | — | 683×512, bottom 729 | sí |
| 1024×768 | 928×696 | 683×512, bottom 748 | sí |
| 768×1024 | 672×504 | sin cambio | sí |
| 1920×1080 | 1004×753 | sin cambio | sí |

En todos los casos se mantiene el 4:3 (1,3334) y no aparece overflow.

Qué se ve distinto:

- El HUD sigue ocupando todo el ancho (1052px a 1280) y el CRT queda centrado debajo, más angosto (773px a 1280).
- Afecta a **los 6 juegos**, porque el CSS del player es compartido. Es un cambio **explícito** del desktop: en pantallas de ≤ ~1000px de alto, todos los canvas se achican para entrar enteros.

Descartadas:

- **Acotar solo FROGGER** con `data-game="frogger"` en `.av-player`. El mismo problema tienen ARKANOID (paleta abajo), SNAKE y TETRIS (la pila crece desde abajo); con un layout distinto por juego, el player deja de ser uno solo. Si la persona prefiere no tocar los otros juegos en esta spec, esta es la alternativa: se agrega `data-game={game.id}` en `GamePlayer.tsx:145` (solo markup) y se antepone `.av-player[data-game="frogger"]` al selector.
- **Acotar `.crt-screen` dentro de un `.crt` de ancho completo**: quedan bandas negras de ≈160px a cada lado del canvas dentro del marco. Achicar el marco se ve mejor.
- **Acotar `.av-player` entero (HUD incluido)**: a 773px, el HUD con 4 stats + PAUSA/FIN/SALIR (409 + 297px) y el selector de skins de SPEC 16 pasaría a 2 filas. El HUD crecería ≈60px y volvería a empujar el canvas bajo el fold.
- **`scrollIntoView` del canvas al montar (JS)**: mueve la página sola, esconde el HUD y es JS para algo que el CSS resuelve.
- **Nav no sticky en desktop** (como D10 de la SPEC 14 en mobile): gana 85px y no alcanza (el canvas termina en 985, no en 800).

**D2 — En mobile no se cambia el layout del player.** Medido: a 375×667 los controles terminan en 659 ≤ 667, a 390×844 en 675, y en 667×375 el `.crt` mide 355 ≤ 375. Con el selector de skins de SPEC 16, que va en la tira horizontal `nowrap` de `.hud-actions`, el alto no cambia (D8 de la SPEC 14). Descartado tocar algo que ya cumple los criterios.

**D3 — No se agranda el canvas en mobile vertical para ganar legibilidad (hallazgo 2).**

- El máximo posible es quitar casi todo el padding lateral (`.av-player` 1rem → 0,25rem, `.crt` 0,5rem → 0,25rem). Eso lleva el canvas de 327 a ≈357px: un 9% más, que no cambia la lectura de un detalle de 3px.
- Además suma ≈22px de alto: los controles terminarían en ≈681, fuera de los 667px.
- Lo que sí mejora la lectura es dibujar más grandes esos detalles en el motor (mosca, ojos de cocodrilo, dientes), o jugar en apaisado (escala 0,465). Lo primero es otra spec de juego (`lib/games/frogger/render.ts`); lo segundo se documenta en la verificación manual.
- Descartado también un zoom del canvas con `transform: scale`: recorta los bordes del tablero, y en FROGGER las filas de salida y de tiempo son justo las de los bordes.

**D4 — Los radios fijos de `.cover-frogger` pasan a tamaños relativos, calibrados para que la tarjeta de 252×188 quede igual que hoy.**

| Capa | Hoy | Después |
| ---- | --- | ------- |
| Nenúfar (`::before`) | `radial-gradient(circle at 84% 18%, #2fbf5a 0 14px, transparent 15px)` | `radial-gradient(5.95% 7.98% at 84% 18%, #2fbf5a 93%, transparent 100%)` |
| Onda (`::before`) | `radial-gradient(circle at 18% 22%, rgba(120,200,255,0.25) 0 10px, transparent 11px)` | `radial-gradient(4.37% 5.85% at 18% 22%, rgba(120,200,255,0.25) 91%, transparent 100%)` |
| Ojo del cocodrilo (`::before`) | `radial-gradient(circle, #f5ff00 0 2px, transparent 3px) left 62% top 43% / 4% 6% no-repeat` | `radial-gradient(closest-side, #f5ff00 40%, transparent 60%) left 62% top 43% / 4% 6% no-repeat` |
| Mosca (`::after`) | `radial-gradient(circle at 84% 17%, #f5ff00 0 3px, transparent 4px)` | `radial-gradient(1.59% 2.13% at 84% 17%, #f5ff00 75%, transparent 100%)` |
| Alas (`::after`, ×2) | `radial-gradient(circle at 81% 14% / 87% 14%, rgba(230,233,255,0.85) 0 3px, transparent 4px)` | `radial-gradient(1.59% 2.13% at 81% 14% / 87% 14%, rgba(230,233,255,0.85) 75%, transparent 100%)` |

- Cómo se calcula: radio relativo = radio externo en px ÷ 252 (horizontal) y ÷ 188 (vertical). La parada de color es la proporción interno/externo (14/15 = 93%, 10/11 = 91%, 3/4 = 75%).
- El ojo usa `closest-side` de su caja de 4%×6% (≈10×11px en la tarjeta): 2px y 3px dan 40% y 60%.
- La caja de 252×188 es la tarjeta de `/games` a 1280. Se eligió porque es donde el usuario compara portadas.
- En el detalle a 1280 (690×432) el nenúfar pasa de 28px a ≈82×69px y queda en la misma proporción que en la tarjeta.
- Los dientes (`repeating-linear-gradient` de 8px/16px) no se tocan, porque están tapados (ver Fuera de alcance).
- Descartado `cqi`/`cqw` con `container-type` en `.cover-bg`: cambia el modelo de layout de todas las portadas para arreglar una sola.

**D5 — Se mantienen los breakpoints de la SPEC 14 (`min-width: 768/1024px`) y la query de alto de D10 como patrón.** D1 usa `(min-width: 768px) and (min-height: 501px)`, la misma forma que la regla de la nav sticky (`app/globals.css:1110`). Así no se suma un corte nuevo.

---

## Plan de implementación

Reglas:

- **Línea base antes del paso 1.** Con Playwright, en 375×667, 390×844, 667×375, 768×1024, 1280×800 y 1920×1080, guardar por ruta (`/games/frogger`, `/games/frogger/play`, `/games/snake/play`, `/games`) un JSON con `getComputedStyle` (`width`, `max-width`, `margin`, `padding`, `display`) de `.av-player`, `.player-hud`, `.crt`, `.crt-screen`, `.crt-bottom` y `.av-touch-controls`, más los rects de `.crt-screen`. Después de cada paso, repetir y comparar. Solo se aceptan las diferencias de "Cambios explícitos".
- Verificación estática por paso: `npm run lint`. Sin build.

1. **Canvas entero en desktop y tablet** (hallazgo 1, alta).
   - En `app/globals.css`, después del bloque de la nav no sticky (línea ~1112, `body:has(.av-player) .av-nav`) y antes de `/* game over modal */`, agregar el bloque de D1 con el comentario `/* Player on desktop/tablet: the whole canvas fits at load (SPEC 17, D1). */`.
   - No tocar `.av-player`, `.player-hud`, `.crt-screen` ni el bloque D9.
   - Prueba: a 1280×800, 1366×768 y 1024×768, con `scrollY = 0`, `.crt-screen` termina en ≤ `innerHeight`. A 768×1024 y 1920×1080 los rects son iguales a la línea base.
2. **Portada que escala** (hallazgo 3, baja).
   - En `app/globals.css`, dentro de `.cover-frogger::before` y `.cover-frogger::after` (líneas 634-657), reemplazar las 6 capas de la tabla de D4.
   - No cambiar el orden de las capas, ni las demás, ni `filter`.
   - Prueba: screenshot de la tarjeta en `/games` a 1280 (252×188), comparado con `mobile-frogger-card-1280.png` (deben coincidir a simple vista), y screenshot del detalle a 375, 768 y 1280 (el nenúfar y la mosca mantienen su proporción).
3. **Cierre.** Repetir la medición completa de los criterios en todos los viewports, más `/games/snake/play` y `/games/arkanoid/play` a 1280×800 (el cambio de D1 los alcanza). Si SPEC 16 ya está implementada, medir con el selector de skins visible.

---

## Criterios de aceptación

**Sin scroll horizontal**

- [ ] En 375×667, 390×844, 768×1024 y 1280×800, para `/games/frogger` y `/games/frogger/play` (con el menú cerrado y abierto, y con el modal "FIN DEL JUEGO" abierto en el player), `document.documentElement.scrollWidth <= clientWidth`, con la scrollbar oculta (`html { scrollbar-width: none }`).
- [ ] En 667×375, `/games/frogger/play` no tiene scroll horizontal.

**Touch targets y texto (375×667 y 390×844)**

- [ ] Todo `a, button, input, select, textarea, [role=button], [role=radio]` visible y fuera de `[inert]` mide ≥ 44×44px, salvo las flechas `.av-touch-dir` (`tabIndex=-1`, la zona táctil es el D-pad entero).
- [ ] Ningún texto visible tiene `font-size` calculado < 14px.
- [ ] El input del modal tiene `font-size` ≥ 16px.

**Player**

- [ ] **1280×800, 1366×768 y 1024×768**: en `scrollY = 0`, `.crt-screen.getBoundingClientRect().bottom <= innerHeight`. Se ven la fila de salida y la barra de tiempo de FROGGER al cargar.
- [ ] **1280×800**: `.crt-screen` mide 725×544 (±2px) y `.crt` está centrado bajo el HUD (`left` y `right` simétricos ±1px respecto de `.player-hud`).
- [ ] **768×1024 y 1920×1080**: los rects de `.crt` y `.crt-screen` son iguales a la línea base.
- [ ] **375×667**, con `.av-touch-controls { display: grid }` forzado: en `scrollY = 0`, `.crt-screen` y `.av-touch-controls` quedan enteros dentro del viewport (`bottom ≤ 667`), también con el peor caso del HUD (nombre de 10, `99.999.999`, `♥ ♥ ♥ ♥`).
- [ ] **390×844**, en las mismas condiciones: `.crt` entero dentro del viewport en `scrollY = 0`.
- [ ] **667×375**: `.crt-screen` mide entre 240 y 279px de alto; `.crt` ≤ 375px.
- [ ] En todos los viewports, `.crt-screen` mantiene 4:3 (diferencia < 1px).
- [ ] `.crt-bottom` no desborda (`scrollWidth <= clientWidth`) en ningún viewport.

**Portada**

- [ ] En `/games` a 1280, la tarjeta de FROGGER se ve igual que en `mobile-frogger-card-1280.png`.
- [ ] En `/games/frogger` a 375, 768 y 1280, el nenúfar mide entre el 10% y el 13% del ancho de la portada, y la mosca y sus alas se ven sobre el nenúfar.
- [ ] `rg -n '[0-9]px' app/globals.css` dentro del bloque `.cover-frogger` solo devuelve la `drop-shadow` y el `repeating-linear-gradient` de los dientes.

**El desktop se ve igual que antes, salvo lo explícito**

- [ ] **Cambios explícitos aceptados**:
  - En viewports de ≥ 768px de ancho y ≥ 501px de alto, cuando `(alto − 256px) × 4/3 + 48px` < el ancho actual del `.crt`, el `.crt` de **todos los juegos** se angosta y queda centrado.
  - La portada `.cover-frogger` escala sus detalles.
- [ ] A 1920×1080 y 768×1024 el JSON de estilos calculados del player es idéntico a la línea base, salvo `max-width` de `.crt` (de `none` a un valor mayor que su ancho).
- [ ] `/games/frogger` a 1280×800 no cambia, salvo la portada.

**Código**

- [ ] `git diff --stat` de esta spec solo muestra `app/globals.css`.
- [ ] `rg "@media" app/globals.css` no suma ninguna forma de query que no exista hoy.
- [ ] `npm run lint` pasa y la consola del navegador no muestra errores nuevos.

---

## Verificación manual (`npm run dev`)

Herramientas:

- DevTools en modo dispositivo (iPhone SE 375×667, iPhone 12 Pro 390×844, iPad Mini 768×1024, y rotar), que sí emula `pointer: coarse`.
- Un teléfono real en la red local, con la URL "Network" de `npm run dev`.

| Ruta | Viewport | Qué mirar |
| ---- | -------- | --------- |
| `/games/frogger/play` | Laptop 1280×800 y 1366×768 (ventana real, no DevTools) | Al cargar se ven la rana en la fila de abajo y la barra de tiempo, sin scrollear. Jugar con las flechas: nada queda fuera de vista. El CRT está centrado bajo el HUD. |
| `/games/frogger/play` | 1920×1080 | Igual que antes de esta spec. |
| `/games/snake/play`, `/games/arkanoid/play` | 1280×800 | También se ven enteros (el cambio es compartido). La paleta de ARKANOID se ve al cargar. |
| `/games/frogger/play` | iPhone SE vertical (modo dispositivo) | El canvas y el D-pad de 4 flechas se ven enteros al cargar, sin botones de acción. Cada toque es un salto. Mantener el dedo no repite. Deslizar de ▲ a ► sin levantar el dedo da un salto a la derecha y nunca dos a la vez (sin diagonales). |
| `/games/frogger/play` | iPhone SE vertical, teléfono real | Mirar si se distinguen la mosca, la rana dama y, en el nivel 2, el cocodrilo de bahía asomando frente a la boca abierta. Si no se distinguen, abrir una spec de juego para el render (hallazgo 2). La barra de Safari obliga a un scroll corto (la nav no es sticky en el player). |
| `/games/frogger/play` | iPhone SE apaisado | D-pad a la izquierda, canvas entero al centro, sin columna de botones a la derecha. Es la orientación recomendada para leer los detalles. |
| `/games/frogger/play` → FIN | iPhone SE vertical y apaisado | El modal entra o scrollea; sin zoom al enfocar el nombre; "GUARDAR PUNTUACIÓN" se ve entero. |
| `/games/frogger/play` | iPad Mini vertical | Canvas y D-pad visibles. El HUD muestra las 4 vidas cuando corresponde (vida extra a los 10.000). |
| `/games/frogger` | iPhone SE, iPad Mini, 1280 | La portada mantiene la proporción del nenúfar y la mosca en los tres tamaños. "JUGAR AHORA" es fácil de tocar. |
| `/games` | 1280 | La tarjeta de FROGGER se ve igual que antes. |

---

## Riesgos identificados

| Riesgo | Mitigación |
| ------ | ---------- |
| D1 cambia el tamaño del canvas en desktop para **todos** los juegos, no solo FROGGER | Es explícito en Decisiones y en los criterios. La alternativa con `data-game` está documentada por si la persona prefiere acotarlo a FROGGER. |
| `16rem` asume un HUD de una fila. Con el selector de SPEC 16 + 4 stats + un puntaje largo, el HUD podría pasar a 2 filas a 1024px y empujar el canvas ≈60px | El paso 3 mide con SPEC 16 implementada. Si no entra, frenar y reportar (subir a `20rem` o revisar el HUD), sin improvisar. |
| El margen a 375×667 es de 8px (los controles terminan en 659) | Cualquier cambio futuro en el HUD o en `.crt-bottom` lo puede romper. Este es el criterio que hay que volver a medir. |
| En pantallas de 501–620px de alto (ventanas chicas), el piso de `32rem` hace que el canvas vuelva a pasar el fold | Es un caso raro en desktop. El piso evita que `.crt-bottom` desborde, que se vería roto. |
| La legibilidad en mobile (hallazgo 2) queda sin resolver | Fuera de alcance por límites (motor). Se recomienda el apaisado y se deja la pregunta en la verificación con teléfono real. |
| iPad apaisado táctil (hallazgo 5): el D-pad queda debajo del fold | D1 lo mejora (canvas de 512 en lugar de 696px de alto), pero no alcanza. Necesita su propia spec, extendiendo D9 de la SPEC 14 a `pointer: coarse` con más alto, y medirse en un iPad real. |
| Los dientes del cocodrilo de `.cover-frogger` no se ven (capa debajo del cuerpo) | No es de responsive. Se reporta para corregirlo en la SPEC 15 o en una spec de portada. |
| Los porcentajes de D4 redondean y la tarjeta cambia 1px | El criterio es a simple vista contra el screenshot. Con `closest-side` y radios explícitos no hay dependencia del tamaño. |

---

## Lo que **no** está en esta spec

- Cambios en el motor de FROGGER (tamaño de la mosca, de los ojos o de los dientes) ni en `lib/games/**`.
- Layout táctil de iPad apaisado.
- Cambios en `components/**`, `TouchControls.tsx` o el layout táctil.
- Corrección del orden de capas de la portada.
- Texto ≥ 14px y targets ≥ 44px en tablet (igual que en la SPEC 14).
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propia spec.
