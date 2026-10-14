# SPEC 19 — Autenticación real: registro, login y sesión con Supabase Auth

> **Status:** Implemented
> **Depends on:** SPEC 01 (arcade-vault-mvp-visual), SPEC 04 (supabase-connection), SPEC 06 (games-table-and-leaderboard), SPEC 14 (site-mobile-first)
> **Date:** 2026-10-13
> **Objective:** Reemplazar la sesión mock por Supabase Auth con email y contraseña, con un username único por jugador que se usa (forzado por RLS) al guardar scores, manteniendo el modo invitado.

> **Enmienda 2026-10-13 (durante el paso 4):**
>
> 1. **Cookies HttpOnly.** El criterio "cookies `sb-*` HttpOnly" chocaba con el plan. `@supabase/ssr` 0.12.7 escribe esas cookies con `httpOnly: false` por defecto (`node_modules/@supabase/ssr/dist/main/utils/constants.js:7`), porque el browser client tiene que leerlas. Con HttpOnly, el insert del score desde el browser saldría sin JWT, la RLS lo trataría como `anon` y lo rechazaría. Además, `onAuthStateChange` no vería la sesión. Se elige **HttpOnly + todo lo que necesita sesión en el server**:
>    - `cookieOptions` con `httpOnly: true` en el server client y en el proxy;
>    - el score se guarda con una Server Action `saveScore`;
>    - se quita `onAuthStateChange`.
>
>    Afecta: *Alcance*, *Modelo de datos (App)*, pasos 4, 7 y 9, D15 y las nuevas D17 y D18.
> 2. **Advisor.** El advisor marcó que `handle_new_user()` (`SECURITY DEFINER`) era ejecutable por `anon`/`authenticated` vía RPC, y el criterio de aceptación pide advisors limpios. Se agrega la migración 3 `restrict_handle_new_user`. Afecta: *Modelo de datos* y paso 3.

---

## Por qué existe esta spec

Hoy la "sesión" es un mock: `lib/session-context.tsx` guarda `{ name }` en `localStorage` (`av_user`) y `components/auth/Auth.tsx` acepta cualquier usuario y contraseña. Consecuencias concretas, leídas del código el 2026-10-13:

1. **Nadie es dueño de un score.** `scores` solo tiene `player_name` y la RLS deja insertar cualquier nombre. Cualquiera puede aparecer como cualquiera en el ranking.
2. **El modal de "FIN DEL JUEGO" deja editar el nombre** (`nameOverride` en `GamePlayer.tsx`), incluso "logueado".
3. **"TU MEJOR MARCA"** en el Salón de la Fama busca por `player_name` (`HallOfFame.tsx`), no por usuario.
4. **El botón `{user.name} ▾` de la Nav cierra sesión al primer click**: el ▾ promete un menú que no existe.
5. `lib/supabase/server.ts` ya deja anotado que el refresh de sesión "will be handled by a proxy in a future spec". No existe `proxy.ts`.

El alcance original ("registro, login y autenticación") incluía OAuth con Google y GitHub. Se partió en dos specs: **esta (19) es la base** y la **SPEC 20 (OAuth)** se monta encima.

---

## Alcance

**Dentro:**

- Supabase Auth con **email + contraseña** (mínimo 8 caracteres), sin confirmación de email.
- Tabla `profiles` con `username` único (3–10 caracteres, `A–Z 0–9 _`, en mayúsculas), creada por **trigger** sobre `auth.users` en la misma transacción del registro.
- `scores.user_id` nullable. RLS:
  - **Logueado:** `user_id = auth.uid()` y `player_name` = su username.
  - **Invitado:** `user_id` null y `player_name` **no** puede ser un username registrado.
- Vista `scores_ranked` con `user_id`.
- `proxy.ts` en la raíz que refresca la sesión en cada request. Las cookies son HttpOnly vía `cookieOptions` de `@supabase/ssr` (ver la enmienda).
- Server Actions `signIn`, `signUp` y `signOut` con validación Zod en el server.
- Pantalla `/login` con dos pestañas:
  - **INICIAR SESIÓN:** email + contraseña.
  - **CREAR CUENTA:** username + email + contraseña.
  - Estados de carga y error en español.
  - `/login` con sesión activa redirige a `/games`.
