# SPEC 23 — Seguridad: todo (base de datos + aplicación)

> **Status:** Approved
> **Depends on:** SPEC 06 (games-table-and-leaderboard), SPEC 19 (supabase-auth), SPEC 20 (oauth-google-github), SPEC 21 (security-hardening), SPEC 22 (route-protection)
> **Date:** 2026-10-13
> **Objective:** Cerrar los hallazgos nuevos de la auditoría `todo` del `security-auditor`: el drift entre las migraciones aplicadas y las del repo, los privilegios de `anon`/`authenticated` que la RLS no filtra (TRUNCATE, TRIGGER, REFERENCES, DML sobre vistas, columnas `id`/`created_at` de `scores`) y la versión de Next.js con advisories conocidos.

---

## Por qué existe esta spec

Auditoría del 2026-10-13 sobre la base (advisors, RLS, `pg_policies`, funciones, grants, constraints, drift, probes por rol) y la app (Server Actions, route handlers, proxy, cookies, secretos, headers, `npm audit`). Lo que ya estaba bien (RLS, policies, funciones `SECURITY DEFINER`, headers, cookies HttpOnly, redirects fijos) se lista en *Criterios* como regresión. Hallazgos nuevos:

### H1 — ALTO: drift entre las migraciones aplicadas y `supabase/migrations/`

`list_migrations` contra `eza supabase/migrations/`:

| Versión remota | Nombre | En el repo |
| -------------- | ------ | ---------- |
| `20261005191202` | `make_caida_playable` | **No** |
| `20261005191858` | `add_tetris_and_restore_caida` | **No** |
| `20261005192029` | `remove_tetris_pending_spec` | **No** |
| `20261014012432` | `allow_oauth_profiles` | **Con otra versión:** `20261014012422_allow_oauth_profiles.sql` |

- Las tres primeras son migraciones de datos que se anulan entre sí (`caida` pasa a `playable` y vuelve; `tetris` se inserta y se borra). Su SQL está en `supabase_migrations.schema_migrations.statements` y se copia tal cual en el *Modelo de datos*.
- `allow_oauth_profiles` tiene el **mismo SQL** en las dos versiones (comparado con `select statements from supabase_migrations.schema_migrations where version = '20261014012432'`); solo cambia el timestamp por 10 segundos.
- El schema final que sale de reproducir el repo es equivalente, pero el historial no: `supabase db push` vería `20261014012422` como pendiente y lo volvería a correr (`create policy` falla por duplicada), y tres versiones remotas no tienen archivo. Un deploy o un entorno nuevo no puede confiar en el historial.

### H2 — MEDIO: privilegios de `anon`/`authenticated` que la RLS no filtra

```sql
select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated') group by 1, 2;
```

| Tabla / vista | Privilegios de `anon` y `authenticated` |
| ------------- | --------------------------------------- |
| `games`, `profiles` | `REFERENCES, SELECT, TRIGGER, TRUNCATE` |
| `scores` | `INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE` |
| `games_with_stats`, `scores_ranked` | `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` |

- `has_table_privilege('anon', 'public.scores', 'TRUNCATE')` → `true`; lo mismo en `games` y `profiles`.
- **`TRUNCATE` no pasa por la RLS** (Postgres no aplica policies a `TRUNCATE`). Hoy no es explotable: PostgREST no expone `TRUNCATE`, `pg_graphql` no está instalado y `anon` no puede abrir una conexión SQL. Pero la migración `20261005171216_create_games_and_scores.sql:27-29` dice *"Defense in depth: no write grants beyond what the policies allow"* y revoca solo `insert, update, delete`: la intención quedó a medias. Cualquier camino futuro que ejecute SQL como `anon` (una RPC mal escrita, una extensión) vaciaría las tablas sin pasar por las policies.
- Las dos vistas no son actualizables (`information_schema.views.is_insertable_into = NO`), así que el DML falla igual; los grants son ruido que oculta lo que realmente se permite.
- `pg_default_acl` del schema `public` da `arwdDxtm` a `anon`/`authenticated` en toda tabla nueva: el próximo juego o tabla vuelve a traer `TRUNCATE`.

