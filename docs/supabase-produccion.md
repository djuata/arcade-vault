# Supabase: de DEV a PRODUCCIÓN

Runbook para dejar el proyecto Supabase de **producción** igual que **DEV** (estructura, catálogo y configuración). Lo ejecuta una persona: **el MCP de Supabase (`.mcp.json`) apunta solo a DEV** y las credenciales de PROD nunca entran al repo ni a una conversación con un agente.

- **Qué viaja**: las 18 migraciones de `supabase/migrations/` (tablas, vistas, RLS, grants, trigger de profiles y el catálogo de 6 juegos, que se siembra en las propias migraciones).
- **Qué NO viaja**: usuarios, profiles y scores de DEV (son datos de prueba). PROD arranca con el leaderboard vacío.
- **Qué se configura a mano**: todo lo de Auth del dashboard y las variables de entorno del hosting.

## 1. Base de datos

1. **Connection string** — Dashboard PROD → *Connect* → *Session pooler* (puerto 5432). Exportalo **solo en tu terminal**, nunca en un `.env` del repo (si la password tiene caracteres especiales, va percent-encoded):

   ```bash
   export PROD_DB_URL='postgresql://postgres.<prod-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
   ```

2. **Auto-enable RLS** — DEV tiene el event trigger `ensure_rls` que agrega la opción "auto-enable RLS" del dashboard; PROD se creó sin ella, y la migración `20261014021043_restrict_rls_auto_enable` falla si la función no existe. SQL Editor de PROD → pegá y corré **`supabase/prod/00_rls_auto_enable.sql`** (idempotente).
   - Si el `create event trigger` diera error de permisos: dejá creada igual la función (es lo que necesita la migración). PROD quedaría sin auto-RLS, pero cada migración ya hace `enable row level security` explícito.

3. **Dry run** — tiene que listar las 18 migraciones, de `20261005171216_create_games_and_scores` a `20261014025130_restrict_api_role_privileges`:

   ```bash
   supabase db push --db-url "$PROD_DB_URL" --dry-run
   ```

4. **Aplicar** — usamos `--db-url` y **no** `supabase link`, para no dejar el ref de PROD en `supabase/.temp/`:

   ```bash
   supabase db push --db-url "$PROD_DB_URL"
   ```

5. **Verificar** — SQL Editor de PROD → corré **`supabase/prod/99_verify.sql`**. Todas las filas con `ok = true`.
6. **Advisors** — Dashboard PROD → *Advisors → Security*. El único aviso esperado es `auth_leaked_password_protection` (plan Free, riesgo aceptado).
7. `unset PROD_DB_URL`

## 2. Auth (dashboard de PROD)

Nada de esto vive en migraciones; replicá lo de DEV (`CLAUDE.md` → *Session*):

| Dónde | Valor |
| ----- | ----- |
| *Authentication → Sign In / Providers → Email* | Habilitado. **Confirm email: OFF** (igual que DEV — ver *Bloqueantes*) |
| *Email → Password* | Mínimo 8 caracteres; requisitos **lower + upper + digit + symbol** (espejo de `passwordSchema` en `lib/auth/schemas.ts`) |
| *Rate limits* | Sign-ups y sign-ins: **30 cada 5 min** |
| *URL Configuration → Site URL* | `https://<dominio-prod>` |
| *URL Configuration → Redirect URLs* | `https://<dominio-prod>/auth/callback` — `signInWithOAuth` arma el `redirectTo` con el `origin` de la request (`app/login/actions.ts`), y Supabase lo rechaza si no está en la lista |
| *Providers → Google* y *GitHub* | **OAuth apps nuevas para PROD** (no reutilizar las de localhost). Callback en la consola del proveedor: `https://<prod-ref>.supabase.co/auth/v1/callback`. Client ID y secret solo en el dashboard |
| *Automatic identity linking* | ON (igual que DEV) |

## 3. Variables de entorno de la app (en el hosting, no en el repo)

| Variable | Valor |
| -------- | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<prod-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | La **publishable** key de PROD (nunca la secret / service_role) |
| `RESEND_API_KEY` | Key de Resend (server-only) |
| `CONTACT_TO_EMAIL` | Casilla que recibe el formulario de `/about` |
| `CONTACT_FROM_EMAIL` | Remitente de un **dominio verificado** en Resend (`onboarding@resend.dev` solo sirve para testing) |

## 4. Smoke test

Con la app apuntando a PROD:

- `curl https://<dominio-prod>/api/health/supabase` → `{ "ok": true }`
- `/games` muestra los 6 juegos.
- Jugar como invitado y guardar score → aparece en el detalle del juego.
- Sign-up con email + password → se crea el profile (trigger `on_auth_user_created`).
- Login con Google y GitHub → `/login/nombre` → elegir nombre → `/games`.
- Score logueado → se guarda con el username.

## 5. Migraciones futuras

1. Se aplican primero en **DEV** con el MCP `apply_migration` (como siempre) y se commitea el archivo con la versión que asignó DEV.
2. Una persona corre en PROD `supabase db push --db-url "$PROD_DB_URL"` (antes con `--dry-run`).
3. Si la migración cambia catálogo, policies o grants, actualizá los valores esperados en `supabase/prod/99_verify.sql` (y el conteo de migraciones).
4. `lib/supabase/database.types.ts` se sigue generando desde DEV: el schema es el mismo.

## Bloqueantes antes de abrir PROD al público

Ya están documentados en `CLAUDE.md`; este runbook no los resuelve:

- **Pre-account takeover**: confirm email OFF + identity linking ON. Hay que prender la confirmación de email o apagar el linking. Prender la confirmación cambia el flujo de `signUp` (hoy `!data.session` → error genérico), así que va en su propio spec.
- **Rate limit de auth efectivamente global**: Supabase ve la IP del server de Next. Hace falta CAPTCHA o un limiter por cliente.
- **Sin CSP** (requiere nonces en el proxy).
