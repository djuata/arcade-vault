# SPEC 20 — Login con Google y GitHub (OAuth)

> **Status:** Approved
> **Depends on:** SPEC 19 (supabase-auth)
> **Date:** 2026-10-13
> **Objective:** Permitir entrar con Google o GitHub sobre la auth de la SPEC 19. Quien entra por OAuth sin profile pasa por la pantalla obligatoria "ELIGE TU NOMBRE" antes de usar el sitio con sesión.

---

## Por qué existe esta spec

La SPEC 19 dejó la auth con email + contraseña y separó OAuth en esta spec (D2 de la 19). Estado del código el 2026-10-13:

1. **Un alta por OAuth hoy falla.** `handle_new_user()` (`supabase/migrations/20261013210622_create_profiles.sql`) inserta `upper(btrim(raw_user_meta_data->>'username'))` en `profiles.username`, que es `NOT NULL`. Google y GitHub no mandan `username`, así que el trigger aborta y el usuario no se crea.
2. **Nadie más que el trigger puede escribir en `profiles`.** Tiene `revoke insert, update, delete` para `anon` y `authenticated`. No hay forma de crear el profile después del alta.
3. **Los botones GOOGLE / GITHUB se ocultaron** en `components/auth/Auth.tsx` (D14 de la 19). El CSS sigue en `app/globals.css`: `.auth-divider` y `.social`, con 44px de alto en mobile.
4. **No existe una ruta de callback OAuth.** El intercambio `code` → sesión (PKCE) necesita un route handler.
5. **Ya está decidido (D11 de la 19):** quien entra por OAuth sin profile va a una pantalla obligatoria "ELIGE TU NOMBRE" y solo puede salir de ella cerrando sesión.

---

## Alcance

**Dentro:**

- **Providers Google y GitHub** en Supabase Auth, con flujo PKCE server-side:
  - una Server Action `signInWithOAuth` arranca el flujo;
  - un route handler `app/auth/callback/route.ts` intercambia el `code` por la sesión.
- **Configuración manual (dashboard), documentada como paso 1:**
  - crear la GitHub OAuth App y el OAuth client de Google Cloud;
  - pegar sus credenciales en Supabase → Auth → Providers;
  - en URL Configuration, poner `http://localhost:3000` como Site URL y `http://localhost:3000/auth/callback` en la lista de redirects.
  - **Solo localhost** en esta spec.
- **Migración `allow_oauth_profiles`:**
  - `handle_new_user()` no crea profile si no viene `username`, en vez de fallar;
  - `authenticated` puede insertar **solo su propia fila** en `profiles` (`id = auth.uid()`), y una sola vez, porque la PK lo garantiza.
  - Se mantiene la falta de grants de `update`/`delete`, así que el nombre no se puede cambiar.
- **Pantalla `/login/nombre` ("ELIGE TU NOMBRE"):**
  - input de username con una sugerencia sacada del provider (sanitizada y editable);
  - un botón para confirmar;
  - un botón **CERRAR SESIÓN**.
  - La Server Action `chooseUsername` inserta el profile y redirige a `/games`.
- **Bloqueo en `proxy.ts`:** una sesión **sin** profile se redirige a `/login/nombre` desde cualquier ruta, salvo `/login/nombre`, `/auth/*` y `/api/*`.
- **`/login` muestra de nuevo el separador "O CONTINÚA CON" y los botones GOOGLE / GITHUB**, debajo del form, en las dos pestañas.
- **Error de OAuth** (el usuario cancela, el provider falla o el `code` es inválido): se vuelve a `/login?error=oauth` con un mensaje genérico en español.
- **Linking automático de Supabase:** si el email del provider coincide con una cuenta existente, se suma la identidad al **mismo** usuario, que conserva su username y sus scores y no ve la pantalla de nombre.
- Después de un login OAuth exitoso con profile, se va **siempre a `/games`**.
- Se actualiza `CLAUDE.md` (secciones *Session* y *Data layer*, y la tabla de rutas).

