# SPEC 14 — Mobile de todo el sitio (refactor mobile-first)

> **Status:** Approved
> **Depends on:** SPEC 01 (mvp-visual), SPEC 02 (home-landing-page), SPEC 03 (about-contact-form), SPEC 06 (games-table-and-leaderboard), SPEC 11 (snake-skins), SPEC 12 (touch-controls)
> **Date:** 2026-10-08
> **Objective:** Que todas las rutas de UI (`/`, `/games`, `/games/[id]`, `/games/[id]/play`, `/hall-of-fame`, `/login`, `/about`) se vean y se usen bien en celular, tablet y desktop. Para eso se migran los media queries desktop-first de `app/globals.css` (`max-width`) a mobile-first con dos cortes (`min-width: 768px` y `min-width: 1024px`), sin cambiar cómo se ve el desktop a 1280px.

---

## Por qué existe esta spec

`app/globals.css` es desktop-first: los estilos base son los de desktop y hay 15 `@media (max-width: …)` con 8 cortes sueltos (520, 600, 720, 820, 840, 900, 980, 1100). Ninguno coincide con los rangos del proyecto (mobile < 768, tablet 768–1023, desktop ≥ 1024). La persona pidió explícitamente refactorizar a **mobile-first**: los estilos base pasan a ser los de mobile y el desktop se agrega con `min-width`.

La auditoría (Playwright sobre `npm run dev`, 2026-10-08) encontró además problemas que hoy rompen el uso en celular:

- **El menú no se puede abrir bien en mobile.** El botón hamburguesa queda fuera del viewport a 375 y 390px, porque la barra mete el logo, el botón de sesión (que se parte en 2 líneas) y la hamburguesa sin `wrap` ni `shrink`.
- **En apaisado no se puede jugar.** El canvas mide 440px de alto en un viewport de 375. Sin scroll se ve el 23% del juego y los controles táctiles quedan unos 350px más abajo.
- **El modal "FIN DEL JUEGO" se sale de la pantalla.** El botón "GUARDAR PUNTUACIÓN" sale del modal y del viewport, y en apaisado el modal se corta arriba y abajo sin poder scrollear.
- **Todos los inputs disparan el zoom de iOS** (13–14px, por debajo de 16).
- **El ranking del Salón de la Fama desborda** a 375px.

Además, casi todo el texto de UI en mobile está entre 8 y 13px, y varios botones miden 36–41px de alto.

Tres puntos que no son obvios:

1. **`body { overflow-x: hidden }` esconde los desbordes, no los arregla.** En Chromium desktop no aparece scroll horizontal, pero `document.documentElement.scrollWidth` llega a 403–414px con un viewport de 375. Lo que sobresale queda cortado (la hamburguesa) y en iOS Safari se puede arrastrar la página hacia el costado. Los criterios de esta spec miden `scrollWidth`, no lo que se ve.
2. **El rango 841–1023px hoy está roto en desktop.** La nav de escritorio aparece desde 841px y a 900px desborda (el botón de sesión termina en x=919) con los links partidos en 2 líneas. Mover ese corte a 1024 **arregla** la tablet en vez de empeorarla.
3. **Los controles táctiles (SPEC 12) no se ven en Playwright**, porque el Chromium de desktop no emula `pointer: coarse`. Para medirlos, la auditoría forzó `.av-touch-controls { display: grid }` con un style inyectado. Su verificación final es manual (DevTools en modo dispositivo o un teléfono real).

---

## Auditoría

**Método.** Playwright MCP contra `http://localhost:3000`, en 375×667, 390×844, 768×1024, 1280×800 y, en el player, 667×375. También se midió 900 y 1024 para decidir el corte de la nav. Por cada viewport se midió por DOM (`getBoundingClientRect`, `getComputedStyle`):

- overflow horizontal;
- elementos interactivos de menos de 44px;
- texto de menos de 14px;
- inputs de menos de 16px.

Para que el ancho útil sea el de un celular (375 y no 360), la scrollbar clásica de Chromium desktop se ocultó con `scrollbar-width: none`. Se abrió el menú mobile, el modal "FIN DEL JUEGO" y los tabs del Salón de la Fama.

**Screenshots: no hay.** `browser_take_screenshot` dio timeout en todas las páginas, incluso en `/api/health/supabase` (JSON plano): la ventana del navegador no estaba pintando frames. La evidencia es la medición del layout, que no depende del paint. Los screenshots quedan para la verificación manual.

**Línea base de desktop (1280×800).** Ninguna ruta tiene overflow horizontal. Esta es la referencia de "el desktop se ve igual".

### Hallazgos (estado antes de esta spec)

