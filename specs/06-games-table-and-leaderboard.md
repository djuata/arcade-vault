# SPEC 06 — Tabla de juegos y leaderboard en Supabase

> **Status:** Implemented
> **Depends on:** SPEC 01 (arcade-vault-mvp-visual), SPEC 04 (supabase-connection), SPEC 05 (asteroids-game)
> **Date:** 2026-10-05
> **Objective:** Reemplazar el catálogo mock (`lib/games.ts`) y los puntajes simulados (`av_scores` + `seededScores`) por las tablas `games` y `scores` de Supabase, de modo que biblioteca, detalle, home, reproductor y Salón de la Fama lean y escriban datos reales.

---

## Por qué existe esta spec

La Spec 04 dejó la app conectada a Supabase pero sin una sola tabla (`list_tables` y `list_migrations` devuelven vacío). Hoy tres cosas siguen siendo mentira:

- **El catálogo** vive en el arreglo `GAMES` de `lib/games.ts`, importado por `Library`, `Home`, `HallOfFame` y las páginas `app/games/[id]` y `app/games/[id]/play`.
- **Los puntajes guardados** van a `localStorage["av_scores"]` desde `saveScore` en `components/player/GamePlayer.tsx`, y nadie los lee.
- **Los rankings** (Salón de la Fama y detalle de juego) se inventan con `seededScores`, y `best` / `plays` en cada `Game` son números escritos a mano.

Con la Spec 05, ROCAS es el primer juego con motor real, así que por fin hay puntajes que valen la pena guardar. Esta spec es el momento en que lo mock se vuelve dato.

Decisiones ya cerradas con el usuario:

1. **Una sola spec** para `games` y `scores`: el leaderboard tiene FK a `games`, no se pueden separar sin dejar una spec sin efecto visible.
2. **`games` en Supabase es la fuente de verdad** del catálogo. La UI deja de leer `GAMES` de `lib/games.ts`.
3. **Identidad anónima:** el puntaje se guarda con el nombre que escribe el jugador en el modal. Sin auth ni `user_id`.
4. **Anti-trampa aceptado y documentado:** el puntaje lo calcula el cliente y se puede falsificar. Solo hay validación de forma en la base.
5. **`best` y `plays` derivados** de `scores`, no columnas.
6. **Sin datos demo:** la base arranca vacía y la UI muestra estados vacíos.
7. **"TU MEJOR MARCA"** se resuelve por coincidencia de `player_name` con el nombre de la sesión simulada (`av_user`).
8. **Solo los juegos con motor real guardan puntajes** (`games.playable`). Hoy: solo `rocas`.

---

## Scope

**In:**

- Migración de esquema: tablas `public.games` y `public.scores`, índice `scores (game_id, score desc)`, RLS habilitada en ambas con políticas explícitas.
- Migración de seed: los 8 juegos de `lib/games.ts` en `games`, con `playable = true` solo para `rocas`.
- Dos vistas con `security_invoker`: `games_with_stats` (juego + `best_score` + `plays_count`) y `scores_ranked` (puntaje + `rank` por juego).
- Los SQL de ambas migraciones commiteados en `supabase/migrations/` (además de aplicarse con el MCP de Supabase) para que el esquema quede en el repo.
- Tipos TypeScript generados en `lib/supabase/database.types.ts` y clientes de `lib/supabase/client.ts` / `server.ts` tipados con `createClient<Database>`.
- Capa de datos: `lib/data/games.ts` (`getGames`, `getGameById`) y `lib/data/scores.ts` (`getTopScores`, `getTopScoresByGame`), usando el cliente de servidor.
- Cambios en `lib/games.ts`: `Game` incorpora `playable: boolean` y `plays` pasa de `string` a `number`. Al final se eliminan `GAMES`, `PLAYERS` y `seededScores`; se conservan los tipos y `CATS`.
- Biblioteca (`/games`), Home (`/`) y `GameCard` leen los juegos de la base: las páginas son Server Components que pasan `games` por props a `Library` y `Home`.
- Detalle (`/games/[id]`) y reproductor (`/games/[id]/play`) leen el juego de la base (`notFound()` si no existe); el detalle muestra el top 10 real.
- Reproductor: "GUARDAR PUNTUACIÓN" inserta en `scores` con el cliente de browser; estados "guardando", "guardado" y error genérico; si el juego no es `playable`, el modal no ofrece guardar y lo explica. Se deja de escribir `av_scores`.
- Salón de la Fama (`/hall-of-fame`): pestañas por juego con el top 10 real de cada uno, podio con huecos si hay menos de 3 puntajes, estado vacío y la fila "TU MEJOR MARCA" por coincidencia de nombre.
- Estado vacío con estilos mínimos en `app/globals.css`, reusando los tokens existentes.
- Verificación de RLS contra la API REST con la publishable key.