**Fuera de alcance (specs futuras):**

- Redirect URLs y apps OAuth para un dominio de producción. Se agregan cuando haya deploy, siguiendo el mismo paso 1.
- Otros providers (Discord, Apple, etc.).
- Linking manual (`linkIdentity`) o desvincular providers desde una página de cuenta.
- Cambiar el username después de elegirlo. Va con la spec de página de cuenta.
- Avatar o nombre visible tomados del provider.
- Volver a la página de origen después del login (`?next=`).
- Limpiar usuarios OAuth que abandonaron la pantalla de nombre sin elegir.
- Confirmación de email y recuperación de contraseña, que siguen pendientes desde la 19 (ver *Riesgos*).

---

## Modelo de datos

### Migración — `supabase/migrations/<YYYYMMDDHHMMSS>_allow_oauth_profiles.sql`

```sql
-- OAuth sign-ups (Google/GitHub) carry no username: skip the profile and let
-- the player pick one on /login/nombre (spec 20). Email sign-ups still send it
-- and keep failing on the CHECK / unique index exactly as before.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := upper(btrim(new.raw_user_meta_data ->> 'username'));
begin
  if wanted is null or wanted = '' then
    return new;
  end if;

  insert into public.profiles (id, username) values (new.id, wanted);
  return new;
end;
$$;

-- A signed-in user without a profile creates exactly their own row, once (PK).
-- No update/delete grants: the username is permanent.
grant insert (id, username) on public.profiles to authenticated;

create policy "players create their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));
```

- `create or replace` conserva el owner y los privilegios, así que el `revoke execute` de la migración `restrict_handle_new_user` sigue vigente. Se verifica con los advisors.
- Las columnas no cambian, así que **no se regeneran** los tipos de `database.types.ts`.

### Configuración de OAuth (dashboard, no versionada)

El MCP de Supabase no expone la configuración de Auth. Callback del provider para los dos casos: `https://iruyduvdvikmohqaiwqp.supabase.co/auth/v1/callback`.

| Dónde | Qué |
| ----- | --- |
| GitHub → Settings → Developer settings → OAuth Apps → New | Homepage `http://localhost:3000`. Callback: la URL de arriba. Copiar el Client ID y generar un Client secret. |
| Google Cloud Console → APIs & Services | OAuth consent screen *External* en modo *Testing*, con tu cuenta como test user. Credentials → OAuth client ID → *Web application*: JS origin `http://localhost:3000` y redirect URI la URL de arriba. |
| Supabase → Authentication → Providers | Habilitar **Google** y **GitHub** y pegar el Client ID y el secret de cada uno. |
| Supabase → Authentication → URL Configuration | Site URL `http://localhost:3000`. En Redirect URLs, agregar `http://localhost:3000/auth/callback`. |

Los client secrets **nunca** van al repo, ni a `.env` ni a `.env.example`: viven solo en Supabase.

### App

```ts
// lib/auth/schemas.ts — usernameSchema is extracted from signUpSchema (same rule)
export const usernameSchema = z
  .string()
  .transform((v) => v.trim().toUpperCase())
  .pipe(z.string().regex(USERNAME_PATTERN).refine((v) => v !== RESERVED_USERNAME));

export const signUpSchema = signInSchema.extend({ username: usernameSchema });

export const oauthProviderSchema = z.enum(["google", "github"]);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;
```

```ts
// lib/auth/username.ts — pure, no I/O
// GitHub: user_metadata.user_name. Google: local part of user_metadata.email.
// Uppercase, drop everything outside A–Z 0–9 _, cut to 10.
// Returns null if the result is < 3 chars or is "INVITADO".
export function suggestUsername(metadata: Record<string, unknown>): string | null;
```

```ts
// app/login/actions.ts (new action)
// Validates provider with oauthProviderSchema. redirectTo = `${origin}/auth/callback`,
// origin from headers(). Supabase rejects any redirectTo outside its allow list.
// Success → redirect(data.url) (provider). Error → redirect("/login?error=oauth").
export async function signInWithOAuth(formData: FormData): Promise<void>;
```