### H3 — BAJO (va en la misma migración que H2): un invitado puede fijar `scores.created_at` y `scores.id`

`information_schema.column_privileges` muestra `INSERT` de `anon` y `authenticated` sobre **todas** las columnas de `scores`, incluidas `id` y `created_at`. `scores_ranked` desempata por `created_at asc` (`20261013211157_link_scores_to_users.sql:40`). Probe (con rollback):

```sql
-- as anon
insert into public.scores (game_id, player_name, score, created_at)
values ('snake', 'PROBE', (select max(score) from public.scores where game_id = 'snake'), '2000-01-01T00:00:00Z');
-- → ACCEPTED, created_at = 2000-01-01, rank = 1 en scores_ranked
```

Un invitado que empata el récord queda primero y muestra una fecha falsa en el Salón de la Fama. Es menor que la trampa ya aceptada en la SPEC 06 (el puntaje lo calcula el cliente), pero la app nunca manda `id` ni `created_at` (`app/games/[id]/play/actions.ts:34` y `:48`), así que cerrarlo no cuesta nada.

### H4 — MEDIO: `next@16.3.6` con advisories conocidos

`npm audit --omit=dev`:

| Paquete | Severidad | Advisories | Arreglo |
| ------- | --------- | ---------- | ------- |
| `next` 16.3.6 (directo) | high | GHSA-cjq9-62q9-8jv4 (SSRF en Image Optimization), GHSA-mcj8-r9mp-w47p y GHSA-4jqv-mc3x-m676 (cache poisoning SSG/ISR), GHSA-f87g-xv8r-7p7x, GHSA-3w37-wq28-93x7, GHSA-39w2-rjm5-chcv (low, MCP del dev server) | `next@16.4.0` (minor) |
| `sharp` 0.35.4 (vía `next`) | high | GHSA-wq5f-xc86-pv6w (librsvg) | sale con `next` 16.4.0 / `npm audit fix` |
| `source-map-js` 1.2.1 (vía `postcss` de `next`) | high | GHSA-68fv-2mgg-jv7q (DoS) | sale con `npm audit fix` |

La app no usa `next/image` ni `images` en `next.config.ts`, ni `use cache`/ISR explícito (`rg` sin resultados), así que la aplicabilidad real de los highs no está confirmada; pero `/_next/image` existe igual, las páginas estáticas se prerenderizan por defecto, y es un parche minor. **Tiene que estar resuelto antes de cualquier deploy.**

---

## Alcance

**Dentro:**

- **Historial de migraciones alineado** con el remoto: los tres archivos faltantes con su SQL exacto, y `allow_oauth_profiles` renombrado a la versión remota. **No** se aplica nada: ya está aplicado.
- **Migración `restrict_api_role_privileges`:**
  - revoca `TRUNCATE`, `TRIGGER` y `REFERENCES` de `anon`/`authenticated` en `games`, `scores` y `profiles`;
  - deja solo `SELECT` en `games_with_stats` y `scores_ranked`;
  - en `scores`, `INSERT` solo sobre `game_id, player_name, score, user_id`;
  - cambia los default privileges de `postgres` en `public` para que las tablas nuevas no traigan `TRUNCATE`/`TRIGGER`/`REFERENCES`.
- **Actualizar `next` y `eslint-config-next` a 16.4.0** (paso **manual**: este agente no corre `npm install`).

**Fuera de alcance:**

- Los riesgos aceptados, sin cambios:
  - leaked password protection apagada (SPEC 21 D7);
  - rate limit de Auth global en la práctica (SPEC 21 D6);
  - pre-account takeover por linking automático sin confirmación de email (SPEC 20, SPEC 21 D8);
  - sin Content-Security-Policy (SPEC 21 D1).