| # | Ruta | Viewport | Problema | Evidencia | Severidad |
| - | ---- | -------- | -------- | --------- | --------- |
| 1 | todas | 375×667, 390×844 | La hamburguesa queda fuera del viewport: x 346..403 sin sesión y 357..414 con sesión; `scrollWidth` 403/414. Es la única navegación en mobile. El botón de sesión se parte en 2 líneas (56px) y la barra mide 81px de alto. | `app/globals.css:146-204`, `components/nav/Nav.tsx:49-60` | bloqueante |
| 2 | `/games/snake/play` | 667×375 | `.crt-screen` mide 587×440, más que el alto del viewport (375). Sin scroll se ve el 23% del juego. Los controles táctiles (forzados) quedan en y=729–889. | `app/globals.css:622-626`, `:689-696`, `:826-829` | bloqueante |
| 3 | `/games/snake/play` | 375×667 | Con los controles forzados, el D-pad termina en y=719 (el fold está en 667). El HUD mide 184px: stats, skins y PAUSA/FIN/SALIR envuelven en 3 filas. La nav mide 81px y el CRT tiene 24px de padding. | `app/globals.css:627-640`, `:672-682`; `components/player/GamePlayer.tsx:146-188` | alta |
| 4 | `/games/snake/play` (modal FIN) | 375×667 | "GUARDAR PUNTUACIÓN" ocupa x 249..407 y sale del modal (8..368) y del viewport: `.input-row` es un flex sin `wrap`. | `app/globals.css:946-957` | alta |
| 5 | `/games/snake/play` (modal FIN) | 667×375 | El modal mide 392px en un viewport de 375 (top -8, bottom 383). `.modal-bd` es `position: fixed` sin `overflow-y`. Con el teclado abierto queda inaccesible. | `app/globals.css:910-924` | alta |
| 6 | `/games`, `/login`, `/about`, modal FIN | 375, 390 | Inputs con menos de 16px (iOS hace zoom al enfocarlos): búsqueda 13px; usuario/correo/contraseña 14px; nombre/correo/mensaje 14px; iniciales del modal 14px. Además, el `<input>` de búsqueda mide 20px de alto dentro de una caja de 48px. | `app/globals.css:325-328`, `:949-957`, `:1028-1036`, `:1461-1465` | alta |
| 7 | `/hall-of-fame` | 375×667 | El encabezado "PUNTUACIÓN" (139px) no entra en su columna de 90px y sale del viewport (right=386). "RANGO" (70px) está en 50px. La columna JUGADOR queda en 57px. | `app/globals.css:1099-1107`, `:1133-1134` | alta |
| 8 | `/` | 768×1024 | `.stats-inner` con 3 columnas no entra: el 3.er bloque ("GLOBAL") ocupa x 497..777 y lo recorta el `overflow: hidden` de `.home-stats`. A 1024 sí entra. | `app/globals.css:1265-1279` | alta |
| 9 | todas | 900×800 (rango tablet) | La nav de desktop aparece desde 841px y no entra: el botón de sesión termina en x=919 y los links se parten en 2 líneas (61px). | `app/globals.css:199-204` | alta |
| 10 | `/` | 375, 390 | `.activity-card` ocupa x 32..371 y se sale del padding de la sección (el contenido termina en 343). Causa: `.activity-grid` usa `1fr` (mínimo `auto`). | `app/globals.css:1307-1308` | media |
| 11 | `/` | 375 | `.tick-row` compacto: la columna `auto` mide 0px y el puntaje cae a una 3.ª fila, alineado a la izquierda. El auto-placement avanza después de `.tk-mid`, que ocupa toda la fila. | `app/globals.css:1316-1328` | media |
| 12 | `/hall-of-fame` | 375 | El podio apilado se lee 02, 01, 03: el orden del DOM es plata, oro, bronce. | `components/hall-of-fame/HallOfFame.tsx:23-27`, `app/globals.css:1073` | media |
| 13 | todas | 375, 390 | Touch targets de menos de 44px: `.btn` mide 41px de alto (JUGAR, PAUSA/FIN/SALIR, modal, invitado); `.chip` 40px (filtros y tabs); `.av-nav .logo` 36px; hamburguesa 57×41; `.lb-link` 41px (28px en tablet); `.social .btn` 40px; input de búsqueda 20px. | medición; `app/globals.css:234-251`, `:333-342`, `:1312` | media |
| 14 | todas | 375, 390 | Texto de menos de 14px en mobile, en todas las rutas. Ejemplos: nav (12/9), `.chip` 9, `.btn` 10, `.card .cover .label` 8, `.score-badge` 10, `.crt-bottom` 8, `.hud-stat .l` 10, `.lb-row` 11–13, `.hall-table` 11–12, `.field label` 10, `.auth-divider` 8, `.tip` 9, `.hl-text` 10, `.mini-title` 10, `.pc-label` 9, footer 11. | medición; `app/globals.css` (passim) | media |
| 15 | todas | 375, 390 | Hay `font-size` inline en componentes que el CSS no puede ajustar sin `!important`: panel del menú (11/9), pausa (11), fecha del ranking de detalle (10), "CAMPEÓN" (9), subtítulo del salón (10), textos de `/login` (11), footer (11). | `Nav.tsx:65,84`; `GamePlayer.tsx:216`; `GameDetail.tsx:70`; `HallOfFame.tsx:55,126`; `Auth.tsx:34,83`; `Footer.tsx:3-12` | media |
| 16 | todas | 375, 390 | El menú mobile no es accesible: sin `aria-expanded`/`aria-controls`, no cierra con `Esc`, no maneja el foco y sus links siguen tabulables con el panel cerrado (solo está con `translateX`). Al abrirse, tapa la hamburguesa y no tiene botón de cerrar. Con sesión iniciada, el panel no ofrece cerrar sesión. | `components/nav/Nav.tsx:58-87`, `app/globals.css:206-231` | media |
| 17 | `/` | 375×667, 390×844 | `.home-hero { min-height: calc(100vh - 60px) }`: en iOS, `100vh` es el viewport grande, así que el hero queda más alto que lo visible. Además, la nav real mide 66–81px, no 60. | `app/globals.css:1170` | baja |
| 18 | `/`, `/about` | 375, 390 | Padding lateral de 32px en mobile en `.home-section`, `.home-stats`, `.home-final`, `.home-hero`, `.about-hero`, `.about-divider`, `.about-contact` y el footer: el bloque de 720 no los cubre. A 375 quedan 311px útiles. | `app/globals.css:1174`, `:1223`, `:1268`, `:1284`, `:1410`, `:1433`, `:1441`; `Footer.tsx:6` | baja |
| 19 | `/`, `/games`, `/about` | touch | `:hover` con `transform` en `.card`, `.mini-card`, `.feature-card` y `.highlight`: en touch queda "pegado" después del tap. | `app/globals.css:374-379`, `:1247-1250`, `:1259`, `:1429` | baja |
| 20 | `/` | 375 | `.ac-title` tiene `white-space: nowrap` + `ellipsis`. Con texto ≥ 14px truncaría los títulos de las tarjetas de actividad. | `app/globals.css:1311` | baja |

Sin problemas de layout en 768×1024 para `/games`, `/games/snake`, `/hall-of-fame`, `/login` y `/about`, y ninguno en 1280×800. En 390×844, el player con controles forzados entra (el D-pad termina en y=736).

---

## Inventario de `@media (max-width: …)` y su mapeo mobile-first

Regla general: el valor que hoy está dentro del `max-width` pasa a ser el **estilo base**. El valor base de hoy (desktop) pasa a un `@media (min-width: 768px)` o `(min-width: 1024px)`. Cada corte se redondea al breakpoint más cercano **que no introduzca un desborde**. Las dos excepciones (840 y 720 de `.stats-inner`) van a 1024 por un desborde medido.