- `SessionProvider` real: el usuario viene del server (layout) en cada render. Las Server Actions de auth, al setear cookies, provocan que el layout se vuelva a renderizar. Se borra la clave legacy `av_user` de `localStorage`.
- Nav:
  - Desktop: el botón del username abre un menú ▾ con **CERRAR SESIÓN**.
  - Panel mobile: username + botón **CERRAR SESIÓN**.
  - Logout = `signOut` + navegación completa a `/`.
- `GamePlayer` guarda el score con la Server Action `saveScore`:
  - Logueado: el nombre es fijo (sin input) y el score se guarda con `user_id`.
  - Invitado: pre-chequeo del nombre contra `profiles` en el server, con el mensaje "ESE NOMBRE PERTENECE A UN JUGADOR REGISTRADO".
- `HallOfFame`: "TU MEJOR MARCA" busca por `user_id`.
- Se ocultan los botones GOOGLE / GITHUB y el separador "O CONTINÚA CON" hasta la SPEC 20.
- Se mantiene "JUGAR COMO INVITADO", que lleva a `/games` sin sesión.
- Se actualiza `CLAUDE.md` (secciones *Session*, *Data layer* y tabla de rutas).

**Fuera de alcance (specs futuras):**

- **OAuth Google / GitHub (SPEC 20)**, incluida la pantalla obligatoria "ELIGE TU NOMBRE" para quien entra por OAuth sin profile (decisión ya tomada, ver D11).
- Confirmación de email y SMTP propio (Resend). Va junto con la recuperación de contraseña.
- "Olvidé mi contraseña" / reset por email.
- Página de cuenta o perfil: cambiar username, email o contraseña, o borrar la cuenta.
- Rutas protegidas: todo el sitio sigue público y el login es opcional.
- Reclamar scores viejos de invitado ("estos scores con mi nombre son míos").
- Captcha o rate limiting propio (se usan los límites por defecto de Supabase Auth).

---

## Modelo de datos

### Migración 1 — `supabase/migrations/<YYYYMMDDHHMMSS>_create_profiles.sql`

```sql
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null
             check (username ~ '^[A-Z0-9_]{3,10}$' and username <> 'INVITADO'),
  created_at timestamptz not null default now()
);

create unique index profiles_username_key on public.profiles (username);

alter table public.profiles enable row level security;

-- Defense in depth: profiles are written only by the trigger below.
revoke insert, update, delete on public.profiles from anon, authenticated;

-- Public: the score modal and the sign-up form check username availability.
create policy "profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, upper(btrim(new.raw_user_meta_data ->> 'username')));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- El username se guarda **siempre en mayúsculas**: el CHECK lo garantiza, así que el índice único ya es case-insensitive en la práctica.
- `INVITADO` está reservado porque es el nombre por defecto de los invitados en `GamePlayer`. Si alguien lo registrara, ningún invitado podría guardar con el nombre por defecto.
- Si el username falta, es inválido o está en uso, el trigger falla y **el registro entero se revierte**: nunca queda un usuario de auth sin profile.

### Migración 2 — `supabase/migrations/<YYYYMMDDHHMMSS>_link_scores_to_users.sql`

```sql
alter table public.scores
  add column user_id uuid references public.profiles(id) on delete set null;

create index scores_user_game_idx on public.scores (user_id, game_id);

drop policy "scores can be inserted for playable games" on public.scores;

create policy "guests insert scores with a free name"
  on public.scores for insert
  to anon
  with check (
    user_id is null
    and exists (select 1 from public.games g where g.id = scores.game_id and g.playable)
    and not exists (
      select 1 from public.profiles p
      where p.username = upper(btrim(scores.player_name))
    )
  );

create policy "players insert their own scores"
  on public.scores for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.games g where g.id = scores.game_id and g.playable)
    and player_name = (select p.username from public.profiles p where p.id = (select auth.uid()))
  );

-- New column appended at the end so `create or replace` is allowed.
create or replace view public.scores_ranked
with (security_invoker = true) as
select
  s.id,
  s.game_id,
  s.player_name,
  s.score,
  s.created_at,
  (row_number() over (
    partition by s.game_id
    order by s.score desc, s.created_at asc
  ))::integer as rank,
  s.user_id
