# SPEC 13 — Quitar del catálogo los juegos sin motor

> **Status:** Implemented
> **Depends on:** SPEC 06 (games-table-and-leaderboard), SPEC 12 (touch-controls)
> **Date:** 2026-10-08
> **Objective:** Que el catálogo muestre solo juegos jugables, borrando de Supabase las 7 filas placeholder sin motor y todo lo que existe solo para ellas (clases `.cover-*`, reglas y listas en la documentación).

---

## Por qué existe esta spec

Hoy el catálogo tiene 11 juegos y solo 4 se pueden jugar (`rocas`, `tetris`, `arkanoid`, `snake`). Los otros 7 muestran una arena simulada, no aceptan puntajes y, desde la SPEC 12, tampoco tienen controles táctiles. Para quien entra desde el teléfono parecen juegos rotos. Hay tres puntos que no son obvios:

- **Se borran, no se ocultan.** Se evaluó filtrar `playable = true` en `getGames` (reversible, sin migración). Se eligió borrar las filas: el catálogo queda limpio en la base y no hay datos "fantasma" que el código tenga que saber ignorar.
- **El borrado es seguro hoy.** `scores.game_id` tiene una FK a `games(id)` sin `on delete cascade`. Se verificó con `execute_sql` (2026-10-08) que los 7 placeholders tienen **0 scores**, cosa esperable porque las RLS solo dejan insertar en juegos `playable`. Si en el momento de aplicar la migración alguno tuviera scores, la FK hace fallar el `DELETE` entero en lugar de perder datos.
- **Cambia la regla de galería.** `CLAUDE.md`, el skill `arcade-vault-game` y los agentes `game-planner` y `game-jam` prohíben "reutilizar los placeholders". Sin placeholders, esa parte de la regla queda vacía y hay que reescribirla. Además, el `game-planner` descartó Pac-Man, Space Invaders, Frogger, Breakout y Pong *porque chocaban con un placeholder*: ese motivo deja de existir.

---

## Alcance

**Dentro:**

- Migración nueva `supabase/migrations/<YYYYMMDDHHMMSS>_remove_placeholder_games.sql` que borra las 7 filas, aplicada con `apply_migration` usando el mismo SQL.
- `app/globals.css`: borrar las reglas de las 7 clases de portada que solo usan los placeholders (ver tabla).
- `lib/games.ts`: el comentario de ejemplo de `cover` (`"cover-bricks"`) pasa a una clase que existe (`"cover-rocas"`).
- Documentación:
  - `CLAUDE.md`: reescribir la sección *Gallery rule*.
  - `GAMES.md`: borrar la sección "Catálogo sin motor" y actualizar el contador.
  - `.agents/skills/arcade-vault-game/SKILL.md`: borrar la línea "Catalog slugs without engine yet" y la fila "`games` row … Only if the slug is NOT in the catalog" pasa a "Always".
  - `.claude/agents/game-planner.md` y `.claude/agents/game-jam.md`: la regla de galería deja de mencionar placeholders.
  - `.claude/agent-memory/game-planner/self-discarded-ideas.md`: las ideas descartadas por chocar con un placeholder quedan rehabilitadas (se anota el motivo y la fecha).
  - `GAMES-TODO.md`: ajustar las notas que comparan contra `duelo-pixel` y `ranaria`.
- `specs/10-croac-game.md` (sigue en `Draft`): quitar las menciones a `ranaria` como placeholder vigente y corregir los conteos esperados.

**Fuera de alcance (para specs futuras):**

- Editar la migración histórica `20261005171227_seed_games.sql`. Las migraciones ya aplicadas no se reescriben; una base nueva aplica el seed y después este borrado.
- Borrar los textos "ESTE JUEGO AÚN NO TIENE RANKING." / "Este juego todavía no tiene ranking." de `GamePlayer`, `GameDetail` y `HallOfFame`, ni la arena simulada (`.game-arena`). Quedan como camino defensivo por si en el futuro se carga un juego con `playable = false`.
- Cambiar el esquema (`games`, `scores`, vistas, RLS) o regenerar `database.types.ts`: es un cambio de datos, no de esquema.
- Filtrar por `playable` en `getGames`.
- Tocar `resources/` (prototipo original con las mismas portadas).
- Implementar motores para los juegos borrados.

---

## Modelo de datos

Filas que se borran de `public.games` (estado verificado el 2026-10-08):