- Anti-trampa del puntaje y spam de scores (aceptados en la SPEC 06).
- Rate limit o captcha en `/api/contact` (aceptado en la SPEC 03).
- Migrar de npm a pnpm y fijar los rangos `^` de las devDependencies (`BAJO`, va en su propio spec).
- Borrar o recrear el historial remoto (`supabase migration repair`).

---

## Modelo de datos

Esta spec no agrega tablas, columnas ni tipos. **No** se regenera `lib/supabase/database.types.ts`.

### Historial — archivos que faltan (NO se aplican)

`supabase/migrations/20261005191202_make_caida_playable.sql`:

```sql
update public.games
   set playable = true
 where id = 'caida';
```

`supabase/migrations/20261005191858_add_tetris_and_restore_caida.sql`:

```sql
-- CAÍDA goes back to its placeholder state: Tetris is a separate game, not a replacement.
update public.games
   set playable = false
 where id = 'caida';

insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order) values
('tetris', 'TETRIS', 'Encaja las piezas y limpia líneas sin tocar el techo.', 'Siete piezas clásicas y una tuerca traicionera caen sin pausa. Muévelas, rótalas y limpia líneas para subir de nivel: la velocidad aumenta cada 10 líneas. La pieza fantasma te muestra dónde aterrizará.', 'PUZZLE', 'cover-tetris', 'cyan', true, 9);
```

`supabase/migrations/20261005192029_remove_tetris_pending_spec.sql`:

```sql
-- Tetris is re-added later through its own spec; until then it must not exist as playable without an engine.
delete from public.games where id = 'tetris';
```

`supabase/migrations/20261014012422_allow_oauth_profiles.sql` → se renombra a `20261014012432_allow_oauth_profiles.sql`, **sin tocar su contenido**.

Reproducido en orden, el repo sigue dando el mismo estado: `seed_games` crea `caida`, estas tres lo togglean y crean/borran `tetris`, `add_tetris_game` lo vuelve a crear y `remove_placeholder_games` borra `caida`.

### Migración — `supabase/migrations/<YYYYMMDDHHMMSS>_restrict_api_role_privileges.sql`

```sql
-- RLS never applies to TRUNCATE, and the API roles never need TRIGGER or
-- REFERENCES. create_games_and_scores only revoked insert/update/delete, so
-- Supabase's default grants left these in place. Policies must be the only
-- write path (spec 23).
revoke truncate, trigger, references
  on public.games, public.scores, public.profiles
  from anon, authenticated;

-- Both views aggregate or rank, so they are read-only anyway: keep only SELECT.
revoke insert, update, delete, truncate, trigger, references
  on public.games_with_stats, public.scores_ranked
  from anon, authenticated;

-- Scores: callers set only what the policies check. id and created_at always
-- come from their defaults, so nobody can backdate a row to win a tie.
revoke insert on public.scores from anon, authenticated;
grant insert (game_id, player_name, score, user_id) on public.scores to anon, authenticated;

-- New public tables created by migrations (role postgres) stop inheriting
-- TRUNCATE/TRIGGER/REFERENCES for the API roles.
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;
```

- `service_role` y `postgres` no cambian.
- `profiles` ya tiene `insert (id, username)` para `authenticated` (SPEC 20): no se toca.
- La app no cambia: `saveScore` inserta solo `game_id`, `player_name`, `score` y `user_id`, y supabase-js usa `return=minimal` (no necesita más que `SELECT`, que se mantiene).

---

## Plan de implementación

1. **Historial de migraciones** (solo archivos, sin `apply_migration`):
   - crear los tres archivos faltantes con el SQL de arriba;
   - renombrar `20261014012422_allow_oauth_profiles.sql` a `20261014012432_allow_oauth_profiles.sql`.

   Verificación: los prefijos de `eza supabase/migrations/` coinciden uno a uno con las versiones de `list_migrations`; `git diff -M` muestra el rename al 100% de similitud.