| Línea | Query actual | Selectores | Qué hace hoy | Mapeo mobile-first | Qué cambia en el rango redondeado |
| ----- | ------------ | ---------- | ------------ | ------------------ | --------------------------------- |
| 199 | `max-width: 840px` | `.av-nav`, `.av-nav .links`, `.coin-counter`, `.hamburger` | Padding 12/16, oculta links y créditos, muestra la hamburguesa | Base: hamburguesa. `≥1024`: links, créditos, padding 14/32, sin hamburguesa | **841–1023**: pasa de links a hamburguesa. **Gana**: hoy esa franja desborda (hallazgo 9). A 1024 la nav de desktop entra (el botón de sesión termina en x=992). |
| 558 | `max-width: 900px` | `.av-detail` | 1 columna | Base: 1 columna. `≥1024`: `1.4fr 1fr` | **901–1023**: 2 → 1 columna. Pierde el ranking al costado en tablets apaisadas chicas; gana ancho para la portada y el texto. |
| 1073 | `max-width: 720px` | `.podium` | 1 columna | Base: 1 columna (oro primero). `≥768`: 3 columnas | **721–767** (mobile): 3 → 1. Sin pérdida: es rango mobile. |
| 1133 | `max-width: 720px` | `.hall-table .th/.tr` (columnas, font, padding); padding de `.av-grid`, `.av-hero`, `.av-filters`, `.av-hall`, `.av-detail` (+ margin 24), `.av-player` | Tabla compacta y padding de 16px | Base: valores mobile (la tabla pasa al layout de 2 líneas del paso 6). `≥768`: valores actuales | **721–767**: padding de 32 → 16 y tabla compacta. Coherente con mobile. |
| 1233 | `max-width: 980px` | `.feature-grid` | 2 columnas | Base: 1. `≥768`: 2. `≥1024`: 4 | **981–1023**: 4 → 2 (a 1000px, 4 tarjetas de ~220px quedan apretadas). |
| 1234 | `max-width: 520px` | `.feature-grid` | 1 columna | (absorbido en la fila anterior) | **521–767**: 2 → 1. Pierde 2 columnas en teléfonos grandes apaisados; gana legibilidad con texto de 14px. |
| 1256 | `max-width: 1100px` | `.mini-rail` | 3 columnas | Base: 2. `≥768`: 3. `≥1024`: 6 | **1024–1100**: 3 → 6 (≈147px por tarjeta a 1024). **Cambio explícito en desktop**; a 1280 no cambia. |
| 1257 | `max-width: 600px` | `.mini-rail` | 2 columnas | (absorbido arriba) | **601–767**: 3 → 2. Sin pérdida relevante. |
| 1276 | `max-width: 720px` | `.stats-inner` | 1 columna | Base: 1. `≥1024`: 3 (**no 768**) | **721–1023**: 3 → 1. **Gana**: a 768 las 3 columnas recortan "GLOBAL" (hallazgo 8). |
| 1279 | `max-width: 720px` | `.stat-block` | Borde superior en vez de izquierdo | Base: `border-top`. `≥1024`: `border-left` (acompaña a la fila anterior) | Igual que la fila anterior. |
| 1308 | `max-width: 900px` | `.activity-grid` | 1 columna | Base: `minmax(0, 1fr)`. `≥1024`: `1.2fr 1fr` | **901–1023**: 2 → 1. Arregla además el desborde mobile (hallazgo 10). |
| 1328 | `max-width: 520px` | `.tick-row`, `.tk-mid`, `.tk-t` | Fila compacta de 2 columnas | Base: compacta con ubicación explícita (arregla el hallazgo 11). `≥768`: 4 columnas | **521–767**: 4 columnas → compacta. Coherente con mobile. |
| 1355 | `max-width: 900px` | `.pricing-grid` | 1 columna | Base: 1. `≥1024`: 2 | **901–1023**: 2 → 1. La FAQ queda debajo del precio. |
| 1420 | `max-width: 820px` | `.highlight-row` | 1 columna | Base: 1. `≥1024`: 3 | **821–1023**: 3 → 1. Decisión de la persona al revisar: 3 columnas de ≈222px a 768 quedan apretadas, mejor apiladas en tablet. |
| 1443 | `max-width: 900px` | `.contact-grid` | 1 columna, gap 24 | Base: 1, gap 24. `≥1024`: `1fr 1.2fr`, gap 40 | **901–1023**: 2 → 1. El formulario queda debajo de la intro. |

Las queries `@media (pointer: coarse)` (líneas 799 y 822) **no se tocan**: dependen del tipo de puntero, no del ancho.

### Cambios explícitos de layout por rango (lo que se acepta que cambie)

- **Desktop (≥ 1024):** solo `.mini-rail` entre 1024 y 1100px (3 → 6 columnas). **A 1280 no cambia nada.**
- **Tablet (768–1023):** hamburguesa en 841–1023; `.av-detail`, `.activity-grid`, `.pricing-grid` y `.contact-grid` a 1 columna en 901–1023; `.stats-inner` a 1 columna en 768–1023; `.feature-grid` a 2 columnas en 981–1023; `.highlight-row` a 1 columna en 821–1023. Los tamaños de texto de tablet no cambian.
- **Mobile (< 768):** todo lo de esta spec.

---

## Alcance

**Dentro:**

- `app/globals.css`:
  - migrar los 15 `@media (max-width: …)` según el inventario;
  - tokens tipográficos (`--fs-*`);
  - reglas nuevas mobile-first para nav, player, modal, formularios, salón, home, biblioteca, detalle, about, auth y footer;
  - envolver los `:hover` con `transform` en `@media (hover: hover)`.
- `components/nav/Nav.tsx`: accesibilidad del menú (`aria-expanded`, `aria-controls`, `inert`, `Esc`, foco, botón cerrar) y el botón de sesión duplicado dentro del panel.
- `components/nav/Footer.tsx`: estilos inline → clase `.av-footer`.
- `components/player/GamePlayer.tsx`: estilos inline del HUD y de la pausa → clases. No cambia la lógica ni el orden del DOM.
- `components/hall-of-fame/HallOfFame.tsx`, `components/detail/GameDetail.tsx`, `components/auth/Auth.tsx`: `font-size` inline → clases.

**Fuera de alcance:**

- Texto de menos de 14px en **tablet** (768–1023): el criterio de 14px es solo para mobile.
- Touch targets de 44px en tablets táctiles (iPad): ver decisión D12.
- `viewport-fit=cover` y `env(safe-area-inset-*)` en toda la UI (decisión D13). El export `viewport` de `app/layout.tsx` no se toca.
- Accesibilidad del modal "FIN DEL JUEGO" (`role="dialog"`, trampa de foco), `htmlFor` en los labels de `/login` y `/about`, y `metadata.title` de `app/layout.tsx`: son mejoras reales, pero no son de responsive; van en otra spec.
- Cambios en `TouchControls.tsx` o en los layouts `lib/games/<slug>/touch.ts`; arrastrar sobre el canvas en ARKANOID; toggle de controles; pantalla completa (Fullscreen API); PWA.
- Motores, resolución interna del canvas (800×600), `lib/**`, `supabase/`, `app/api/`, `public/`, `resources/`.
- Cambios de textos, datos, rutas o lógica. Única excepción de markup: el botón de sesión duplicado en el panel y el botón "cerrar" del menú (D6).
- Test runner o tests automatizados.