```ts
// app/auth/callback/route.ts
// GET ?code=… → exchangeCodeForSession(code) (PKCE verifier from the HttpOnly cookie).
//   no code / provider error / exchange error → redirect /login?error=oauth
//   session without profile                   → redirect /login/nombre
//   session with profile                      → redirect /games
export async function GET(request: NextRequest): Promise<NextResponse>;
```

```ts
// app/login/nombre/actions.ts
// Requires a session without a profile (otherwise redirect: no session → /login,
// profile → /games). Zod usernameSchema → pre-check taken → insert { id: uid, username }.
// 23505 (race) → usernameTaken. Success → redirect("/games").
export async function chooseUsername(prev: AuthFormState, formData: FormData): Promise<AuthFormState>;
```

```ts
// lib/supabase/proxy.ts — after getClaims():
// claims && path not in /login/nombre, /auth/*, /api/* && no profile row
//   → NextResponse.redirect("/login/nombre"), copying the refreshed cookies.
export async function updateSession(request: NextRequest): Promise<NextResponse>;
```

**Mensajes nuevos (`lib/auth/messages.ts`):**

| Caso | Mensaje |
| ---- | ------- |
| OAuth cancelado o fallido (`?error=oauth`) | `NO PUDIMOS CONECTAR CON EL PROVEEDOR. INTENTA DE NUEVO` |

En "ELIGE TU NOMBRE" se reusan `invalidUsername`, `usernameTaken` y `generic`.

**Texto de la pantalla `/login/nombre`:**
- Título: `ELIGE TU NOMBRE`.
- Subtítulo: `ASÍ TE VERÁN EN LOS RANKINGS. NO SE PUEDE CAMBIAR DESPUÉS.`
- Botón principal: `CONFIRMAR NOMBRE`; mientras está pendiente, `GUARDANDO...`.
- Botón secundario: `CERRAR SESIÓN`.

---

## Plan de implementación

1. **Configurar OAuth (manual, dashboard):** los cuatro pasos de *Configuración de OAuth*.
   - Verificación: en Supabase → Providers se ven Google y GitHub como *Enabled*, y `http://localhost:3000/auth/callback` aparece en Redirect URLs.
   - El sitio sigue igual, porque todavía no hay botones.
2. **Migración `allow_oauth_profiles`:** se aplica con el MCP `apply_migration`. Probes SQL (en un bloque DO con `raise exception` al final, para que haga rollback):
   - un insert en `auth.users` **sin** `username` crea el usuario y **no** crea profile;
   - un insert con `{"username":"kai_01"}` sigue creando `KAI_01`, y uno con `ab` sigue fallando (sin regresión de la 19);
   - como `authenticated` con `sub` = U1 y sin profile: `insert into profiles (id, username)` con su id da OK;
   - lo mismo con el id de otro usuario: rechazado (42501);
   - un segundo insert para U1: rechazado (23505);
   - como `authenticated`, `update profiles set username = …`: rechazado (42501);
   - como `anon`, insert en `profiles`: rechazado.

   Después se corren los advisors de seguridad: `handle_new_user` no aparece como ejecutable.
3. **`lib/auth/schemas.ts`, `lib/auth/messages.ts` y `lib/auth/username.ts`:**
   - se extrae `usernameSchema` y se agregan `oauthProviderSchema` y `oauthFailed`;
   - se escribe `suggestUsername` (pura).

   `signUp` sigue igual: usa `signUpSchema`, que ahora compone `usernameSchema`.
4. **`signInWithOAuth` + `app/auth/callback/route.ts`:**
   - la action y el route handler descritos en *App*;
   - el callback lee `error` / `code`, hace el intercambio y consulta `profiles` para decidir el destino.
   - Verificación manual: `/auth/callback` sin `code` redirige a `/login?error=oauth`.