**Out of scope (para specs futuras):**

- Autenticación real, `user_id` en `scores` y RLS por dueño. `lib/session-context.tsx` no se toca.
- Anti-trampa más allá de las restricciones de forma: validación server-side del puntaje, cotas por juego, duración mínima de partida, rate limiting.
- Insertar vía Route Handler (`POST /api/scores`). El insert es directo desde el browser, protegido por RLS.
- Migrar los puntajes viejos de `localStorage["av_scores"]`. Esa clave queda huérfana en los navegadores que la tengan; no se lee ni se borra.
- Motores reales para los otros 7 juegos (Tetris, Arkanoid, etc.): cada uno va en su spec y activa `playable` al integrarse.
- Datos demo o seed de puntajes falsos.
- Paginación del ranking, filtros por fecha, "puntajes de hoy/semana".
- Realtime (suscripciones a cambios del ranking).
- Edición o administración de juegos desde la UI; el catálogo se modifica por migración.
- Contador de partidas iniciadas (`plays` real). Aquí "partidas" equivale a puntajes guardados.
- Perfil de jugador, borrado de puntajes, moderación de nombres.
- Tests automatizados — el proyecto sigue sin test runner configurado.

---

## Data model

**Tabla `public.games`** — catálogo. El `id` es el slug que ya usan las rutas (`/games/rocas`).

```sql
create table public.games (
  id         text primary key,
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null,
  color      text not null check (color in ('cyan','magenta','yellow','green')),
  playable   boolean not null default false,
  sort_order smallint not null,
  created_at timestamptz not null default now()
);
```

**Tabla `public.scores`** — un registro por puntaje guardado.

```sql
create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games(id),
  player_name text not null check (char_length(btrim(player_name)) between 1 and 10),
  score       integer not null check (score > 0 and score <= 99999999),
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);
```

El límite de 10 caracteres coincide con el `slice(0, 10)` que ya aplica el input del modal en `GamePlayer.tsx`.

**RLS** (habilitada en ambas tablas, sin política = sin acceso):

| Tabla | Operación | Rol | Regla |
| --- | --- | --- | --- |
| `games` | `select` | `anon`, `authenticated` | `using (true)` |
| `games` | `insert` / `update` / `delete` | todos | sin política: solo por migración |
| `scores` | `select` | `anon`, `authenticated` | `using (true)` |
| `scores` | `insert` | `anon`, `authenticated` | `with check (exists (select 1 from public.games g where g.id = game_id and g.playable))` |
| `scores` | `update` / `delete` | todos | sin política: los puntajes son inmutables |

**Vistas** (ambas con `security_invoker = true` para que respeten la RLS de quien consulta):

```sql
-- games_with_stats: todas las columnas de games + best_score (0 si no hay puntajes)
--                   + plays_count (cantidad de puntajes guardados)
-- scores_ranked:    id, game_id, player_name, score, created_at
--                   + rank = row_number() over (partition by game_id
--                            order by score desc, created_at asc)
```

**Tipos en el código** (`lib/games.ts` después de la spec):

```ts
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: GameAccent;
  playable: boolean;
  best: number;   // 0 si el juego no tiene puntajes
  plays: number;  // cantidad de puntajes guardados
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/YYYY", derivado de created_at
}
```

**Convenciones:**