---

## Decisiones

**D1 — Breakpoints como media queries planos `@media (min-width: 768px)` / `(min-width: 1024px)`.**
- Por qué: es CSS estándar, se busca con `rg`, no depende del compilador, y los valores coinciden exactamente con `--breakpoint-md` (48rem) y `--breakpoint-lg` (64rem) del tema de Tailwind (`node_modules/tailwindcss/theme.css:328-329`). Los dos valores quedan documentados en un comentario al principio de `globals.css`.
- Descartado `@custom-media --md (min-width: 768px)`: Tailwind 4.3.3 lo deja pasar y solo lo resuelve Lightning CSS (`drafts.customMedia: true`) en el paso de optimización. Ese paso corre **solo con `NODE_ENV=production`** (`node_modules/@tailwindcss/postcss/dist/index.js`, `optimize ?? NODE_ENV==="production"`). En `next dev` el `@custom-media` llegaría crudo al navegador, que lo ignora: dev y prod se verían distinto. Es el peor tipo de bug.
- Descartado `var(--breakpoint-md)` dentro de `@media`: las custom properties no son válidas en condiciones de media query.
- Descartado `@variant md { … }` anidado en cada regla: funciona en Tailwind 4.3.3, pero obliga a anidar todas las reglas, ata `globals.css` a la semántica de variantes de Tailwind (el proyecto casi no usa utilidades) y genera `(width >= 48rem)`, que no se encuentra buscando `768`. Ganancia real: el valor queda en un solo lugar. Para dos breakpoints, el comentario + el criterio de `rg` alcanza.

**D2 — Mapeo al breakpoint más cercano que no desborde.** Ver el inventario. 840 → 1024 (no 768), porque a 900 la nav de desktop desborda. El 720 de `.stats-inner` → 1024, porque a 768 recorta. El 820 de `.highlight-row` → 1024 (decisión de la persona al revisar el Draft: en tablet los 3 highlights quedan apilados). Descartado agregar cortes intermedios (600, 900): vuelve a la situación actual de cortes sueltos.

**D3 — Media queries co-ubicados en cada sección**, justo debajo de las reglas base de esa feature. Así cada paso del plan toca una sola sección y el diff se revisa por feature. Descartado un bloque único al final: separa la regla de su override y hace los diffs ilegibles.

**D4 — Tipografía con tokens `--fs-N`.** En `:root`: `--fs-8`, `--fs-9`, `--fs-10`, `--fs-11`, `--fs-12` y `--fs-13` valen `0.875rem` (14px) en mobile. En `@media (min-width: 768px)` valen su px literal (`--fs-9: 9px`, etc.). Cada `font-size: 9px` de `globals.css` pasa a `var(--fs-9)`. El desktop y la tablet calculan **exactamente** el mismo valor que hoy, y mobile queda ≥ 14px sin duplicar una regla por selector.
- Descartado un override por selector en mobile: unas 60 reglas duplicadas.
- Descartado subir el `font-size` del `body`: casi todo tiene un tamaño explícito, no hereda.
- El nombre dice el tamaño de desktop a propósito, para que la migración sea mecánica (9px → `--fs-9`).

**D5 — Press Start 2P se mantiene a 14px en mobile, con `letter-spacing` reducido.** La única excepción es `.crt-bottom`, que pasa a `var(--mono)` en mobile. En pixel a 14px los textos decorativos del CRT ocuparían unas 4 líneas y se comerían el alto del player (D8). Respeta la regla "subí el tamaño o cambiá la fuente, no lo escondas". En `.btn`, `.chip`, `.av-skin-option` y `.auth-tabs button`, el `letter-spacing` baja a `0.04em` en mobile y vuelve al actual en `≥768`. Descartado pasar a mono todos los textos chicos: pierde la estética arcade en todo el sitio.

**D6 — Navegación: se queda la hamburguesa + panel lateral (ya existe).**
- En mobile la barra muestra solo el logo y la hamburguesa. `.auth-btn` se oculta en `< 768`: a 14px no entra junto al logo.
- Dentro del panel se renderiza el **mismo** control de sesión que hoy está en la barra: con sesión, el botón `{user.name} ▾` que llama a `logout`; sin sesión, ya existe el link "Iniciar Sesión". Así no se pierde el logout en mobile y no se agrega texto nuevo.
- El panel suma: `id` + `aria-controls`; `aria-expanded` en la hamburguesa; `inert` cuando está cerrado (sus links dejan de ser tabulables); `Esc` cierra y devuelve el foco a la hamburguesa; al abrir, el foco va al primer link.
- Se agrega un botón de cierre `✕` con `aria-label="Cerrar menú"`, porque el panel tapa la hamburguesa. Es el único texto nuevo de la spec.
- Descartada una bottom nav: chocaría con los controles táctiles del player (que están abajo) y suma un componente nuevo.
- Descartado mostrar los links con scroll horizontal en la barra: 5 links a 14px no entran.

**D7 — Ranking del salón en mobile: filas de 2 líneas (columnas colapsadas).**
- Grid con áreas `"rk pl sc" "rk dt sc"`: la fecha va debajo del jugador, igual que ya hace `.lb-row` en el detalle. En mobile se oculta la celda de encabezado "FECHA", pero el dato sigue visible en cada fila.
- Descartado el scroll horizontal contenido: la columna que queda fuera de pantalla es justo PUNTUACIÓN, el dato principal.
- Descartadas las cards: el podio ya cumple ese rol para el top 3, y 10 cards son demasiado alto.

**D8 — HUD del player en mobile: stats en una fila y acciones en una tira horizontal contenida.**
- Presupuesto a 375×667: nav 68 + margen 8 + HUD + 8 + CRT (padding 8 + canvas 327×245 + 8 + D-pad 112–142 + 8 + `.crt-bottom` 42 + 8).
  - Si las acciones envuelven en 2 filas (skins / botones), el HUD mide ≈159 y el total ≈674–704px: no entra.
  - Con una sola fila de 44px que scrollea (`overflow-x: auto`), el HUD mide ≈111 y el total ≈626–656px: entra.
