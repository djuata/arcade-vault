# SPEC 02 — Página de Home (landing) de Arcade Vault

> **Status:** Approved
> **Depends on:** SPEC 01 (arcade-vault-mvp-visual)
> **Date:** 2026-09-26
> **Objective:** Implementar la página de Home (landing de marketing con hero, secciones "por qué", preview de juegos, stats, actividad en vivo y pricing) en la ruta raíz `/`, portada de `resources/templates/home-about/home.jsx`, moviendo la Biblioteca actual a `/games` y sin tocar la pantalla de About.

---

## Por qué existe esta spec

La spec 01 dejó la Biblioteca (grilla de juegos) viviendo en `/`. El prototipo en `resources/templates/home-about/` agrega una pantalla más: `home.jsx`, una landing de marketing completamente distinta de la Biblioteca (hero con CTAs, sección "por qué Arcade Vault", preview de 6 juegos, stats, actividad en vivo con ticker y top jugadores, pricing con FAQ, CTA final). Su `nav.jsx` trae "Inicio" y "Biblioteca" como links separados — confirmando que son dos pantallas distintas, no una.

Esto obliga a una decisión de ruteo que la spec 01 no necesitaba resolver, ya cerrada con el usuario:

1. **Home pasa a ocupar `/`.** La Biblioteca se muda a `/games`, coherente con `/games/[id]` que ya existe.
2. **El Nav suma solo "Inicio".** El prototipo también trae "Acerca de", pero esa pantalla no tiene spec propia todavía — no se agrega un link muerto.
3. **Los datos mock del ticker y del top de jugadores quedan hardcodeados** dentro del componente Home, igual que en el prototipo — no se centralizan en `lib/games.ts` porque nada más los consume.
4. **Todos los CTAs de Home navegan a rutas reales** ya construidas en la spec 01 (`/games`, `/games/[id]`, `/login`, `/hall-of-fame`).

Como consecuencia directa de mover la Biblioteca a `/games`, los cuatro lugares que hoy navegan a `/` como "volver a la biblioteca" deben apuntar a `/games` en vez de a `/` (que ahora es Home): `GameDetail.tsx`, `GamePlayer.tsx`, `HallOfFame.tsx` y el redirect post-login/invitado de `Auth.tsx`.

---

## Scope

**In:**

- `app/page.tsx` pasa a renderizar el nuevo componente `Home` en vez de `Library`.
- `app/games/page.tsx` (nueva ruta): renderiza `Library`, exactamente el mismo contenido que hoy tiene `/`.
- `components/home/Home.tsx` ("use client"): hero con siluetas flotantes decorativas (8 SVGs) y CTAs, sección "¿Por qué Arcade Vault?" (4 feature cards), sección "Juegos disponibles ahora" (preview de los primeros 6 juegos de `GAMES` con mini-cards), sección de stats, sección "Actividad en vivo" (ticker de últimas puntuaciones + top 5 jugadores, datos mock hardcodeados), sección de pricing con FAQ, CTA final — portado 1:1 de `resources/templates/home-about/home.jsx`.
- Hook de reveal-on-scroll (IntersectionObserver sobre `.reveal`), portado igual que en el prototipo.
- Clases CSS específicas de Home (no presentes hoy en `app/globals.css`) portadas desde `resources/templates/home-about/styles.css`: `.home`, `.home-hero*`, `.hero-eyebrow`, `.home-title`, `.home-sub`, `.home-ctas`, `.hero-scroll`, `.home-section`, `.section-head`/`.section-rule`/`.section-title` (los que falten), `.feature-grid`/`.feature-card`/`.ft-*`, `.mini-rail`/`.mini-card`/`.mini-*`, `.home-stats`/`.stats-inner`/`.stat-*`, `.activity-grid`/`.activity-card`/`.ac-*`/`.ticker`/`.tick-row`/`.tk-*`/`.top-list`/`.top-row`/`.tp-*`/`.lb-link`, `.pricing-grid`/`.price-card`/`.pc-*`/`.pricing-faq`/`.faq-*`, `.home-final`/`.final-*`, `.home-silos`/`.silo`, `.reveal`/`.reveal.in`.
- `components/nav/Nav.tsx`: agregar el link "Inicio" (→ `/`), redirigir el link "Biblioteca" a `/games`, separar la lógica de estado activo entre Home y Biblioteca (desktop y panel móvil).
- Actualizar a `/games` los 4 puntos que hoy navegan/redirigen a `/`: `components/detail/GameDetail.tsx` ("VOLVER AL VAULT"), `components/player/GamePlayer.tsx` ("VOLVER AL VAULT"), `components/hall-of-fame/HallOfFame.tsx` ("VOLVER A LA BIBLIOTECA"), `components/auth/Auth.tsx` (redirect tras login/invitado).
- Metadata (`<title>`) de `app/page.tsx` (Home) y `app/games/page.tsx` (Biblioteca).