| `id` | `cover` | `cat` | `color` | `sort_order` | Scores |
| ---- | ------- | ----- | ------- | ------------ | ------ |
| `bloque-buster` | `cover-bricks` | ARCADE | cyan | 1 | 0 |
| `caida` | `cover-tetro` | PUZZLE | magenta | 2 | 0 |
| `serpentina` | `cover-snake` | ARCADE | green | 3 | 0 |
| `gloton` | `cover-glot` | ARCADE | yellow | 4 | 0 |
| `invasores` | `cover-invaders` | SHOOTER | green | 5 | 0 |
| `ranaria` | `cover-rana` | ARCADE | green | 7 | 0 |
| `duelo-pixel` | `cover-duelo` | VERSUS | cyan | 8 | 0 |

Filas que quedan: `rocas` (6), `tetris` (9), `arkanoid` (10), `snake` (11), todas con `playable = true`. Los `sort_order` no se renumeran: solo ordenan, y los huecos no se ven.

Migración (lista explícita de ids, y además `not playable` como seguro):

```sql
delete from public.games
where id in ('bloque-buster', 'caida', 'serpentina', 'gloton', 'invasores', 'ranaria', 'duelo-pixel')
  and not playable;
```

Clases CSS que se borran de `app/globals.css`, con sus pseudo-elementos `::before`/`::after` y sus `@keyframes` si solo las usan ellas: `.cover-bricks`, `.cover-tetro`, `.cover-snake`, `.cover-glot`, `.cover-invaders`, `.cover-rana`, `.cover-duelo`. **No** se tocan `.cover-bg`, `.cover-rocas`, `.cover-tetris`, `.cover-arkanoid` ni `.cover-snake-fruit`.

---

## Comportamiento

- `/games` muestra 4 juegos. Los filtros de categoría que queden sin juegos (p. ej. VERSUS) se comportan como hoy con una categoría vacía.
- `/` (home) y `/hall-of-fame` solo listan los 4 juegos jugables; la pestaña inicial del Hall of Fame sigue siendo el primer juego jugable.
- `/games/<slug>` y `/games/<slug>/play` de un slug borrado responden 404 (ya pasa hoy: `getGameById` devuelve `null` y la página llama a `notFound()`).
- Los 4 juegos jugables, sus rankings y los scores existentes no cambian.

---

## Plan de implementación

Antes de escribir código, consultar en `node_modules/next/dist/docs/` lo necesario de Next 16 (según `AGENTS.md`). Verificación estática por paso: `npm run lint` y `npx tsc --noEmit` (sin build).

1. **Precondición.** Con `execute_sql`, volver a contar los scores de los 7 ids. Si alguno tiene scores, frenar y preguntar.
2. **Migración.** Crear `supabase/migrations/<YYYYMMDDHHMMSS>_remove_placeholder_games.sql` con el SQL del modelo de datos (timestamp de `date +%Y%m%d%H%M%S`) y aplicarla con `apply_migration` con el mismo SQL. Prueba: `execute_sql` devuelve exactamente 4 filas en `games`, todas `playable`, y los scores existentes siguen ahí.
3. **CSS.** Borrar de `app/globals.css` las 7 clases de portada con sus pseudo-elementos y los `@keyframes` que queden sin uso. Actualizar el comentario de `lib/games.ts`. Prueba: `rg 'cover-(bricks|tetro|snake([^-]|$)|glot|invaders|rana|duelo)' app components lib` sin resultados (`snake([^-]|$)` para no encontrar `cover-snake-fruit`); las portadas de los 4 juegos se ven igual en `/games`.
4. **Documentación de plataforma.** `CLAUDE.md` (*Gallery rule*: "Arcade Vault **adds** games: a new game is a new catalog row with its own slug, `sort_order` and `.cover-*` class, created already `playable`"), `GAMES.md`, `SKILL.md`, `game-planner.md`, `game-jam.md`. Prueba: `rg --hidden 'bloque-buster|serpentina|gloton|invasores|ranaria|duelo-pixel|\bcaida\b' --glob '!resources/**' --glob '!specs/**' --glob '!supabase/migrations/2026100517*'` solo devuelve las notas históricas de `GAMES-TODO.md` y de la memoria del planner que este paso deja a propósito.
5. **Memoria y to-do del planner.** En `self-discarded-ideas.md`, marcar como rehabilitadas (2026-10-08, SPEC 13) las ideas descartadas por chocar con un placeholder. En `GAMES-TODO.md`, ajustar las notas de "Por qué"/"Riesgo" que comparan contra `duelo-pixel` y `ranaria`.
6. **SPEC 10.** En `specs/10-croac-game.md` (sigue `Draft`): borrar el punto "RANARIA no se toca", los criterios sobre `ranaria` y la arena falsa, y cambiar "12 filas en `games`" por "5 filas". La prueba de RLS que usaba `game_id = 'ranaria'` pasa a usar un id inexistente.
7. **Pase final.** Recorrer los criterios de aceptación en `npm run dev`, revisar la consola, `npm run lint` y `npx tsc --noEmit`.