- En mobile, `order` pone PAUSA/FIN/SALIR primero y los skins después, para que PAUSA sea lo primero visible. El skin "CLÁSICO" asomando en el borde indica que la tira scrollea.
- Descartado achicar los controles táctiles por debajo de los 3.5rem de SPEC 12.
- Descartado esconder `.crt-bottom` o los skins.
- Riesgo aceptado: en mobile el orden visual (botones → skins) difiere del orden de tabulación (skins → botones).

**D9 — Player apaisado: canvas acotado por alto y controles a los costados.**
- Bajo `@media (orientation: landscape) and (max-height: 500px)`, **para cualquier puntero**: `.crt-screen { width: min(100%, calc((100dvh - 6rem) * 4 / 3)); margin-inline: auto }`. Con `aspect-ratio: 4/3` el canvas nunca supera el alto disponible. Esto sí se puede medir en Playwright.
- Además, con `(pointer: coarse)`: `.crt` pasa a grid `"dpad screen actions" / "dpad bottom actions"` con `.av-touch-controls { display: contents }`, el D-pad a la izquierda y los botones de acción a la derecha. El D-pad pasa a `clamp(7rem, 30dvh, 9rem)`.
- Por qué una query de **alto** y no de ancho: un iPhone Pro Max apaisado mide 932×430, es "tablet" por ancho, pero tiene el mismo problema de alto. Es una excepción documentada a "solo `min-width`", igual que las queries `pointer` existentes.
- Descartados los controles superpuestos sobre el canvas: SPEC 12 ya los descartó.
- Descartado reestructurar el markup de `GamePlayer`: `display: contents` resuelve el layout solo con CSS.
- Riesgo: algunos navegadores viejos pierden la semántica `role="group"` de un elemento con `display: contents`. En Safari 17+ y Chrome actuales no pasa, pero hay que verificarlo en un dispositivo real.

**D10 — En el player, la nav deja de ser sticky en mobile y en apaisado bajo.** Mobile-first: la base es `body:has(.av-player) .av-nav { position: relative }` y se restaura con `@media (min-width: 768px) and (min-height: 501px) { body:has(.av-player) .av-nav { position: sticky } }`. Así desktop y tablet vertical quedan igual que hoy. Mientras se juega no se navega, y la barra sticky le roba 68px permanentes al juego. En un iPhone SE real, donde la barra de Safari reduce el alto visible a ≈550px, alcanza un scroll corto para ver HUD, canvas y controles completos. `:has()` funciona en Safari 15.4+ y Chrome 105+. Descartado esconder la nav en el player: deja al usuario sin salida, más allá de SALIR.

**D11 — Modal: `.modal-bd { overflow-y: auto; align-items: flex-start }` + `.modal { margin-block: auto }`.** Centra cuando entra y scrollea cuando no entra (apaisado, teclado abierto). Descartado `align-items: safe center`: tiene soporte desigual (Safari).

**D12 — Touch targets ≥ 44px por ancho (base mobile) y restaurados en `≥768`.** Por ejemplo, `.btn { min-height: 2.75rem }` en la base y `min-height: 0` en `≥768`, así el desktop sigue con los 41px de hoy. Descartado `@media (pointer: coarse)`: es semánticamente mejor (cubre iPads), pero Playwright no lo emula y el criterio dejaría de ser verificable. Queda como mejora futura.

**D13 — No se toca el export `viewport`.** El meta que Next 16 genera por defecto (`width=device-width, initial-scale=1`) alcanza. Con `viewportFit: 'cover'` habría que agregar `env(safe-area-inset-*)` en la nav, el panel, el modal y los costados del player. Sin `cover`, iOS deja la UI dentro del área segura (letterbox en apaisado). Como prevención barata, el panel y el modal llevan `padding-bottom: max(<actual>, env(safe-area-inset-bottom))`, que vale 0 sin `cover`.

**D14 — `100vh` → `100svh` con fallback** en `.home-hero` (`min-height: calc(100vh - 60px); min-height: calc(100svh - 60px);`). Descartado `dvh` en el hero: cambia de alto cuando la barra de Safari se colapsa y hace "saltar" el layout al scrollear. En el player apaisado (D9) sí se usa `dvh`, porque ahí importa el alto visible real.

**D15 — `:hover` con `transform` dentro de `@media (hover: hover)`** (`.card`, `.mini-card`, `.feature-card`, `.highlight`). En desktop no cambia nada; en touch ya no queda "pegado". El tilt de `GameCard` es JS sobre `mousemove` y no se dispara con el dedo, así que no se toca.

---

## Plan de implementación

Reglas para todos los pasos:

- **Línea base antes del paso 1.** Con Playwright, en 1280×800 y 768×1024, guardar por ruta un JSON con `getComputedStyle` (`display`, `font-size`, `font-family`, `letter-spacing`, `padding`, `margin`, `grid-template-columns`, `min-height`, `position`) de todos los elementos visibles de `main` y `nav`. Después de cada paso, repetir y comparar. Solo se aceptan las diferencias listadas en "Cambios explícitos de layout por rango".
- Cada paso deja la app funcionando y se verifica en 375×667, 768×1024 y 1280×800 antes de pasar al siguiente.
- Verificación estática por paso: `npm run lint`. Sin build.
- Las reglas nuevas van mobile-first, co-ubicadas (D3). Al terminar cada sección no queda ningún `max-width` en ella.

1. **Fundaciones globales** (sin cambio visual en desktop ni tablet).
   - `app/globals.css`:
     - comentario de breakpoints al principio (D1);
     - tokens `--fs-8 … --fs-13` en `:root` + `@media (min-width: 768px)` (D4);
     - `.btn`, `.btn.lg`, `.chip`, `.lb-link` y `.auth-tabs button` con `font-size: var(--fs-N)`, `min-height: 2.75rem` y `letter-spacing: 0.04em` en la base, y sus valores actuales en `≥768` (D5, D12);
     - envolver los `:hover` con `transform` de `.card`, `.mini-card`, `.feature-card` y `.highlight` en `@media (hover: hover)` (D15).