5. **`/login` con botones OAuth:**
   - En `Auth.tsx`, debajo del form, en las dos pestañas, va `<div className="auth-divider">O CONTINÚA CON</div>` y `<form action={signInWithOAuth} className="social">` con dos botones submit `name="provider"` (`value="google"` → `◆ GOOGLE`, `value="github"` → `◆ GITHUB`).
   - `app/login/page.tsx` lee `searchParams.error === "oauth"` y le pasa a `Auth` un prop `oauthError` que muestra `oauthFailed` con `role="alert"`.
   - Verificación: los dos flujos completan contra los providers reales. Un usuario nuevo termina en `/login/nombre`, que hasta el paso 6 devuelve 404.
6. **Pantalla `/login/nombre`:**
   - `app/login/nombre/page.tsx` (Server Component):
     - sin sesión → `/login`;
     - con profile → `/games`;
     - si no, calcula `suggestUsername(user_metadata)`. Si la sugerencia ya está tomada en `profiles`, no la usa.
   - `components/auth/ChooseUsername.tsx` (Client):
     - `useActionState(chooseUsername)` y un input `name="username"` con la sugerencia como `defaultValue`, `autoComplete="username"`, `minLength=3`, `maxLength=10` y `required`;
     - error con `role="alert"` y botón deshabilitado mientras `pending`;
     - **CERRAR SESIÓN** usa `useSession().logout`.
   - Reusa `.av-auth-wrap` / `.auth-card`.
   - `app/login/nombre/actions.ts` define `chooseUsername`.
7. **Bloqueo en el proxy:**
   - después de `getClaims()`, si hay `sub` y la ruta no está exenta, `updateSession` consulta `profiles` por id;
   - si no hay fila, redirige a `/login/nombre` y copia las cookies de la respuesta refrescada al redirect.
   - Verificación: con un usuario sin profile, escribir `/games`, `/hall-of-fame` o `/login` en la barra termina en `/login/nombre`, y `/api/health/supabase` sigue respondiendo `{ ok: true }`.
8. **`CLAUDE.md`:**
   - *Session* suma OAuth, `/auth/callback`, `/login/nombre`, el bloqueo en el proxy y el linking automático;
   - *Data layer* explica el trigger que saltea el profile sin username y la policy `players create their own profile`;
   - en la tabla de rutas se agregan `/login/nombre` y `GET /auth/callback`.

---

## Criterios de aceptación

**Login con provider**

- [ ] `/login` muestra "O CONTINÚA CON" y los botones GOOGLE y GITHUB debajo del form, en INICIAR SESIÓN y en CREAR CUENTA.
- [ ] A 375×667, los botones GOOGLE y GITHUB miden ≥ 44px de alto y no hay scroll horizontal.
- [ ] Un click en GITHUB lleva a github.com, y al autorizar se vuelve a `http://localhost:3000/auth/callback`. Lo mismo con GOOGLE y accounts.google.com.
- [ ] Cancelar en el provider, o abrir `/auth/callback` sin `code`, termina en `/login` con `NO PUDIMOS CONECTAR CON EL PROVEEDOR. INTENTA DE NUEVO`, sin texto en inglés ni detalles del provider.
- [ ] Un `provider` distinto de `google`/`github` enviado a la action no inicia ningún flujo y termina en `/login?error=oauth`.

**ELIGE TU NOMBRE**