---

## Criterios de aceptación

**Base de datos**

- [ ] `select count(*) from games` devuelve 4, y los 4 tienen `playable = true`.
- [ ] Ninguno de los 7 ids de la tabla existe en `games`.
- [ ] La cantidad de filas en `scores` es la misma que antes de la migración.
- [ ] El archivo de migración existe en `supabase/migrations/` y su SQL es idéntico al aplicado (`list_migrations` lo muestra).
- [ ] `get_advisors` (security) no muestra advertencias nuevas.

**Aplicación**

- [ ] `/games` muestra exactamente ROCAS, TETRIS, ARKANOID y SNAKE, con sus portadas de siempre.
- [ ] `/` y `/hall-of-fame` solo muestran esos 4 juegos, sin errores.
- [ ] `/games/serpentina` y `/games/serpentina/play` responden 404.
- [ ] Los 4 juegos se juegan y guardan puntaje como antes (teclado y controles táctiles).
- [ ] A 375 px de ancho, `/games` no tiene scroll horizontal ni huecos raros en la grilla.

**Código y documentación**

- [ ] `rg 'cover-(bricks|tetro|snake([^-]|$)|glot|invaders|rana|duelo)' app components lib` no devuelve resultados.
- [ ] `CLAUDE.md`, `SKILL.md`, `game-planner.md` y `game-jam.md` no mencionan placeholders ni prohíben reutilizarlos.
- [ ] `GAMES.md` no tiene la sección "Catálogo sin motor" y dice "4 juegos jugables de 4 en el catálogo".
- [ ] `specs/10-croac-game.md` sigue en `Draft` y no depende de que `ranaria` exista.
- [ ] `git diff` no muestra cambios en `supabase/migrations/2026100517*`, `lib/supabase/database.types.ts`, `resources/`, `lib/games/*/` ni `package.json`.
- [ ] `npm run lint` y `npx tsc --noEmit` pasan sin errores.

---

## Decisiones

- **Sí:** borrar las filas con una migración nueva. El catálogo queda limpio en la base, sin filtros que recordar.
- **No:** ocultarlos con un filtro `playable = true` en `getGames`. Era reversible y sin migración, pero deja 7 filas que todo el código tiene que ignorar.
- **Sí:** lista explícita de ids + `and not playable`. Un error de tipeo no puede borrar un juego jugable.
- **No:** `delete … where not playable` sin lista. Borraría también una fila futura que alguien cargue sin motor a propósito.
- **No:** `on delete cascade` ni borrar scores. Si aparece un score, la FK hace fallar el borrado y se frena (paso 1).
- **No:** renumerar `sort_order`. Son solo para ordenar; renumerar toca filas que no cambian.
- **No:** editar la migración del seed. Las migraciones aplicadas son historia.
- **Sí:** borrar las clases `.cover-*` huérfanas. CSS muerto es deuda; si un juego vuelve, trae su portada en su spec.
- **Sí:** mantener los textos "sin ranking" y la arena simulada. Cuestan poco y evitan una pantalla rota si alguien carga una fila no jugable.
- **Sí:** ajustar la SPEC 10 ahora. Sigue en `Draft` y, tal como está, tiene criterios que dependen de `ranaria`.
- **Sí:** rehabilitar las ideas que el `game-planner` descartó por chocar con placeholders. El motivo deja de existir; decidir si se proponen queda para el planner.

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Entre la verificación y la migración alguien guarda un score en un placeholder | Imposible por RLS (`playable = false`). Si pasara, la FK hace fallar el `DELETE` y el paso 1 lo detecta antes. |
| Se borra una clase `.cover-*` o un `@keyframes` que usa un juego jugable | Lista cerrada de 7 clases; se buscan usos de cada `@keyframes` antes de borrarlo y se revisan las 4 portadas en `/games`. |
| Un enlace externo o marcador a `/games/<placeholder>` | Responde 404, que es la respuesta correcta para un juego que ya no existe. |
| Una base nueva (otro entorno) aplica el seed y queda con 11 juegos | La migración nueva corre después del seed y los borra. |
| La categoría VERSUS queda sin juegos | Aceptado. El filtro muestra la lista vacía como cualquier categoría sin juegos. |
| El `game-planner` vuelve a proponer Pac-Man o Space Invaders | Es lo esperado: ahora son candidatos válidos y la persona decide. |

---

## Lo que **no** está en esta spec

- Editar la migración del seed.
- Cambios de esquema, vistas, RLS o tipos generados.
- Quitar los textos "sin ranking" o la arena simulada.
- Filtrar `playable` en las consultas.
- Motores para los juegos borrados.
- Cambios en `resources/`.

Cada uno de estos, si se necesita, va en su propia spec.