- La capa de datos mapea las columnas snake_case de la base (`best_score`, `plays_count`, `player_name`, `created_at`) a los tipos de arriba. Los componentes nunca ven snake_case.
- `best` en `0` se muestra como `—` en `GameCard` y `GameDetail`.
- Un único tipo `Game`: no se crea un `GameWithStats` paralelo.
- El top de un juego se lee de `scores_ranked` con `rank <= 10`; el desempate lo gana el puntaje más antiguo.

---

## Implementation plan

Antes de escribir código de la app, consultar la guía de Next.js 16 en `node_modules/next/dist/docs/` (según `AGENTS.md`) para confirmar el comportamiento de Server Components que leen `cookies()` (render dinámico) y el patrón para pasar datos a Client Components. Si `node_modules/` no existe, instalar dependencias primero. Cada paso deja la app compilando y funcionando.

1. **Migración de esquema.** Aplicar con `apply_migration` del MCP las tablas `games` y `scores`, el índice y la RLS con las políticas de la tabla de arriba. Guardar el SQL en `supabase/migrations/`. Verificar con `list_tables` (RLS activa) y `get_advisors` de seguridad sin avisos críticos.
2. **Migración de seed.** Aplicar y guardar el insert de los 8 juegos de `lib/games.ts` (mismo `id`, `title`, `short`, `long`, `cat`, `cover`, `color`), con `sort_order` según el orden actual del arreglo y `playable = true` solo en `rocas`. Verificar con `execute_sql`: 8 filas, 1 jugable.
3. **Vistas.** Aplicar y guardar `games_with_stats` y `scores_ranked` con `security_invoker = true`. Verificar con `execute_sql` que `games_with_stats` devuelve 8 filas con `best_score = 0` y `plays_count = 0`.
4. **Verificación de RLS por REST.** Con `curl` y la publishable key (`apikey` + `Authorization: Bearer`): `GET /rest/v1/games` devuelve 8; un `POST /rest/v1/scores` válido para `rocas` responde `201`; son rechazados un POST a un juego no jugable, con `player_name` de 11 caracteres, con `score` `0` y con `game_id` inexistente; `PATCH` y `DELETE` sobre `scores` no afectan filas; `POST` a `games` es rechazado. Borrar con `execute_sql` los puntajes de prueba al terminar.
5. **Tipos y clientes tipados.** Generar con `generate_typescript_types` el archivo `lib/supabase/database.types.ts`; tipar `createClient<Database>` en `lib/supabase/client.ts` y `lib/supabase/server.ts` sin cambiar sus firmas públicas. El health check `/api/health/supabase` sigue respondiendo `200`.
6. **Capa de datos.** Crear `lib/data/games.ts` y `lib/data/scores.ts` (funciones de servidor que mapean a `Game` y `ScoreRow`; ante error de Supabase lanzan un `Error` genérico sin exponer detalles). En `lib/games.ts`, agregar `playable` a `Game`, pasar `plays` a `number` y ajustar el mock `GAMES` para seguir compilando. Aún nadie usa la capa de datos.
7. **Biblioteca, Home y tarjeta.** `app/games/page.tsx` y `app/page.tsx` llaman a `getGames()` y pasan `games` por props a `Library` y `Home`; `Home` mantiene los primeros 6. `GameCard` muestra `—` cuando `best` es `0`. Prueba manual: `/games` y `/` muestran los 8 juegos y los filtros por categoría funcionan.
8. **Detalle y página del reproductor.** `app/games/[id]/page.tsx` usa `getGameById` y `getTopScores(id, 10)`; `app/games/[id]/play/page.tsx` usa `getGameById`. Ambos hacen `notFound()` si el juego no existe, y `generateMetadata` lee de la base. `GameDetail` muestra el top 10 real o el estado vacío. Prueba manual: `/games/rocas` y `/games/no-existe` (404).
9. **Reproductor guarda en Supabase.** En `GamePlayer.tsx`, reemplazar `saveScore` por un insert en `scores` con el cliente de browser; estados guardando, guardado y error genérico ("NO SE PUDO GUARDAR. INTÉNTALO DE NUEVO") con reintento; deshabilitar el botón si el nombre está vacío o el puntaje es `0`; si `!game.playable`, no mostrar el guardado y explicar que ese juego aún no tiene ranking. Eliminar `SCORES_STORAGE_KEY`. Prueba manual: jugar ROCAS, perder, guardar y ver la fila con `execute_sql`.
10. **Salón de la Fama.** `app/hall-of-fame/page.tsx` obtiene los juegos y `getTopScoresByGame()` y los pasa a `HallOfFame`. Pestañas por juego en orden de `sort_order`; podio con el rango faltante en `—` cuando hay menos de 3 puntajes; estado vacío "AÚN NO HAY PUNTAJES. SÉ EL PRIMERO" sin puntajes; fila "TU MEJOR MARCA" con el cliente de browser (mejor `score` donde `player_name = user.name` y `rank = 1 + count(score > mejor)`), usando `abortSignal` de la consulta al cambiar de pestaña. Agregar el estilo del estado vacío a `app/globals.css`.
11. **Limpieza del mock.** Eliminar `GAMES`, `PLAYERS` y `seededScores` de `lib/games.ts`; confirmar con `rg` que nada los importa. Ajustar los comentarios del encabezado del archivo.
12. **Pase final de integración.** Recorrer los criterios de aceptación en `npm run dev`, revisar la consola del navegador y correr `npm run lint`.