2. **Nav y menú mobile** (hallazgos 1, 9, 16; línea 199).
   - `app/globals.css`, sección navbar:
     - la base es mobile: padding `0.75rem 1rem`, `.links` y `.coin-counter` ocultos, `.hamburger` visible con `min-width`/`min-height: 2.75rem`, `.auth-btn` oculto en `< 768`;
     - `.logo` con `min-height: 2.75rem`;
     - `.logo-text` y los links del panel con tokens;
     - `@media (min-width: 768px)`: `.auth-btn` visible;
     - `@media (min-width: 1024px)`: links, créditos, padding `14px 32px`, sin hamburguesa;
     - en `.av-mobile-panel`: `padding-bottom` con `env(safe-area-inset-bottom)` y clases nuevas `.av-mobile-panel-title`, `.av-mobile-panel-credits` y `.av-mobile-panel-close`.
   - `components/nav/Nav.tsx`:
     - `aria-expanded` y `aria-controls="av-mobile-panel"` en la hamburguesa;
     - en el `<aside>`: `id`, `aria-label="Menú"` e `inert={!open}`;
     - `Esc` cierra (listener en `window` solo mientras `open`);
     - foco al primer link al abrir y de vuelta a la hamburguesa al cerrar;
     - botón `✕` con `aria-label="Cerrar menú"`;
     - con sesión, el botón `{user.name} ▾` (mismo `onClick={logout}` + `close`) dentro del panel;
     - los estilos inline de "MENÚ" y "CRÉDITOS" pasan a clases.

3. **Player** (hallazgos 2, 3; parte de 13, 14 y 15; `.av-player` de la línea 1133).
   - `app/globals.css`, secciones player y touch:
     - `.av-player`: base `margin: 0.5rem auto`, `padding: 0 1rem 2rem`; `≥768`: `32px auto` y `0 24px 64px`;
     - `.player-hud`: padding `0.5rem` en mobile;
     - nueva `.hud-stats`: flex de una fila, gap `1rem`, `min-width: 0`; en `≥768`, gap 24 como hoy;
     - `.hud-stat .l` con `var(--fs-10)`;
     - `.hud-actions` en mobile: `flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; max-width: 100%`, y `.av-skin-group { order: 1 }` (D8); en `≥768`, como hoy;
     - `.crt`: padding `0.5rem` y `border-radius: 1rem` en mobile; `≥768`: 24px / 28px;
     - `.crt-bottom` en mobile: `font-family: var(--mono)`, `var(--fs-8)`, `flex-wrap: wrap` y `gap: 0.25rem 1rem` (D5);
     - `.av-touch-controls` con `margin-top: 0.5rem` en mobile;
     - `.av-touch-dpad` en mobile: `clamp(7rem, 30vw, 10rem)` (antes `clamp(8rem, 38vw, 10rem)`); en `≥768` se mantiene la fórmula de SPEC 12;
     - bloque `@media (orientation: landscape) and (max-height: 500px)` con el tope del canvas;
     - bloque `@media (orientation: landscape) and (max-height: 500px) and (pointer: coarse)` con el grid lateral y `display: contents` (D9);
     - nav no sticky en el player (D10).
   - `components/player/GamePlayer.tsx`:
     - el `<div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>` pasa a `className="hud-stats"`;
     - los estilos inline del overlay de pausa pasan a `.pause-title` y `.pause-hint`;
     - el color inline de "Jugador" pasa a la clase `.hud-stat.player`.
     - Sin cambios de lógica ni de orden del DOM.

4. **Modal "FIN DEL JUEGO"** (hallazgos 4 y 5; parte del 6).
   - `app/globals.css`:
     - `.modal-bd`: `overflow-y: auto; align-items: flex-start`, padding con `env(safe-area-inset-bottom)` (D11, D13);
     - `.modal`: `margin-block: auto`; padding `1.25rem` en mobile y 32px en `≥768`;
     - `.modal .input-row`: `flex-wrap: wrap`; el input con `flex: 1 1 10rem; min-width: 0; font-size: 1rem`, y el botón con `flex: 1 1 auto`; en `≥768`, input a 14px y sin wrap;
     - `.final-label`, `.save-error` y `.save-note` con tokens;
     - `.toast-saved` con `letter-spacing: 0` y `var(--fs-11)` en mobile.

5. **Inputs y formularios** (hallazgo 6; parte del 13).
   - `app/globals.css`:
     - `.av-search input`: base `font-size: 1rem` y `align-self: stretch` (área táctil de 48px; visualmente neutro porque el input es transparente); `≥768`: 13px;
     - `.field input` y `.contact-form textarea`: base `1rem`; `≥768`: 14px (el valor que hoy heredan del `body`);
     - `.field label`, `.av-search .ico` y `.auth-divider` con tokens;
     - `.social .btn` con `min-height: 2.75rem`.

6. **Salón de la Fama** (hallazgos 7 y 12; línea 1073 y la tabla de la línea 1133).
   - `app/globals.css`:
     - `.podium`: base 1 columna con `.podium-slot.gold { order: -1 }`; `≥768`: 3 columnas y `order: 0`;
     - `.hall-table .th, .tr` en base: grid `2.75rem minmax(0, 1fr) auto` con áreas `"rk pl sc" "rk dt sc"`, padding `0.625rem 0.75rem`; `.th > :nth-child(4)` oculto; `.pl` con `overflow-wrap: anywhere`;
     - `≥768`: `70px 1fr 1fr 140px`, sin áreas, padding `12px 18px`, encabezado FECHA visible;
     - `.hall-table .tr.you`: el padding-left se ajusta en los dos rangos;
     - textos con tokens (`.rk`, `.sc`, `.th`, `.you-label`, `.podium-slot .name/.date`);
     - `.av-hall`: base padding `0 1rem`, `≥768` 32px.
   - `components/hall-of-fame/HallOfFame.tsx`: los `fontSize` inline de "CAMPEÓN" y del subtítulo pasan a `.podium-champion` y `.hall-sub`. Los `fontSize` 36/20 del oro pasan a `.podium-slot.gold .rank-num` y `.score` (≥ 14, sin token).

7. **Home** (hallazgos 8, 10, 11, 17, 18, 20; líneas 1233, 1234, 1256, 1257, 1276, 1279, 1308, 1328, 1355).
   - `app/globals.css`, secciones HOME, ACTIVITY y PRICING:
     - grids según el inventario;
     - `.activity-grid` con `minmax(0, 1fr)`;
     - `.tick-row` compacto: `.tk-p { grid-area: 1 / 1 }`, `.tk-s { grid-area: 1 / 2 }`, `.tk-mid`, `.tk-t { grid-column: 1 / -1 }`;
     - `.ac-title` con `white-space: normal` en mobile y `nowrap` + `ellipsis` en `≥768`;
     - `.home-hero` con `100svh` (D14);
     - paddings de `.home-hero`, `.home-section`, `.home-stats` y `.home-final` en `1rem` mobile y 32px en `≥768`;
     - todos los textos de menos de 14px con tokens (`.hero-eyebrow`, `.kicker`, `.ft-title`, `.ft-desc`, `.mini-title`, `.mini-cat`, `.stat-u`, `.stat-s`, `.tk-*`, `.tp-*`, `.pc-*`, `.faq-*`, `.final-tag`).