from public.scores s;
```

- Los scores existentes quedan con `user_id = null` y no se tocan.
- Un usuario logueado **no puede** guardar como invitado: la policy de invitado es solo `to anon`.

### Migración 3 — `supabase/migrations/<YYYYMMDDHHMMSS>_restrict_handle_new_user.sql` (enmienda)

```sql
-- Only the auth.users trigger may run it; never callable through /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
```

- Después de las migraciones se regenera `lib/supabase/database.types.ts` con el MCP `generate_typescript_types`.

### Configuración de Supabase Auth (dashboard, no versionada)

El MCP de Supabase no expone la configuración de Auth, así que este paso es manual y queda documentado acá:

- Provider **Email**: habilitado.
- **Confirm email**: desactivado.
- **Minimum password length**: 8.

### App

```ts
// lib/session-context.tsx
export interface Session {
  id: string;   // auth.users.id = profiles.id
  name: string; // profiles.username (already uppercase, 3–10)
}

interface SessionContextValue {
  user: Session | null;
  logout: () => Promise<void>; // signOut action + window.location.assign("/")
}
// `login` disappears from the context: login now happens in server actions.
```

```ts
// lib/supabase/session-cookies.ts (amendment) — shared by server.ts and proxy.ts
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;
```

```ts
// app/games/[id]/play/actions.ts (amendment)
export type SaveScoreResult = "saved" | "name-taken" | "error";

// With a session: user_id = auth uid, player_name = profile username (playerName is ignored).
// Without one: guest insert as anon, after checking playerName isn't a registered username.
export async function saveScore(input: {
  gameId: string;
  score: number;
  playerName: string;
}): Promise<SaveScoreResult>;
```

```ts
// lib/auth/schemas.ts (Zod, used by the actions on the server)
export const USERNAME_PATTERN = /^[A-Z0-9_]{3,10}$/;

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const signUpSchema = signInSchema.extend({
  username: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.string().regex(USERNAME_PATTERN).refine((v) => v !== "INVITADO")),
});