**Out of scope (para specs futuras):**

- La pantalla **About** (`about.jsx`): misión, highlights y formulario de contacto. No se toca ni se referencia desde el Nav en esta spec.
- El link "Acerca de" en el Nav — se agrega junto con la spec de About, no antes.
- Cualquier dato real detrás del ticker de "últimas puntuaciones" o del "top jugadores" de Home — siguen siendo arrays mock hardcodeados, igual que en el prototipo.
- Cambios a la lógica de negocio de Biblioteca, Detalle, Reproductor, Login o Salón de la Fama — solo se tocan sus links/redirects hacia `/`.
- Tests automatizados de cualquier tipo — el proyecto sigue sin test runner configurado.

---

## Data model

Esta spec no introduce estructuras de datos nuevas. `Home` reutiliza `GAMES` de `lib/games.ts` (ya existente, spec 01) para la sección de preview (`GAMES.slice(0, 6)`). Los datos del ticker de actividad y del top 5 de jugadores son arrays literales hardcodeados dentro de `components/home/Home.tsx`, portados 1:1 de los arrays inline en `resources/templates/home-about/home.jsx` — no se exportan ni se tipan como entidad de dominio porque nada más los consume.

---

## Implementation plan

1. Crear `app/games/page.tsx` que renderiza `<Library />` con el mismo `metadata.title` que hoy tiene `app/page.tsx`. Test manual: `/games` muestra exactamente lo que hoy muestra `/`.
2. Portar a `app/globals.css` las clases CSS de Home listadas en Scope, tomadas de `resources/templates/home-about/styles.css`, excluyendo explícitamente los selectores de About y decorativos no usados por `home.jsx` (`.about-*`, `.contact-*`, `.highlight*`, `.div-*`, `.terminal-success`, `.term-*`, `.gp-*`, `.dp-*`, `.rivet`, `.screw`, `.live-led`, `.lg-key`, `.lg-row`). Test manual: `npm run lint` no rompe, no quedan selectores duplicados.
3. Construir `components/home/Home.tsx` ("use client"), portando 1:1 la estructura de `home.jsx`: hook de reveal-on-scroll, `FloatingSilhouettes` (8 SVGs), hero con sus 2 CTAs, sección de 4 feature cards, preview de 6 juegos con mini-cards enlazadas a `/games/[id]`, sección de stats, sección de actividad en vivo (ticker + top 5, con el link "VER SALÓN" a `/hall-of-fame`), sección de pricing con FAQ y su CTA a `/login`, CTA final a `/games`. Test manual: comparar cada sección visualmente contra `resources/templates/home-about/arcade-vault-standalone.html`.
4. Reemplazar `app/page.tsx` para renderizar `<Home />` en vez de `<Library />`, con su propio `metadata.title`. Test manual: `/` muestra la nueva Home; `/games` sigue mostrando la Biblioteca (paso 1) sin cambios.
5. Actualizar `components/nav/Nav.tsx`: agregar el link "Inicio" (→ `/`) antes de "Biblioteca", cambiar el href de "Biblioteca" a `/games`, separar `isHomeActive` de `isLibraryActive` (biblioteca activa en `/games` y `/games/[id]/*`), replicar los mismos cambios en el panel móvil. No agregar "Acerca de". Test manual: el Nav resalta "Inicio" en `/` y "Biblioteca" en `/games` y en el detalle de cualquier juego.
6. Actualizar los 4 puntos que hoy navegan/redirigen a `/` para que apunten a `/games`: `GameDetail.tsx`, `GamePlayer.tsx`, `HallOfFame.tsx`, `Auth.tsx`. Test manual: cada botón/redirect lleva a `/games`, ninguno vuelve a `/`.
7. Pase final de integración: recorrer Home → Biblioteca → Detalle → Reproductor → Login → Salón de la Fama comparando contra el prototipo, correr `npm run lint`, y confirmar en devtools que ninguna ruta tira errores de consola.

---

## Acceptance criteria