---

## Acceptance criteria

- [ ] `list_tables` (esquema `public`) muestra `games` y `scores` con RLS habilitada, y `list_migrations` muestra las migraciones de esquema, seed y vistas.
- [ ] `supabase/migrations/` contiene el SQL de cada migración aplicada.
- [ ] `games` tiene exactamente 8 filas con los mismos `id` que el catálogo anterior, y solo `rocas` tiene `playable = true`.
- [ ] Con la publishable key, `GET /rest/v1/games` y `GET /rest/v1/scores` responden `200`.
- [ ] Con la publishable key, un `POST /rest/v1/scores` válido para `rocas` se acepta y los siguientes se rechazan: juego no jugable, juego inexistente, `player_name` vacío o de más de 10 caracteres, `score` `0`, negativo o mayor a `99999999`.
- [ ] Con la publishable key, `PATCH` y `DELETE` sobre `scores`, y cualquier escritura sobre `games`, no modifican ninguna fila.
- [ ] `get_advisors` de seguridad no reporta tablas sin RLS ni vistas con `security_definer` en `public`.
- [ ] `lib/supabase/database.types.ts` existe y los dos `createClient` están tipados con `Database`; `GET /api/health/supabase` sigue respondiendo `200 { "ok": true }`.
- [ ] `/games` y `/` muestran los 8 juegos leídos de la base, en el orden de `sort_order`, y los filtros por categoría siguen funcionando.
- [ ] `/games/rocas` muestra título y descripción de la base; `/games/no-existe` y `/games/no-existe/play` devuelven 404.
- [ ] Con la base sin puntajes, `GameCard` y `GameDetail` muestran `—` como mejor marca y `0` como partidas, el detalle muestra el estado vacío y el Salón de la Fama muestra "AÚN NO HAY PUNTAJES. SÉ EL PRIMERO" en cada pestaña.
- [ ] En `/games/rocas/play`, perder la partida y pulsar "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'rocas'`, el nombre escrito en mayúsculas y el puntaje final, y el modal muestra "PUNTUACIÓN GUARDADA".
- [ ] Tras guardar, `/games/rocas` y `/hall-of-fame` (pestaña ROCAS) muestran ese puntaje, y `GameCard` y `GameDetail` muestran `best` igual al máximo y `plays` igual a la cantidad de filas.
- [ ] Si Supabase rechaza el insert (por ejemplo, sin red), el modal muestra el mensaje de error genérico, no el texto crudo del SDK, y permite reintentar.
- [ ] El botón "GUARDAR PUNTUACIÓN" está deshabilitado con el nombre vacío o el puntaje en `0`.
- [ ] En un juego con `playable = false` (por ejemplo `/games/caida/play`) el modal de fin de juego no ofrece guardar en el ranking y no se crea ninguna fila en `scores`.
- [ ] Con un solo puntaje guardado, el podio muestra a ese jugador como campeón y `—` en los rangos 2 y 3, sin errores en consola.
- [ ] Con sesión iniciada y un puntaje guardado con el mismo nombre, "TU MEJOR MARCA" muestra el mejor puntaje de ese nombre y su rango; sin sesión o sin puntajes con ese nombre, la fila no aparece.
- [ ] El desempate entre puntajes iguales ordena primero al más antiguo.
- [ ] No quedan referencias a `GAMES`, `seededScores`, `PLAYERS` ni `av_scores` en `app/`, `components/` ni `lib/` (`rg` sin resultados).
- [ ] `lib/session-context.tsx`, `components/nav/` y `resources/started-games/` no tienen cambios en `git diff`.
- [ ] `package.json` no cambió: la spec no agrega dependencias.
- [ ] La `service_role` key no aparece en ningún archivo del repo ni en variables `NEXT_PUBLIC_*`.
- [ ] La consola del navegador no muestra errores ni warnings de React al recorrer biblioteca, detalle, reproductor y Salón de la Fama.
- [ ] `npm run lint` termina sin errores.