- [ ] Un usuario nuevo por GitHub termina en `/login/nombre` con el input precargado con su login de GitHub sanitizado (por ejemplo `kai-dev` → `KAIDEV`).
- [ ] Un usuario nuevo por Google ve precargada la parte local de su email, sanitizada y cortada a 10.
- [ ] Si la sugerencia ya está tomada o queda con menos de 3 caracteres, el input aparece vacío.
- [ ] Confirmar un nombre válido y libre crea la fila en `profiles` con el `id` del usuario, redirige a `/games` y la Nav muestra `NOMBRE ▾`.
- [ ] Un nombre tomado muestra `ESE NOMBRE YA ESTÁ EN USO`. Un formato inválido (`ab`, `INVITADO`, `kai-01`) muestra `NOMBRE: 3 A 10 LETRAS, NÚMEROS O _`. En ningún caso se crea la fila.
- [ ] Con sesión y sin profile, escribir `/`, `/games`, `/games/snake/play`, `/hall-of-fame` o `/login` en la barra redirige a `/login/nombre`.
- [ ] **CERRAR SESIÓN** en `/login/nombre` termina en `/` sin sesión, con navegación completa.
- [ ] Con profile, entrar a `/login/nombre` redirige a `/games`. Sin sesión, redirige a `/login`.
- [ ] `curl localhost:3000/api/health/supabase` devuelve `{ ok: true }`.

**Linking y regresión**

- [ ] Un usuario de la SPEC 19 (email + contraseña) que entra con Google usando el **mismo** email termina en `/games` con su username de siempre, sin pasar por `/login/nombre`. `auth.identities` muestra las dos identidades sobre el mismo `user_id`.
- [ ] Un usuario OAuth con profile guarda un score con `user_id` = su id y `player_name` = su username (RLS de la 19, sin cambios).
- [ ] El registro y el login con email + contraseña de la SPEC 19 siguen funcionando igual (registro con `kai_01` → `KAI_01`).
- [ ] Los probes SQL del paso 2 dan el resultado esperado.

**Calidad**

- [ ] `npm run lint` termina sin errores.
- [ ] Los advisors de seguridad de Supabase no reportan problemas nuevos sobre `profiles` ni `handle_new_user`.
- [ ] Ningún client secret de Google o GitHub aparece en el repo (`rg -i "client_secret|GOCSPX"` no devuelve nada).

---

## Decisiones

- **D1 — Sí: el trigger saltea el profile si no hay username, y el profile lo crea una Server Action con RLS `id = auth.uid()`.** Es el cambio mínimo: el CHECK de formato y el índice único siguen en la tabla, y no hay grants de `update`. **No:** una RPC `claim_username` `SECURITY DEFINER`, porque suma una función expuesta por RPC que hay que blindar (como pasó con `handle_new_user` en la 19). **No:** username autogenerado, ya descartado en D11 de la 19.
- **D2 — Sí: la pantalla obligatoria se fuerza en `proxy.ts`.** Ya corre en cada request y ya lee claims, así que no hay ruta que se escape. **No:** forzarla en el layout, porque el root layout no se vuelve a renderizar en navegaciones del cliente y se escapa con un `Link`. **No:** forzarla solo en el callback, porque escribiendo `/games` en la barra se jugaría con sesión y sin nombre.
- **D3 — Sí: se exentan `/login/nombre`, `/auth/*` y `/api/*` del bloqueo.** Las dos primeras son el flujo mismo. Las APIs no son páginas, y bloquearlas rompe el health check y el form de contacto. Server Actions como `signOut` se postean a la página actual (`/login/nombre`), que está exenta.
- **D4 — Sí: linking automático de Supabase (el default).** Quien ya tenía cuenta con el mismo email conserva su username y sus scores. **No:** cuentas separadas, que requieren desactivar el linking y dejan dos usuarios para una persona. Ver el riesgo de pre-account takeover.
- **D5 — Sí: siempre a `/games` después del login.** Es consistente con la 19 y no deja un parámetro `next=` que validar contra open redirect. **No:** volver a la página de origen, porque hoy `/login` es la única entrada y se gana poco.
- **D6 — Sí: la pantalla vive en `/login/nombre`.** Es parte del flujo de alta, reusa `.auth-card` y deja una exención corta en el proxy. **No:** `/elige-tu-nombre` en la raíz.
- **D7 — Sí: sugerencia de nombre sanitizada y editable** (GitHub `user_name`, Google parte local del email). Baja la fricción. Si está tomada o queda corta, el campo va vacío. **No:** campo siempre vacío.
- **D8 — Sí: botones OAuth debajo del form, en las dos pestañas**, con el "O CONTINÚA CON" del prototype (`resources/templates/auth.jsx`) y el CSS existente (`.auth-divider`, `.social`). Con OAuth, entrar y registrarse es la misma acción. **No:** arriba del form, porque cambia la jerarquía del prototype. **No:** solo en INICIAR SESIÓN, porque confunde a quien no tiene cuenta.
- **D9 — Sí: un error de OAuth vuelve a `/login?error=oauth` con un mensaje genérico.** **No:** una página `/auth/error` dedicada, que sería otra pantalla para un caso poco frecuente.
- **D10 — Sí: el flujo PKCE arranca en una Server Action.** El code verifier queda en una cookie HttpOnly (`SESSION_COOKIE_OPTIONS`) y solo lo lee el callback en el server, en línea con D17 de la 19. **No:** `signInWithOAuth` desde el browser client, porque necesitaría cookies legibles por JS.
- **D11 — Sí: `redirectTo` se arma con el header `origin` de la request.** La allow list de Supabase rechaza cualquier origin que no esté configurado, así que un header manipulado no lleva a otro sitio. **No:** una variable `SITE_URL` nueva, que es más configuración para el mismo resultado mientras solo exista localhost.
- **D12 — Sí: solo localhost en esta spec.** **No:** configurar ya un dominio de producción, porque todavía no hay deploy. El paso 1 documenta cómo sumarlo.
- **D13 — Sí: el nombre elegido es permanente** (sin grant de `update`). Es el mismo criterio que en la 19, donde el username del registro tampoco se cambia. **No:** dejar editarlo en esta spec, porque va con la página de cuenta.
- **D14 — Sí: aceptar que un usuario sin profile pueda venir también de un `signUp` por email hecho directamente contra la API sin `username`.** Cae en la misma pantalla obligatoria, así que el estado es consistente. **No:** distinguir el provider en el trigger, porque es más lógica para el mismo resultado.