- [ ] `/` muestra la nueva Home (hero, por qué Arcade Vault, preview de juegos, stats, actividad en vivo, pricing, CTA final) en vez de la Biblioteca.
- [ ] `/games` muestra exactamente el mismo contenido que antes tenía `/` (hero, buscador, chips de categoría, grilla de 8 juegos).
- [ ] El Nav muestra "Inicio" (→ `/`) y "Biblioteca" (→ `/games`) como links separados; cada uno se resalta como activo solo en su ruta correspondiente.
- [ ] El Nav no muestra ningún link a "Acerca de".
- [ ] El botón "▶ EXPLORAR JUEGOS" del hero navega a `/games`.
- [ ] El botón "✦ CREAR CUENTA" del hero navega a `/login`.
- [ ] Las 6 mini-cards de "Juegos disponibles ahora" muestran los primeros 6 juegos de `GAMES` y cada click navega a `/games/[id]` del juego correspondiente.
- [ ] El botón "VER TODOS LOS JUEGOS →" navega a `/games`.
- [ ] El botón "VER SALÓN →" de la sección de actividad navega a `/hall-of-fame`.
- [ ] El botón "EMPEZAR GRATIS →" de pricing navega a `/login`.
- [ ] El CTA final "INSERTAR MONEDA →" navega a `/games`.
- [ ] Las secciones con la clase `reveal` (por qué, stats, actividad, pricing, CTA final) aparecen con la animación de entrada al hacer scroll.
- [ ] Las 8 siluetas flotantes decorativas se renderizan en el hero.
- [ ] "VOLVER AL VAULT" en Detalle y en Reproductor navega a `/games`.
- [ ] "VOLVER A LA BIBLIOTECA" en Salón de la Fama navega a `/games`.
- [ ] Iniciar sesión (con cualquier texto) o entrar como invitado redirige a `/games`.
- [ ] `npm run lint` no reporta errores.
- [ ] Ninguna ruta muestra errores en la consola del navegador al navegar entre Home, Biblioteca, Detalle, Reproductor, Login y Salón de la Fama.

---

## Decisions

- **Sí:** Home ocupa la ruta raíz `/`; la Biblioteca se muda a `/games`. Decisión explícita del usuario — es la única forma de tener ambas pantallas como rutas separadas sin una URL rara para la landing.
- **Sí:** como consecuencia directa de mover la Biblioteca, los 4 links/redirects que hoy apuntan a `/` desde Detalle, Reproductor, Salón de la Fama y Auth pasan a apuntar a `/games`. No es una decisión pedida aparte, es la misma decisión de ruteo aplicada de forma consistente.
- **Sí:** el Nav suma únicamente "Inicio". "Acerca de" queda afuera hasta que exista una spec para esa pantalla — evita un link a una ruta que no existe.
- **Sí:** los datos del ticker y del top de jugadores quedan hardcodeados inline en `Home.tsx`, igual que en el prototipo. Son decorativos, no reales, y nada más los consume — extraerlos a `lib/games.ts` sería estructura sin uso real.
- **Sí:** todos los CTAs de Home navegan con `next/link`/`router.push` a rutas reales ya construidas (`/games`, `/games/[id]`, `/login`, `/hall-of-fame`). Coincide con el patrón ya establecido en el resto de la app (spec 01).
- **No:** portar las clases CSS de About (`.about-*`, `.contact-*`, `.highlight*`, `.div-*`, `.terminal-success`, `.term-*`) ni las decorativas no usadas por `home.jsx` (`.gp-*`, `.dp-*`, `.rivet`, `.screw`, `.live-led`, `.lg-key`, `.lg-row`). Quedan para la spec de About, que es quien las necesita.
- **No:** tooling de testing nuevo para esta spec. Mismo motivo que spec 01 — no hay test runner configurado; verificación por QA visual manual + lint.

---

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Mover la Biblioteca de `/` a `/games` es un breaking change de rutas frente a spec 01 | El proyecto no está en producción; esta misma spec actualiza los 4 puntos internos que dependían de `/` como Biblioteca, dejando el árbol de navegación consistente de punta a punta. |
| El ticker y el top de jugadores son arrays estáticos — riesgo de hydration mismatch si en algún momento se reemplazan por `Math.random()` en el render | Se portan como arrays literales fijos, igual que el prototipo; no usan aleatoriedad en el árbol de render. |
| El hook de reveal-on-scroll usa `IntersectionObserver`, que no existe en el render de servidor | `Home.tsx` es un client component ("use client"); el observer se registra en `useEffect`, que solo corre en el navegador. |

---

## What is **not** in this spec

- La pantalla About (misión, highlights, formulario de contacto) y su link en el Nav.
- Cualquier dato real detrás del ticker de actividad o el top de jugadores de Home.
- Cambios a la lógica interna de Biblioteca, Detalle, Reproductor, Login o Salón de la Fama más allá de sus links/redirects hacia `/`.
- Tests automatizados de cualquier tipo.

Cada uno de estos, si se necesita, va en su propia spec.