---

## Decisions taken and discarded

**Tomadas:**

- **Una sola spec para `games` y `scores`.** Es grande, pero el leaderboard no existe sin `games` (FK) y cada paso del plan deja la app funcionando. Se cuida el tamaño con un plan de 12 pasos commiteables.
- **`games` en la base como fuente de verdad, `id` text slug como PK.** Las rutas ya usan el slug (`/games/rocas`), así que no hace falta un `uuid` ni una columna de mapeo. A cambio, renombrar un juego implica migrar la FK.
- **`best` y `plays` derivados vía vista.** Evita columnas que se desincronicen del leaderboard real. Se paga una vista y un join, irrelevante a esta escala.
- **"Partidas" = puntajes guardados.** Es una aproximación honesta: solo se cuenta lo que alguien decidió guardar. Un contador real de partidas iniciadas requiere un write por cada inicio y queda para otra spec.
- **`games.playable` como regla de RLS, no solo de UI.** La política de insert de `scores` exige `playable`. Si la restricción viviera solo en el modal, cualquiera podría llenar el ranking de los 7 juegos con arena falsa llamando a la API directamente.
- **Insert directo desde el browser con RLS** en vez de un Route Handler. Menos código y reutiliza el cliente de la Spec 04, a costa de que la validación sea solo de forma (CHECK + política). Un `POST /api/scores` es la evolución natural cuando se quiera validar más.
- **Puntajes inmutables.** Sin políticas de `update`/`delete`: lo que se guardó queda. La moderación es manual por SQL hasta que haya auth.
- **`score > 0`** en el CHECK y en el botón: un puntaje cero no aporta nada al ranking.
- **Tope de `99999999`** como defensa mínima contra valores absurdos, no como anti-trampa: no impide un `5000000` falso.
- **Sin seed de puntajes demo.** La pantalla vacía es menos linda, pero un ranking con datos inventados mezclados con los reales no se puede distinguir después. La base empieza vacía y los estados vacíos son parte del diseño.
- **"TU MEJOR MARCA" por coincidencia de nombre.** Consistente con no tener auth. Se acepta que otra persona pueda escribir el mismo nombre; se arregla con `user_id` cuando llegue la auth.
- **Vistas `security_invoker`** en vez del `security_definer` por defecto, para que RLS aplique a quien consulta y no a quien creó la vista.
- **Rank con `row_number()`** y desempate por antigüedad: rangos únicos y estables, sin empates que compliquen el podio.
- **Páginas como Server Components que pasan `games` por props** a `Library` y `Home` (que son Client Components por sus filtros y animaciones). Una sola lectura por request, sin `useEffect` + spinner para el catálogo. Efecto colateral: leer `cookies()` vuelve dinámico el render, lo cual es aceptable aquí.
- **SQL de migraciones también en `supabase/migrations/`.** El MCP aplica la migración pero el repo no registraría el esquema de otro modo.
- **`av_scores` se abandona sin migrar.** Eran puntajes de un único navegador, jugados contra un reproductor de mentira para 7 de 8 juegos y contra ROCAS solo desde la Spec 05.