---

## Riesgos identificados

| Riesgo | Mitigación |
| ------ | ---------- |
| **Pre-account takeover.** La confirmación de email está desactivada (D7 de la 19), así que un atacante puede registrar `victima@gmail.com` con contraseña. Supabase lo da por confirmado, y cuando la víctima entra con Google, el linking automático suma su identidad a la cuenta del atacante, que conserva la contraseña. | Se acepta mientras el sitio esté solo en localhost. **Bloquea el deploy a producción:** antes hay que hacer la spec de confirmación de email + SMTP, o desactivar el linking automático. Queda anotado para esa spec. |
| Google en modo *Testing* solo deja entrar a los test users configurados. | Está documentado en el paso 1. Publicar la app de Google es parte del deploy a producción, fuera de alcance. |
| La consulta a `profiles` en el proxy suma un round-trip por request **con sesión**. | Solo corre con `sub` presente y fuera de las rutas exentas, y el `matcher` ya excluye los estáticos. La PK cubre el lookup. Si molesta, una spec futura puede cachearlo en una cookie firmada o en un claim custom. |
| Si el usuario cancela en `/login/nombre` (cierra la pestaña), quedan filas en `auth.users` sin profile. | El bloqueo lo devuelve a la pantalla en el próximo login. La limpieza queda fuera de alcance. |
| Un redirect del proxy que no copie las cookies refrescadas haría perder la sesión en el siguiente request. | El paso 7 exige copiar las cookies de `response` al redirect. Se verifica navegando varias veces seguidas con un usuario sin profile. |
| El primer intento de PKCE puede fallar si el code verifier no llega al callback (cookie con otro `path` o bloqueada). | `SESSION_COOKIE_OPTIONS` usa `path: "/"` y `sameSite: "lax"`, que permite la cookie en el redirect top-level desde el provider. El criterio de los dos providers lo verifica. |
| Alguien podría commitear los client secrets en `.env` por costumbre. | Los secrets viven solo en el dashboard de Supabase. Hay un criterio de aceptación con `rg`. |