8. **Biblioteca y detalle** (línea 558 y paddings de la 1133; parte de 13 y 14).
   - `app/globals.css`:
     - `.av-hero`, `.av-filters` y `.av-grid`: base padding mobile; `≥768` el actual;
     - `.av-hero .sub`: `clamp(0.875rem, 1.6vw, 14px)` (a ≥ 875px da 14px como hoy);
     - `.card .cover .label`, `.card .title`, `.card .desc`, `.score-badge` y `b` con tokens;
     - `.av-detail`: base 1 columna, padding `0 1rem`, margin `24px auto`; `≥768`: padding 32px y margin 48px; `≥1024`: `1.4fr 1fr`;
     - `.detail-tags span`, `.stat-strip .l`, `.leaderboard h3` y `.lb-row` (`.rk`, `.sc`, font 13) con tokens.
   - `components/detail/GameDetail.tsx`: el `fontSize: 10` inline de la fecha pasa a `.lb-date`.

9. **About, auth y footer** (líneas 1420 y 1443; hallazgo 18; parte de 14 y 15).
   - `app/globals.css`:
     - `.highlight-row`: base 1, `≥1024` 3;
     - `.contact-grid`: base 1 con gap 24, `≥1024` `1fr 1.2fr` con gap 40;
     - paddings de `.about-hero`, `.about-divider` y `.about-contact` en `1rem` mobile;
     - `.hl-text`, `.tip`, `.term-title` y `.contact-error` con tokens;
     - `.av-auth-wrap` con padding `2rem 1rem` en mobile;
     - nuevas `.auth-sub`, `.auth-terms` y `.av-footer` (padding `1.25rem 1rem` en mobile, `20px 32px` en `≥768`, `var(--fs-11)`).
   - `components/auth/Auth.tsx`: estilos inline del subtítulo y de los términos → clases.
   - `components/nav/Footer.tsx`: `style={{…}}` → `className="av-footer"`.

10. **Cierre.**
    - `rg "@media \(max-width" app/globals.css` → sin resultados.
    - `rg "@media" app/globals.css`: solo debe devolver `min-width: 768px`, `min-width: 1024px`, `pointer: coarse`, `hover: hover`, la query de apaisado de D9 y `(min-width: 768px) and (min-height: 501px)` de D10.
    - `rg "font-size: (8|9|1[0-3])px" app/globals.css`: solo debe aparecer dentro de la definición de tokens del paso 1 y en los overrides `≥768` documentados.
    - Repetir la medición completa de "Criterios de aceptación" en todos los viewports y comparar con la línea base de desktop.

---

## Criterios de aceptación

**Sin scroll horizontal**

- [ ] En 375×667, 390×844, 768×1024 y 1280×800, para `/`, `/games`, `/games/snake`, `/games/snake/play`, `/hall-of-fame` (tab SNAKE, que tiene filas), `/login` (los dos tabs) y `/about`: `document.documentElement.scrollWidth <= clientWidth`, medido con la scrollbar oculta (`html { scrollbar-width: none }`) y con el menú abierto y cerrado.
- [ ] Ningún elemento visible de `main` o `nav` tiene `getBoundingClientRect().right > clientWidth`. El honeypot de `/about` (`left: -9999px`, `aria-hidden`) queda excluido.
- [ ] En 667×375, `/games/snake/play` no tiene scroll horizontal.

**Touch targets y texto (mobile: 375×667 y 390×844)**

- [ ] Todo `a, button, input, select, textarea, [role=button], [role=radio]` visible mide ≥ 44×44px. Excepciones: el honeypot y los botones del D-pad (`.av-touch-dir`, `tabIndex=-1`), cuya zona táctil es el D-pad entero (≥ 7rem).
- [ ] Ningún nodo de texto visible tiene `font-size` calculado < 14px.
- [ ] Todo `input` y `textarea` visible tiene `font-size` ≥ 16px.

**Nav**

- [ ] A 375 y 390, la hamburguesa queda entera dentro del viewport, con o sin sesión (`localStorage.av_user`). La barra mide ≤ 72px de alto.
- [ ] La hamburguesa tiene `aria-expanded="false"` y pasa a `"true"` al abrir. `aria-controls` apunta al `id` del panel.
- [ ] Con el panel cerrado, Tab nunca enfoca sus links. Con el panel abierto, `Esc` lo cierra y el foco vuelve a la hamburguesa. El botón `✕` lo cierra.
- [ ] Con sesión iniciada, el panel muestra el botón `{user.name} ▾` y al tocarlo se cierra la sesión.
- [ ] A 900×800, la barra muestra la hamburguesa y no desborda. A 1024 y 1280, la barra muestra los links y los créditos como hoy.

**Player**

- [ ] 375×667, con `.av-touch-controls { display: grid }` forzado para simular `pointer: coarse`: en `scrollY = 0`, `.crt-screen` y `.av-touch-controls` quedan enteros dentro del viewport (`bottom ≤ 667`).
- [ ] 390×844, en las mismas condiciones: `.crt` entero dentro del viewport en `scrollY = 0`.
- [ ] 667×375 (sin forzar): `.crt-screen` mide ≤ 375 − 96 = 279px de alto y ≥ 240px. `.crt` mide ≤ 375px de alto: al scrollear hasta el CRT se ve completo.
- [ ] En el HUD a 375, PAUSA, FIN y SALIR son los primeros controles visibles de la fila y los skins se alcanzan scrolleando la fila (sin mover la página).
- [ ] `.crt-screen` mantiene la proporción 4:3 (diferencia < 1px) en todos los viewports.

**Modal "FIN DEL JUEGO"**

- [ ] A 375, todos los hijos de `.modal` quedan dentro de `.modal` y del viewport, y "GUARDAR PUNTUACIÓN" queda entero.
- [ ] A 667×375 se puede scrollear dentro de `.modal-bd` hasta ver "VOLVER AL VAULT".

**Salón de la Fama**

- [ ] A 375, ninguna celda del encabezado ni de las filas desborda su columna (`scrollWidth ≤ clientWidth` de cada celda). La fecha se ve debajo del jugador.
- [ ] A 375, el podio se lee 01, 02, 03 de arriba hacia abajo.

**Home**

- [ ] A 768, los 3 `.stat-block` quedan dentro de `.home-stats` (apilados).
- [ ] A 375 y 390, `.activity-card` no supera el borde de contenido de su sección.
- [ ] A 375, en `.tick-row` el puntaje (`.tk-s`) está en la primera fila, alineado a la derecha.