2. **Migración `restrict_api_role_privileges`:** se escribe el archivo y se aplica con `apply_migration`, con el mismo SQL. Probes (un bloque `DO` que termina en `raise exception 'probe ok: …'`):
   - `has_table_privilege` de `anon` y `authenticated` sobre `games`, `scores`, `profiles` para `TRUNCATE`, `TRIGGER` y `REFERENCES` → `false`;
   - `has_table_privilege` sobre `games_with_stats` y `scores_ranked` para `INSERT`/`UPDATE`/`DELETE` → `false`, y `SELECT` → `true`;
   - `anon` inserta un score con `created_at = '2000-01-01'` → rechazado (`42501`);
   - `anon` inserta un score con `id` explícito → rechazado (`42501`);
   - todos los probes de RLS de abajo, con su resultado esperado;
   - `create table public.spec23_probe (id int)` → `has_table_privilege('anon', 'public.spec23_probe', 'TRUNCATE')` → `false` (default privileges).

   Después: `get_advisors` de seguridad = solo `auth_leaked_password_protection`. Si el camino feliz de un score falla, frenar: se rompió el juego.
3. **Next.js 16.4.0 (manual, la persona):**

   > **Este proyecto usa npm.** npm no soporta `min-version-age`, lo que lo expone a paquetes maliciosos inyectados en el periodo inmediato a su publicación. Se recomienda migrar a pnpm.

   - `npm info next@16.4.0 time` y `npm info eslint-config-next@16.4.0 time`: publicados hace más de 1 día;
   - `npm install next@16.4.0 eslint-config-next@16.4.0 --save-exact`;
   - `npm audit fix` (sin `--force`) para `sharp` y `source-map-js` si quedan;
   - leer las notas de 16.4.0 y la guía de `node_modules/next/dist/docs/` por cambios en `proxy.ts`/headers.

   Verificación: `npm audit --omit=dev --audit-level=moderate` sin vulnerabilidades; `npm run lint` sin errores; `curl -sI localhost:3000/` sigue con los cinco headers.

---

## Criterios de aceptación

**Historial**

- [ ] Cada versión de `list_migrations` tiene un archivo `supabase/migrations/<versión>_<nombre>.sql` y viceversa (17 + la nueva = 18).
- [ ] `20261014012432_allow_oauth_profiles.sql` tiene el mismo contenido que el archivo anterior.

**Base**

- [ ] `get_advisors` de seguridad: solo `auth_leaked_password_protection`.
- [ ] `relrowsecurity = true` en `games`, `scores` y `profiles`; `games_with_stats` y `scores_ranked` con `security_invoker=true`.
- [ ] `role_table_grants` de `anon`/`authenticated`: `games`, `profiles` → solo `SELECT`; `scores` → `SELECT` (+ `INSERT` por columna en `game_id, player_name, score, user_id`); las dos vistas → solo `SELECT`.
- [ ] Sin policies de `UPDATE` ni `DELETE`; `handle_new_user` y `rls_auto_enable` con `EXECUTE` revocado a `anon`/`authenticated`.
- [ ] Probes (con rollback):
  - `anon` + `user_id` de otro → rechazado;
  - `anon` + `player_name` = username registrado (exacto y `' dejuata '`) → rechazado;
  - `authenticated` + otro `user_id`, otro `player_name`, `user_id` null, o sin profile → rechazado;
  - score en juego no `playable` o inexistente (anon y authenticated) → rechazado;
  - segundo profile (`23505`), profile con otro `id`, profile como `anon` → rechazado;
  - `update`/`delete` sobre `scores`, `profiles` y `games` → rechazado (`42501`);
  - `anon` con `created_at` o `id` explícito → rechazado;
  - camino feliz: score de invitado y score de `authenticated` con su username → aceptados; profile propio de `authenticated` → pasa la RLS.
- [ ] Una tabla nueva creada dentro de un probe no da `TRUNCATE` a `anon`.

**App (regresión)**