**Descartadas:**

- **Dos specs (06 `games`, 07 `leaderboard`):** más prolijo, pero la primera no cambiaría nada visible.
- **Dejar la UI con `lib/games.ts` y usar `games` solo como FK:** dos fuentes de verdad que habría que mantener sincronizadas a mano.
- **Columnas estáticas `best` / `plays` sembradas del mock:** datos falsos que contradicen al leaderboard real.
- **Contador `plays` con RPC al iniciar partida:** agrega superficie de abuso y una pieza que nadie pidió.
- **Seed de puntajes demo con columna `is_demo`:** complejidad extra para maquillar un estado vacío.
- **Todos los juegos guardan puntajes:** el ranking de 7 juegos se llenaría de números aleatorios de `setInterval` desde el primer día.
- **Auth dentro de esta spec:** suma un cuarto dominio (games, scores, UI y auth) y reemplaza `session-context`; va en su propia spec.
- **Validación fuerte (cotas por juego, duración mínima, replay):** complejidad alta para un portal sin premios; el riesgo queda documentado.
- **Quitar la fila "TU MEJOR MARCA":** más seguro pero deja la pantalla sin una de sus funciones visibles; se prefiere mantenerla con la limitación documentada.

---

## Identified risks

| Riesgo | Mitigación |
| --- | --- |
| El puntaje se calcula en el cliente: cualquiera puede insertar un valor falso en un juego `playable` con la publishable key | Aceptado y documentado. Mitigaciones mínimas: CHECK de rango, solo juegos `playable`, puntajes inmutables. La evolución es `POST /api/scores` con validación o un `user_id` con auth. |
| Spam o relleno del ranking con muchos inserts anónimos | Sin rate limiting en esta spec. Se detecta con `execute_sql`; la limpieza es manual por SQL. Queda como motivo para la spec de endpoint validado. |
| Nombres ofensivos o suplantación de otro jugador (mismo `player_name`) | Sin moderación ni auth. Se acepta; se corrige con `user_id` y, si hace falta, un filtro. Limitación explícita de "TU MEJOR MARCA". |
| Una vista sin `security_invoker` saltearía RLS | Las vistas se crean con `security_invoker = true` y el criterio de aceptación sobre `get_advisors` lo verifica. |
| Tras guardar un puntaje, el Salón de la Fama o el detalle no lo muestran por caché de render | Verificar el comportamiento en la guía de Next.js 16; el criterio "tras guardar, aparece en `/hall-of-fame`" lo cubre. Si hace falta, `revalidatePath` o render dinámico explícito. |
| Si Supabase está caído, biblioteca y home dejan de renderizar (antes eran datos locales) | La capa de datos lanza un `Error` genérico y el `error.tsx` de la ruta lo muestra sin detalles internos. Es un cambio de disponibilidad aceptado al hacer la base la fuente de verdad. |
| Desfase entre el seed y `lib/games.ts` (typos en `id`, `cover` o `color`) rompe rutas o estilos | El paso 2 copia los valores del arreglo actual tal cual y el criterio de aceptación exige los mismos 8 `id`. `cover` y `color` tienen CHECK / clases CSS existentes. |
| Los tipos generados quedan viejos si el esquema cambia | Se regeneran con `generate_typescript_types` en cada spec que toque el esquema. Hoy es un archivo único y versionado. |
| El nombre del modal tiene `slice(0, 10)` y mayúsculas solo en el cliente | El CHECK de la base valida largo y no vacío; mayúsculas es una convención de UI, no una regla de datos. |

---

## What is **not** in this spec

- Autenticación, `user_id` ni reemplazo de `lib/session-context.tsx`.
- Anti-trampa real, rate limiting ni moderación de nombres.
- Endpoint `POST /api/scores`; el insert es directo con RLS.
- Migrar puntajes viejos de `localStorage["av_scores"]`.
- Datos demo o seed de puntajes.
- Motores reales para los otros 7 juegos.
- Contador real de partidas iniciadas.
- Paginación, filtros por fecha, realtime, perfil de jugador.
- Administración de juegos desde la UI.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propia spec.