**Desktop igual que antes**

- [ ] A 1280×800, el JSON de estilos computados de cada ruta es idéntico a la línea base.
- [ ] A 768×1024, las únicas diferencias con la línea base son las de "Cambios explícitos de layout por rango".
- [ ] A 1024×768, la única diferencia de layout con la línea base es `.mini-rail` (6 columnas).

**Código**

- [ ] `rg "@media \(max-width" app/globals.css` no devuelve nada.
- [ ] `git diff --stat` solo muestra `app/globals.css`, `components/nav/Nav.tsx`, `components/nav/Footer.tsx`, `components/player/GamePlayer.tsx`, `components/hall-of-fame/HallOfFame.tsx`, `components/detail/GameDetail.tsx` y `components/auth/Auth.tsx`.
- [ ] `npm run lint` pasa y la consola del navegador no muestra errores nuevos en ninguna ruta.

---

## Verificación manual (`npm run dev`)

Herramientas:

- DevTools en modo dispositivo (iPhone SE 375×667, iPhone 12 Pro 390×844, iPad Mini 768×1024, rotar a apaisado), que **sí** emula `pointer: coarse` y muestra los controles táctiles.
- Un teléfono real en la red local, con la URL "Network" que imprime `npm run dev`. Si los recursos de dev no cargan desde la IP, revisar `allowedDevOrigins` en `next.config.ts`.

| Ruta | Viewport | Qué mirar |
| ---- | -------- | --------- |
| todas | iPhone SE, 12 Pro | La barra muestra el logo y la hamburguesa completos. El menú abre, cierra con ✕, con el backdrop y con `Esc` (teclado BT o desktop). Con sesión, el panel permite cerrarla. No hay scroll lateral al arrastrar con el dedo. |
| todas | 900px (DevTools responsive) | La barra muestra la hamburguesa, no los links cortados. |
| `/` | iPhone SE | El hero no queda más alto que la pantalla al cargar. Las tarjetas de actividad no tocan el borde. El puntaje del ticker está a la derecha. Los textos son legibles sin zoom. |
| `/` | iPad Mini | Estadísticas apiladas, sin "GLOBAL" cortado. |
| `/games` | iPhone SE | Tocar el buscador no hace zoom. Los chips se tocan sin errar. Las cards no quedan "levantadas" después del tap. |
| `/games/snake` | iPhone SE | El ranking se lee y las tags hacen wrap. "JUGAR AHORA" es fácil de tocar. |
| `/games/snake/play` | iPhone SE vertical (modo dispositivo) | El canvas y el D-pad se ven enteros al cargar. PAUSA/FIN/SALIR están a mano. La fila del HUD scrollea hasta los skins sin mover la página. Jugar una partida completa con el D-pad. |
| `/games/snake/play` | iPhone SE apaisado | D-pad a la izquierda y canvas al centro, entero. Para TETRIS/ROCAS, los botones de acción a la derecha. Probar `/games/tetris/play` y `/games/rocas/play`: multitouch D-pad + botón. |
| `/games/snake/play` | iPhone real | Con la barra de Safari visible, alcanza un scroll corto (la nav no es sticky) para ver HUD, canvas y controles. Los controles no hacen scroll ni zoom (SPEC 12 sigue cumpliéndose). |
| `/games/snake/play` → FIN | iPhone SE vertical y apaisado | El modal entra. Al enfocar el input el teclado no tapa el botón: se puede scrollear dentro del modal. Sin zoom al enfocar. "GUARDAR PUNTUACIÓN" se ve entero. |
| `/hall-of-fame` | iPhone SE | Podio 01 → 02 → 03. Tabla con la fecha debajo del nombre. Tabs con wrap. |
| `/login` | iPhone SE | Sin zoom al enfocar los campos. Los botones de 44px. Los dos tabs. |
| `/about` | iPhone SE, iPad Mini | Highlights en 1 columna (SE) y 3 (iPad) sin desborde. El formulario se envía (o muestra error) y no hay zoom al enfocar. |
| todas | 1280×800 | Comparar lado a lado con `main` (o con la línea base de estilos computados): debe verse idéntico. |

---

## Riesgos identificados

| Riesgo | Mitigación |
| ------ | ---------- |
| Un override `≥768` olvidado cambia el desktop sin que se note a simple vista | La línea base de estilos computados a 1280 y 768 se compara después de cada paso. |
| Un `font-size` literal < 14px queda sin token | La medición de texto < 14px a 375 y el `rg` del paso 10. |
| El presupuesto de alto del player (D8) no alcanza en la implementación real | Criterio medible a 375×667. Si no entra, frenar y reportar: no improvisar achicando los controles de SPEC 12 (regla confirmada por la persona). |
| `display: contents` en `.av-touch-controls` pierde `role="group"` en algún lector de pantalla viejo | Solo aplica en apaisado táctil. Se verifica en un dispositivo real. Alternativa documentada: envolver D-pad y botones en el markup (otra spec). |
| El orden visual del HUD en mobile (botones → skins) difiere del orden de tabulación | Aceptado (D8): solo en mobile, donde casi no se usa Tab. |
| `:has()` no soportado (Safari < 15.4) | La nav sigue sticky: es el comportamiento de hoy, sin regresión. |
| En iOS con la barra de Safari visible, 375×667 real tiene ≈550px útiles | La nav no es sticky en el player (D10), así que un scroll corto lo muestra todo. Se verifica en el iPhone real. |
| `.mini-rail` a 1024–1100 con 6 columnas queda apretado | Las tarjetas miden ≈147px, con título de 10px y cover cuadrada. Cambio explícito, confirmado por la persona al revisar el Draft. |
| `.highlight-row` apilado en 821–1023 alarga `/about` en tablet | Aceptado por la persona: prefiere apilar a 3 columnas apretadas. |

---

## Lo que **no** está en esta spec

- Texto ≥ 14px y touch targets ≥ 44px en tablet o con `pointer: coarse`.
- `viewport-fit=cover` y safe areas en toda la UI.
- Accesibilidad del modal (`role="dialog"`, trampa de foco), `htmlFor` en los labels, `metadata.title`.
- Cambios en `TouchControls.tsx`, en los layouts táctiles o en los motores.
- Pantalla completa, PWA, toggle de controles, arrastre en ARKANOID.
- Test runner o tests automatizados.

Cada uno de estos, si se necesita, va en su propia spec.