// app/login/actions.ts — state for useActionState
export type AuthFormState = { error: string | null };
```

**Mensajes de error (español, nunca el mensaje crudo de Supabase):**

| Caso | Mensaje |
| ---- | ------- |
| Login con credenciales inválidas | `CORREO O CONTRASEÑA INCORRECTOS` |
| Username inválido (Zod) | `NOMBRE: 3 A 10 LETRAS, NÚMEROS O _` |
| Username en uso (pre-chequeo o trigger) | `ESE NOMBRE YA ESTÁ EN USO` |
| Email ya registrado | `ESE CORREO YA TIENE UNA CUENTA` |
| Contraseña < 8 | `LA CONTRASEÑA NECESITA 8 CARACTERES O MÁS` |
| Cualquier otro error | `NO PUDIMOS CONECTAR CON EL VAULT. INTENTA DE NUEVO` |
| Invitado con un username registrado (modal) | `ESE NOMBRE PERTENECE A UN JUGADOR REGISTRADO` |

---

## Plan de implementación

1. **Configurar Supabase Auth (manual, dashboard):** Email habilitado, *Confirm email* desactivado, mínimo de contraseña 8. Verificación: la pantalla de Auth → Providers → Email muestra esos valores.
2. **Migración `create_profiles`:** tabla, índice, RLS, función y trigger (ver *Modelo de datos*). Se aplica con el MCP `apply_migration` y se regeneran los tipos. Probes SQL:
   - un `insert` en `auth.users` con metadata `{"username":"kai_01"}` crea el profile `KAI_01`;
   - uno con `INVITADO`, con `ab` o sin username falla y no deja la fila en `auth.users`.

   Los usuarios de prueba se borran al terminar. El sitio sigue funcionando igual porque nada lo usa todavía.
3. **Migración `link_scores_to_users`:** `user_id`, índice, las dos policies y la vista. Se regeneran los tipos y se corren los advisors de seguridad. Probes con `set role anon` / `authenticated` + `request.jwt.claims`:
   - el invitado inserta con un nombre libre: OK;
   - el invitado inserta con un username registrado: rechazado;
   - el invitado inserta con `user_id`: rechazado;
   - el logueado inserta con su `user_id` y su username: OK;
   - el logueado inserta con otro nombre: rechazado;
   - el logueado inserta con `user_id` ajeno: rechazado;
   - el logueado inserta con `user_id` null: rechazado.

   El player actual (sin login real) sigue guardando como invitado.

   **Enmienda:** migración 3 `restrict_handle_new_user` (revoke `EXECUTE`). Después, los advisors no marcan `handle_new_user`.
4. **`proxy.ts` + `lib/supabase/proxy.ts`:**
   - `lib/supabase/session-cookies.ts` define `SESSION_COOKIE_OPTIONS` (`httpOnly: true`). Lo usan `lib/supabase/server.ts` y el proxy como `cookieOptions`.
   - `updateSession(request)` crea el server client sobre `request`/`response` cookies y llama a `auth.getClaims()` para refrescar el token.
   - `matcher` excluye `_next/static`, `_next/image`, `favicon.ico` e imágenes de `public/`.
   - Se actualiza el comentario de `lib/supabase/server.ts`.
   - Verificación: `/`, `/games` y un juego cargan igual. `curl /api/health/supabase` sigue en `{ ok: true }`.
5. **`lib/auth/schemas.ts` + `app/login/actions.ts`:**
   - `signIn`, `signUp` y `signOut` como Server Actions (`"use server"`), validadas con Zod.
   - `signUp` hace un pre-chequeo de `profiles` por username y después llama a `auth.signUp({ email, password, options: { data: { username } } })`.
   - El error de Supabase se traduce con la tabla de mensajes.
   - Éxito → `redirect("/games")`.
6. **`components/auth/Auth.tsx` conectado a las actions:**
   - `useActionState` por pestaña, inputs con `name`, `autoComplete` (`email`, `current-password`, `new-password`, `username`) y `required`.
   - Error con `role="alert"` y botón deshabilitado mientras `pending`.
   - Se quitan GOOGLE / GITHUB y "O CONTINÚA CON". "JUGAR COMO INVITADO" pasa a ser un link a `/games`.
   - `app/login/page.tsx` redirige a `/games` si hay sesión.
   - El componente ya no llama a `login()` del contexto.
7. **`SessionProvider` real:**
   - `app/layout.tsx` (async) lee claims + profile con el server client y pasa `user` al provider. El provider usa esa prop directamente, sin copiarla a un estado.
   - **Enmienda:** no hay `onAuthStateChange`. El browser client no ve la sesión porque las cookies son HttpOnly. Las Server Actions que setean cookies hacen que el layout se vuelva a renderizar.
   - `logout` llama a la action `signOut` y después a `window.location.assign("/")`.
   - Al montar se borra `av_user` de `localStorage` (try/catch).
   - Se elimina `login` del contexto.
8. **Nav:**
   - Desktop: el botón `{user.name} ▾` abre un menú con `aria-haspopup="menu"` y `aria-expanded`. El menú tiene un único item, **CERRAR SESIÓN**, y se cierra con Escape, con un click afuera o al navegar.
   - Panel mobile: con sesión se muestra el username como texto y un botón **CERRAR SESIÓN**; sin sesión, el link "Iniciar Sesión". Se quita el link "Cuenta".
   - Touch targets ≥ 44px.
9. **`GamePlayer` + `app/games/[id]/play/actions.ts` (enmienda: Server Action `saveScore`):**
   - Logueado: el modal muestra el username sin input. `saveScore` toma el uid de los claims y el username de `profiles`, e inserta con el server client (rol `authenticated`).
   - Invitado: `saveScore` consulta `profiles` por `toPlayerName(playerName)`. Si existe, devuelve `name-taken` y el modal muestra `ESE NOMBRE PERTENECE A UN JUGADOR REGISTRADO`. Si no existe, inserta con `user_id` null. Si el insert falla igual por RLS (carrera), devuelve `error` y se muestra el error genérico existente.
   - Se elimina `insertScore` del browser client.
10. **`HallOfFame`:** `useMyBest` filtra `scores_ranked` por `user_id` en vez de `player_name`. Sin sesión no se muestra "TU MEJOR MARCA" (como hoy).
11. **`CLAUDE.md`:**
    - *Session* describe Supabase Auth, `proxy.ts`, `profiles` y el trigger.
    - *Data layer* suma `profiles` y las policies nuevas de `scores`.
    - La fila `/login` de la tabla de rutas deja de decir "Mock".

---

## Criterios de aceptación

**Registro y login**

- [ ] Crear cuenta con username `kai_01`, un email nuevo y una contraseña de 8 caracteres deja la sesión iniciada, redirige a `/games` y la Nav muestra `KAI_01 ▾`.
- [ ] Crear cuenta con un username ya registrado (en cualquier combinación de mayúsculas) muestra `ESE NOMBRE YA ESTÁ EN USO` y no crea ninguna fila en `auth.users`.
- [ ] Crear cuenta con username `ab`, `INVITADO` o `kai-01` muestra el error de formato o de nombre en uso, y no crea el usuario.
- [ ] Crear cuenta con un email ya registrado muestra `ESE CORREO YA TIENE UNA CUENTA`.
- [ ] Una contraseña de 7 caracteres es rechazada en el registro.
- [ ] Iniciar sesión con credenciales correctas redirige a `/games`. Con contraseña incorrecta muestra `CORREO O CONTRASEÑA INCORRECTOS`.
- [ ] Ningún mensaje de error muestra texto en inglés ni el detalle de Supabase.
- [ ] Mientras la action está pendiente, el botón de submit está deshabilitado.
- [ ] `/login` no muestra botones GOOGLE / GITHUB ni "O CONTINÚA CON".
- [ ] "JUGAR COMO INVITADO" lleva a `/games` sin crear sesión.

**Sesión**

- [ ] Recargar cualquier página con sesión activa mantiene el username en la Nav, sin parpadeo de "Iniciar Sesión".
- [ ] La sesión vive en cookies `sb-*` HttpOnly. `localStorage` no contiene tokens ni la clave `av_user`.
- [ ] Entrar a `/login` con sesión activa redirige a `/games`.
- [ ] Iniciar sesión en una pestaña y recargar otra pestaña muestra la sesión en ambas.

**Logout y Nav**

- [ ] Un click en `KAI_01 ▾` abre el menú y **no** cierra la sesión. Escape o un click afuera lo cierra.
- [ ] **CERRAR SESIÓN** (desktop y panel mobile) termina en `/` con navegación completa y la Nav vuelve a mostrar "Iniciar Sesión".
- [ ] A 375×667, el botón del username y **CERRAR SESIÓN** miden ≥ 44px de alto y no hay scroll horizontal.

**Scores**

- [ ] Logueado: el modal de "FIN DEL JUEGO" muestra el username sin input editable, y la fila guardada tiene `user_id` = id del usuario y `player_name` = username.
- [ ] Invitado con un nombre libre guarda el score con `user_id` null.
- [ ] Invitado con un nombre que es username registrado ve `ESE NOMBRE PERTENECE A UN JUGADOR REGISTRADO` y no se inserta la fila.
- [ ] Los 7 probes RLS del paso 3 dan el resultado esperado.
- [ ] Los scores anteriores a la spec siguen visibles en `/games/[id]` y en `/hall-of-fame`.
- [ ] "TU MEJOR MARCA" en el Salón de la Fama muestra el mejor score del usuario logueado aunque exista un score de invitado viejo con el mismo nombre y más puntos.

**Calidad**

- [ ] `npm run lint` termina sin errores.
- [ ] Los advisors de seguridad de Supabase no reportan problemas nuevos sobre `profiles`, `scores` ni `handle_new_user`.
- [ ] `curl localhost:3000/api/health/supabase` devuelve `{ ok: true }`.

---

## Decisiones

- **D1 — Sí: Supabase Auth.** Ya están `@supabase/ssr` y el server client con cookies. **No:** auth propia ni NextAuth/Auth.js, que agregan otra capa para lo mismo.
- **D2 — Sí: partir en SPEC 19 (email + contraseña) y SPEC 20 (OAuth).** Cada una se prueba y se mergea sola. La 20 reutiliza `profiles`, el proxy y el provider. **No:** una sola spec grande, que tendría demasiados pasos y una verificación que dependería de tener las apps OAuth configuradas desde el primer día.
- **D3 — Sí: login por email; el username se elige en el registro.** **No:** login por username o email, porque obliga a resolver username → email del lado del server (RPC o route) y expone qué usernames tienen cuenta.
- **D4 — Sí: `profiles` con username único en mayúsculas `^[A-Z0-9_]{3,10}$`.** Encaja con el CHECK 1–10 de `scores.player_name` y con `toPlayerName`. **No:** alias libre en `user_metadata`, que no es único. **No:** permitir cualquier carácter, porque deja pasar homoglifos y espacios.
- **D5 — Sí: el trigger `security definer` crea el profile en la misma transacción que `auth.users`.** **No:** insertar el profile desde el cliente después de `signUp`, porque si ese segundo paso falla queda un usuario sin profile y toda la app tendría que manejar ese estado.
- **D6 — Sí: Server Actions con Zod en el server.** Las cookies las escribe el server y el redirect es server-side. **No:** browser client en `Auth.tsx`, porque la validación quedaría solo en el cliente.
- **D7 — Sí: confirmación de email desactivada.** El SMTP por defecto de Supabase solo envía a miembros del equipo del proyecto. **No (por ahora):** Resend como SMTP. Va en la spec de confirmación + recuperación.
- **D8 — Sí: mínimo 8 caracteres, sin recuperación de contraseña.** El reset necesita enviar emails (ver D7). **No:** exigir letras y números, por la fricción que agrega.
- **D9 — Sí: `scores.user_id` nullable, el invitado sigue pudiendo guardar, y el nombre del logueado es fijo y lo fuerza la RLS.** **No:** solo logueados guardan, porque mata el modo invitado. **No:** nombre editable para el logueado, porque haría inconsistentes los rankings del mismo usuario.
- **D10 — Sí: el invitado no puede usar un username registrado (RLS + pre-chequeo en el modal).** **No:** permitirlo marcando filas de registrados, porque toca más UI y la suplantación sigue siendo posible.
- **D11 — Para la SPEC 20, ya decidido:** quien entra por OAuth sin profile va a una pantalla obligatoria "ELIGE TU NOMBRE" y no puede salir de ella salvo cerrando sesión. **No:** username autogenerado. **No:** pedirlo recién al guardar el primer score.
- **D12 — Sí: login opcional; ninguna ruta protegida.** `proxy.ts` solo refresca la sesión. **No:** exigir login en el player, porque contradice D9.
- **D13 — Sí: menú ▾ en la Nav con CERRAR SESIÓN y navegación completa a `/`.** Sigue la regla de seguridad de logout: limpiar memoria e invalidar la sesión con un reload completo. **No:** click en el username = logout (el bug de hoy). **No:** página `/account`, que es más alcance y queda para la spec de perfil.
- **D14 — Sí: botones sociales ocultos hasta la SPEC 20.** **No:** mostrarlos deshabilitados con "PRÓXIMAMENTE", porque sería UI muerta en producción.
- **D15 — Sí: usuario leído en el server (layout) en cada render.** Evita el parpadeo "Iniciar Sesión" → username al hidratar. **No:** que el provider pida la sesión solo en el cliente. *(Enmendada: ya no hay `onAuthStateChange`, ver D17.)*
- **D16 — Sí: `INVITADO` es un username reservado.** Es el nombre por defecto del modal para invitados. Si alguien lo registrara, D10 bloquearía a todos los invitados.
- **D17 — Sí (enmienda): cookies de sesión HttpOnly, y todo lo que necesita sesión corre en el server** (auth actions, `saveScore`, layout). El browser client queda solo para lecturas públicas (por ejemplo, "TU MEJOR MARCA" filtrando `scores_ranked` por `user_id`, que es público). **No:** el default de `@supabase/ssr` (cookies legibles por JS), porque un XSS podría leer el token.
- **D18 — Sí (enmienda): revoke `EXECUTE` de `handle_new_user()` en una migración nueva.** **No:** aceptar el warning del advisor, porque contradice el criterio de aceptación. **No:** editar la migración 1, que ya está aplicada.

---

## Riesgos identificados

| Riesgo | Mitigación |
| ------ | ---------- |
| La configuración de Auth (confirm email, mínimo de contraseña) vive en el dashboard y no en una migración; un proyecto nuevo arrancaría con otros valores. | Queda documentada en *Modelo de datos* y como paso 1 del plan. El `min(8)` de Zod la duplica del lado de la app. |
| Un bug en `handle_new_user` hace fallar **todos** los registros. | Probes SQL del paso 2 antes de tocar la UI. Mensaje genérico en la UI en vez de un error crudo. |
| `ESE CORREO YA TIENE UNA CUENTA` permite enumerar emails registrados. | Se acepta en esta etapa: sin confirmación de email, Supabase ya devuelve ese caso. Se revisa en la spec de confirmación + SMTP. |
| Scores viejos de invitado con el mismo nombre que un username nuevo se ven iguales en el ranking que los del usuario. | Fuera de alcance (reclamar scores). "TU MEJOR MARCA" usa `user_id`, así que no los confunde (criterio de aceptación). |
| Leer cookies en `app/layout.tsx` vuelve dinámicas todas las páginas. | Las páginas ya leen Supabase con el server client cookie-aware, así que en la práctica ya eran dinámicas. Se verifica con `npm run dev` que `/`, `/games` y `/hall-of-fame` cargan sin errores en consola. |
| Las subconsultas a `profiles` y `games` en la RLS de `scores` agregan costo a cada insert. | `profiles_username_key` y la PK cubren los lookups. Los inserts ocurren una vez por partida. |
| Si el `matcher` de `proxy.ts` es demasiado amplio, la sesión se refresca también en assets estáticos. | Patrón negativo de la doc de Next 16 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`). |