- [ ] Jugar y guardar un score como invitado y logueado.
- [ ] Login con email, Google y GitHub; un usuario OAuth nuevo termina en `/login/nombre` y puede elegir nombre.
- [ ] El Salón de la Fama muestra "mi mejor" para el usuario logueado.
- [ ] `curl -sI` a `/`, `/games/snake/play`, `/api/health/supabase` y un asset de `/_next/static/` → los cinco headers de la SPEC 21 y sin `X-Powered-By`.
- [ ] `npm audit --omit=dev --audit-level=moderate` sin vulnerabilidades.
- [ ] `npm run lint` sin errores.

---

## Decisiones

- **D1 — Sí: alinear el repo con el remoto (agregar los tres archivos y renombrar uno).** El remoto es la verdad aplicada y su SQL está guardado, así que copiarlo es exacto y no toca la base. **No:** `supabase migration repair` para borrar las versiones remotas, porque reescribe el historial aplicado y necesita la CLI con credenciales. **No:** dejarlo documentado, porque el próximo `db push` falla.
- **D2 — Sí: revocar `TRUNCATE`, `TRIGGER` y `REFERENCES` aunque hoy no sean alcanzables.** Completa la intención de `create_games_and_scores` y deja a las policies como el único camino de escritura. **No:** confiar en que PostgREST no expone `TRUNCATE`, porque es una propiedad del transporte, no de la base.
- **D3 — Sí: `INSERT` por columna en `scores`.** Es el mismo patrón que `profiles` (SPEC 20) y la app no manda otras columnas. **No:** un trigger que pise `created_at` con `now()`, que es más código y otra función para mantener. **No:** un `check (created_at <= now())`, que no impide backdatear.
- **D4 — Sí: cambiar los default privileges de `postgres` en `public`.** Las tablas nuevas de las migraciones nacen sin `TRUNCATE`/`TRIGGER`/`REFERENCES`. **No:** acordarse de revocar en cada migración, que es justo lo que falló. **No:** tocar los default privileges de `supabase_admin`, que no son nuestros.
- **D5 — Sí: la actualización de Next es un paso manual.** Este agente no corre `npm install` y la regla del proyecto exige verificar la fecha de publicación. **No:** `npm audit fix --force`, que puede saltar a versiones no revisadas.
- **D6 — Sí: H3 entra en esta spec aunque sea `BAJO`.** Va en la misma migración que H2 y no cambia la app. **No:** una spec aparte para un `grant`.

---

## Riesgos identificados

| Riesgo | Mitigación |
| ------ | ---------- |
| Revocar `INSERT` de tabla en `scores` rompe el guardado si supabase-js o PostgREST mandan alguna columna más. | Probe del camino feliz como `anon` y `authenticated` dentro de la migración, y criterio manual de jugar y guardar en los dos modos. |
| `alter default privileges` no cubre tablas creadas desde el Table Editor por otro rol. | `ensure_rls` sigue activando RLS en toda tabla nueva; los grants se revisan en cada auditoría. |
| Next 16.4.0 trae cambios que afectan `proxy.ts` o los headers. | Leer las notas y la doc versionada; criterios de headers, redirects y lint. |
| Los highs de Next no aplican a esta app y el upgrade se posterga. | Queda como bloqueante de deploy en esta spec. |
| Renombrar una migración ya mergeada confunde a otra rama abierta. | Hoy no hay ramas abiertas que toquen `supabase/migrations/` (rama `main`); el rename va en su propio commit. |

---

## Lo que **no** entra en esta spec

- Content-Security-Policy, confirmación de email / linking, CAPTCHA o limitador por IP, leaked password protection (riesgos aceptados de las SPEC 20 y 21).
- Anti-trampa de puntajes y rate limit de inserts de scores (SPEC 06).
- Rate limit o captcha de `/api/contact` (SPEC 03).
- Migración a pnpm y pins exactos de devDependencies.
- Reescribir el historial remoto de migraciones.

Cada uno de estos, si se hace, va en su propio spec.
