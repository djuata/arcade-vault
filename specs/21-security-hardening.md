# SPEC 21 — Hardening de seguridad básico (Supabase + headers HTTP)

> **Status:** Implemented
> **Depends on:** SPEC 19 (supabase-auth), SPEC 20 (oauth-google-github)
> **Date:** 2026-10-13
> **Objective:** Cerrar el checklist de seguridad básico de `resources/security/checklist.md` con headers HTTP en Next.js, la revocación de `EXECUTE` sobre `rls_auto_enable`, y la verificación de RLS y de los ajustes de Auth del dashboard.

> **Enmienda 2026-10-13 (durante la verificación del paso 1):** el dashboard quedó exigiendo **complejidad de contraseña**: al menos una minúscula, una mayúscula, un número y un símbolo, además del mínimo de 8. Lo mostró un probe de signup con `abc1234`, que devolvió `weak_password` con `reasons: ["length", "characters"]`.
>
> Se decide **mantenerla**. La app tiene que validar la misma regla antes de llamar a Supabase y mostrar un mensaje veraz: hasta ahora todo `weak_password` decía `LA CONTRASEÑA NECESITA 8 CARACTERES O MÁS`, incluso con 18 caracteres.
>
> Afecta: *Alcance* (la complejidad pasa de "fuera" a "dentro"), *Ajustes de Auth*, *Modelo de datos (App)*, el nuevo paso 5 (los pasos siguientes se renumeran), *Criterios*, y las decisiones D11 y D12.

---

## Por qué existe esta spec

`resources/security/checklist.md` lista cinco medidas básicas y tres advisors de Supabase. Estado real, verificado el 2026-10-13 contra la base y el repo:

1. **RLS ya está activo** en `games`, `scores` y `profiles` (`pg_class.relrowsecurity = true` en las tres). No hay que implementarlo, solo dejarlo verificado.
2. **La contraseña mínima de 8 caracteres** ya está configurada en el dashboard desde la SPEC 19. Solo se verifica.
3. **Leaked password protection** está desactivado (advisor `auth_leaked_password_protection`). El proyecto está en el plan **Free**, y esa función de Supabase (HaveIBeenPwned) solo existe en Pro o superior. **No se puede activar.**
4. **El límite de sign-ups** está en el default del dashboard, sin nada documentado. Además, `signUp`/`signIn` corren en Server Actions (`app/login/actions.ts`), así que Supabase ve la IP del server de Next y no la del jugador. **El límite "por IP" funciona en la práctica como un límite global del sitio.**
5. **`next.config.ts` no define `headers`.** El sitio sale sin `X-Content-Type-Options`, sin `X-Frame-Options` y con `X-Powered-By: Next.js`.
6. **Advisors `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable`** sobre `public.rls_auto_enable()`:
   - es la función `SECURITY DEFINER` del event trigger `ensure_rls` (`ddl_command_end`), creada por la opción "auto-enable RLS" del dashboard;
   - **no está en ninguna migración**;
   - su ACL da `EXECUTE` a `anon` y `authenticated`.

   Como devuelve `event_trigger`, Postgres no deja invocarla como RPC, así que el riesgo real es casi nulo. Igual se revoca, para dejar los advisors limpios (es el mismo patrón que `restrict_handle_new_user` en la SPEC 19).

---

## Alcance

**Dentro:**

- **Headers de seguridad** en `next.config.ts` para todas las rutas (`source: "/(.*)"`):
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (sin `preload`)
- **`poweredByHeader: false`** en `next.config.ts`, para que no salga `X-Powered-By`.
- **Migración `restrict_rls_auto_enable`:** `revoke execute` sobre `public.rls_auto_enable()` para `public`, `anon` y `authenticated`. El event trigger `ensure_rls` sigue funcionando.
- **Rate limit de sign-ups + sign-ins** fijado y verificado en el dashboard: **30 cada 5 minutos por IP** (Auth → Rate Limits). El efecto real de límite global queda documentado.
- **Verificaciones sin cambios** (con probes y checks documentados):
  - RLS activo en `games`, `scores` y `profiles`;
  - contraseña mínima de 8 caracteres en Auth → Providers → Email.
- **Complejidad de contraseña (enmienda):**
  - el dashboard exige minúscula + mayúscula + número + símbolo;
  - `signUpSchema` valida la misma regla;
  - un solo mensaje describe la regla completa;
  - el login (`signInSchema`) **no** cambia, así los usuarios con contraseñas previas pueden seguir entrando.
- **Leaked password protection:** queda como **riesgo aceptado** por el plan Free, documentado en *Riesgos* y en `CLAUDE.md`.
- `CLAUDE.md`: se documentan los headers, la revocación de `rls_auto_enable` y el estado de los ajustes de Auth.
- Al commitear, `next.config.ts` se agrega con **staging parcial** (`git add -p`): `allowedDevOrigins` sigue siendo un cambio local que nunca se commitea.

**Fuera de alcance (specs futuras):**

- **Content-Security-Policy.** Con Next 16, una CSP estricta necesita nonces generados en `proxy.ts` y obliga a renderizar en dinámico. Va en su propio spec.
- **Confirmación de email / desactivar el linking automático.** Es el fix del pre-account takeover que dejó abierto la SPEC 20. Necesita SMTP propio, templates y un flujo de "revisá tu correo", así que va en su propio spec y **sigue bloqueando el deploy a producción**.
- **CAPTCHA (Turnstile/hCaptcha)** en el registro y el login.
- **Rate limit propio por IP del cliente** en las Server Actions de auth (necesita un store compartido).
- Reenviar la IP real del jugador a Supabase Auth.
- Activar leaked password protection (requiere pasar a Pro).
- Forzar a los usuarios existentes a cambiar una contraseña que no cumple la nueva regla.
- Un indicador de fortaleza o una checklist en vivo de la contraseña en el form.
- `preload` de HSTS y cualquier configuración de dominio de producción.
- Leer `allowedDevOrigins` desde una variable de entorno.

---

## Modelo de datos

Esta spec no agrega tablas, columnas ni tipos. **No** se regenera `lib/supabase/database.types.ts`.

### Migración — `supabase/migrations/<YYYYMMDDHHMMSS>_restrict_rls_auto_enable.sql`

```sql
-- rls_auto_enable() backs the dashboard's ensure_rls event trigger (auto-enables
-- RLS on new public tables). It is SECURITY DEFINER and was exposed via
-- /rest/v1/rpc to anon/authenticated (advisors 0028/0029). Event triggers do
-- not need these grants, so revoke them (spec 21).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

- No se recrea la función ni el trigger: los dos los creó el dashboard y siguen siendo suyos.
- `service_role` y `postgres` conservan `EXECUTE`.

### `next.config.ts`

```ts
// Applied to every route, statics included (spec 21).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
};
```

Antes de escribirlo hay que leer `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md` y `poweredByHeader.md` (Next 16).

### Ajustes de Auth (dashboard, no versionados)

El MCP de Supabase no expone la configuración de Auth.

| Dónde | Valor esperado |
| ----- | -------------- |
| Authentication → Providers → Email → Minimum password length | `8` (sin cambios desde la SPEC 19) |
| Authentication → Providers → Email → Password requirements | Minúsculas, mayúsculas, dígitos y símbolos (enmienda) |
| Authentication → Rate Limits → Sign-ups and sign-ins | `30` por 5 minutos por IP |
| Authentication → Providers → Email → Prevent use of leaked passwords | Desactivado. No disponible en Free. |

### App — complejidad de contraseña (enmienda)

```ts
// lib/auth/schemas.ts
// Same rule as the dashboard's "Password requirements" (spec 21). Symbols are
// Supabase's exact list, so "ñ" or a space does not count as a symbol.
export const PASSWORD_SYMBOLS = /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/;
export const passwordSchema = z
  .string()
  .min(8)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(PASSWORD_SYMBOLS);

// signInSchema keeps z.string().min(8): existing passwords must still sign in.
export const signUpSchema = signInSchema.extend({ username: usernameSchema, password: passwordSchema });
```

| Clave en `lib/auth/messages.ts` | Mensaje | Cuándo |
| ------------------------------- | ------- | ------ |
| `passwordRules` (reemplaza a `passwordTooShort`) | `MÍNIMO 8 CARACTERES CON MAYÚSCULA, MINÚSCULA, NÚMERO Y SÍMBOLO` | Zod rechaza el campo `password` del registro, o Supabase responde `weak_password` |

---

## Plan de implementación

1. **Verificar el dashboard (manual):**
   - contraseña mínima = 8;
   - rate limit de sign-ups + sign-ins = 30 / 5 min (se fija si tiene otro valor);
   - se confirma que leaked password protection no está disponible en el plan Free.

   El sitio no cambia.
2. **Migración `restrict_rls_auto_enable`:** se escribe el archivo y se aplica con el MCP `apply_migration`, con el mismo SQL. Probes (en un bloque `DO` con `raise exception` al final, para que haga rollback):
   - `has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')` → `false`, y lo mismo para `authenticated`;
   - `create table public.spec21_probe (id int)` → `relrowsecurity = true` (el trigger `ensure_rls` sigue andando).

   Después se corren los advisors de seguridad: desaparecen los dos warnings de `rls_auto_enable`.
3. **Probe de RLS (sin cambios):** consulta a `pg_class` → `relrowsecurity = true` en `games`, `scores` y `profiles`.
4. **Headers en `next.config.ts`:**
   - se leen las guías de Next 16;
   - se agregan `securityHeaders`, `headers` y `poweredByHeader: false`.

   Verificación: `curl -sI localhost:3000/` muestra los cinco headers y no muestra `X-Powered-By`.
5. **Complejidad de contraseña en la app (enmienda):**
   - en `lib/auth/schemas.ts`, `passwordSchema` y `signUpSchema` con ese password (`signInSchema` no cambia);
   - en `lib/auth/messages.ts`, `passwordRules` reemplaza a `passwordTooShort`;
   - en `app/login/actions.ts`, `FIELD_MESSAGES.password` y el caso `weak_password` usan `passwordRules`.

   Verificación: registrarse con `contraseñalarga123` muestra `passwordRules` sin llamar a Supabase.
6. **`CLAUDE.md`:**
   - en *Architecture*, una línea sobre los headers de `next.config.ts`;
   - en *Data layer*, la revocación de `rls_auto_enable` y el trigger `ensure_rls` (creado por el dashboard, fuera de las migraciones);
   - en *Session*, el rate limit (30 / 5 min, global en la práctica por las Server Actions), la leaked password protection desactivada por el plan Free y la regla de complejidad (dashboard + `passwordSchema`).
7. **Commit con staging parcial:** `git add -p next.config.ts` toma solo los hunks de headers y `poweredByHeader`. `allowedDevOrigins` queda sin stagear.

---

## Criterios de aceptación

**Headers**

- [ ] `curl -sI localhost:3000/` devuelve `X-Content-Type-Options: nosniff`.
- [ ] La misma respuesta devuelve `X-Frame-Options: DENY`.
- [ ] La misma respuesta devuelve `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] La misma respuesta devuelve `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- [ ] La misma respuesta devuelve `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- [ ] Ninguna respuesta incluye `X-Powered-By`.
- [ ] Los mismos cinco headers aparecen en `/games/snake/play`, en `/api/health/supabase` y en un asset de `/_next/static/`.
- [ ] `/`, `/games`, `/games/snake/play`, `/login`, `/hall-of-fame` y `/about` cargan sin errores nuevos en la consola.
- [ ] Un juego se puede jugar y guardar un score.
- [ ] El login con email, con Google y con GitHub sigue funcionando (el redirect al provider y el callback no se ven afectados por `Referrer-Policy`).
- [ ] Un `<iframe src="http://localhost:3000/">` en otra página no renderiza el sitio (`X-Frame-Options: DENY`).

**Supabase**

- [ ] `has_function_privilege` da `false` para `anon` y `authenticated` sobre `public.rls_auto_enable()`.
- [ ] Una tabla nueva en `public` creada dentro del probe queda con `relrowsecurity = true`.
- [ ] Los advisors de seguridad no reportan `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable`.
- [ ] El único advisor de seguridad restante es `auth_leaked_password_protection` (riesgo aceptado).
- [ ] `games`, `scores` y `profiles` tienen `relrowsecurity = true`.
- [ ] Un signup directo a `/auth/v1/signup` con `abc1234` devuelve `weak_password` y no crea ningún usuario.
- [ ] En `/login` → CREAR CUENTA, `Abc12!x` (7 caracteres) muestra `MÍNIMO 8 CARACTERES CON MAYÚSCULA, MINÚSCULA, NÚMERO Y SÍMBOLO`.
- [ ] En el mismo form, `contraseñalarga123` muestra el mismo mensaje y no se crea ningún usuario.
- [ ] Registrarse con `Arcade#2026` funciona y termina en `/games`.
- [ ] Un usuario existente con una contraseña que no cumple la nueva regla sigue pudiendo iniciar sesión.
- [ ] Auth → Rate Limits muestra 30 sign-ups + sign-ins por 5 minutos.

**Repo**

- [ ] `npm run lint` termina sin errores.
- [ ] El diff commiteado de `next.config.ts` no contiene `allowedDevOrigins`.
- [ ] `CLAUDE.md` documenta los headers, la revocación, el rate limit, la leaked password protection desactivada y la regla de complejidad.
- [ ] `rg passwordTooShort` no devuelve nada en `app/`, `lib/` ni `components/`.

---

## Decisiones

- **D1 — Sí: los 3 headers del checklist + `Permissions-Policy` + HSTS + `poweredByHeader: false`.** El sitio no usa iframes ni cámara, micrófono o geolocalización, así que ninguno rompe funcionalidad. **No:** solo los 3 del checklist, que deja afuera dos headers baratos. **No:** sumar CSP acá, porque con Next 16 necesita nonces en el proxy y render dinámico (va en su propio spec).
- **D2 — Sí: HSTS con `max-age=31536000; includeSubDomains`, sin `preload`.** Es el valor estándar. En `http://localhost` el navegador lo ignora, así que no afecta el desarrollo. **No:** `preload`, porque es difícil de revertir y todavía no hay dominio. **No:** postergar HSTS, porque declararlo ya no cuesta nada.
- **D3 — Sí: los headers van en `next.config.ts` con `source: "/(.*)"`.** Cubren también los estáticos y las APIs. **No:** setearlos en `proxy.ts`, porque su `matcher` excluye los estáticos y sumaría trabajo a cada request.
- **D4 — Sí: `X-Frame-Options: DENY`.** Nadie embebe el sitio. **No:** `SAMEORIGIN`, porque el sitio tampoco se embebe a sí mismo. **No:** `frame-ancestors` de CSP, que queda para el spec de CSP.
- **D5 — Sí: revocar `EXECUTE` de `rls_auto_enable` con una migración**, igual que `restrict_handle_new_user` en la SPEC 19. El trigger `ensure_rls` se conserva. **No:** mover la función a un schema privado, porque hay que recrear el trigger que gestiona el dashboard. **No:** borrar la función y el trigger, porque perdemos la red que activa RLS en tablas nuevas.
- **D6 — Sí: rate limit de sign-ups + sign-ins en 30 / 5 min** (el default, ahora explícito y verificado). Como hoy actúa como global, bajarlo podría bloquear jugadores legítimos en un pico. **No:** 10 / 5 min, demasiado agresivo para un límite global. **No:** limitador propio por IP o CAPTCHA, que quedan para el spec de deploy.
- **D7 — Sí: leaked password protection queda como riesgo aceptado.** El plan Free no la incluye. **No:** pasar a Pro solo por esto. **No:** consultar HaveIBeenPwned desde una Server Action propia, porque es una integración externa más para un sitio que hoy vive en localhost.
- **D8 — Sí: el pre-account takeover queda fuera.** La confirmación de email necesita SMTP y un flujo nuevo. Sigue siendo **bloqueante de deploy** (riesgo de la SPEC 20). **No:** desactivar el linking automático acá, porque contradice D4 de la SPEC 20 sin resolver la causa.
- **D9 — Sí: staging parcial de `next.config.ts`.** Mantiene la regla de no commitear `allowedDevOrigins` sin cambiar cómo se configura. **No:** moverlo a una variable de entorno, que es scope extra fuera del checklist.
- **D10 — Sí: RLS y contraseña mínima se verifican pero no se tocan.** Ya estaban hechos por las SPEC 06 y 19.
- **D11 — Sí (enmienda): se mantiene la complejidad del dashboard y la app la replica en `signUpSchema`.** Validar antes de llamar a Supabase da un mensaje veraz y ahorra un intento contra el rate limit global (D6). La lista de símbolos es la misma que la de Supabase, para que la app no apruebe lo que Supabase rechaza. **No:** apagar la complejidad, porque sube la seguridad sin costo en el plan Free. **No:** validar solo en Supabase, porque el usuario vería un mensaje sobre el largo cuando el problema son los caracteres.
- **D12 — Sí (enmienda): un solo mensaje con la regla completa** (`passwordRules`), tanto para Zod como para `weak_password`. Dice todo lo que hace falta de una vez. **No:** distinguir `length` de `characters` con dos mensajes, porque es más código para el mismo resultado. **No:** cambiar `signInSchema`, porque bloquearía a los usuarios con contraseñas previas a la regla, que Supabase sigue aceptando al iniciar sesión.

---

## Riesgos identificados

| Riesgo | Mitigación |
| ------ | ---------- |
| **El rate limit "por IP" de Supabase es global en la práctica.** `signUp`/`signIn` salen desde el server de Next con una sola IP, así que un bot puede agotar los 30 intentos y bloquear los logins legítimos durante 5 minutos. | Se acepta mientras el sitio esté en localhost. Queda documentado en `CLAUDE.md`. El spec de deploy tiene que sumar CAPTCHA o un limitador propio por IP del cliente. |
| **Leaked password protection desactivada** (plan Free). Se pueden usar contraseñas filtradas de 8 o más caracteres. | Riesgo aceptado (D7). El advisor va a seguir apareciendo y está documentado como esperado. Se reevalúa si el proyecto pasa a Pro. |
| **Pre-account takeover** (heredado de la SPEC 20). | Fuera de alcance (D8). Sigue bloqueando el deploy a producción. |
| Si alguien vuelve a togglear "auto-enable RLS" en el dashboard, se puede recrear `rls_auto_enable` con los grants por defecto. | Los advisors de seguridad lo detectan. La migración es idempotente y se puede volver a aplicar. |
| La revocación podría cortar el event trigger si Postgres chequeara `EXECUTE` al dispararlo. | El probe del paso 2 crea una tabla y verifica `relrowsecurity = true` antes de dar el paso por cerrado. |
| HSTS en un futuro dominio fija HTTPS por un año, también en los subdominios. | Sin `preload`, se revierte sirviendo `max-age=0`. Se revisa en el spec de deploy. |
| Commitear `allowedDevOrigins` por error al stagear `next.config.ts` completo. | Paso 6 con `git add -p` y un criterio de aceptación que revisa el diff. |

---

## Lo que **no** entra en esta spec

- Content-Security-Policy (nonces, `frame-ancestors`).
- Confirmación de email, SMTP propio o desactivar el linking automático.
- CAPTCHA o rate limit propio por IP del cliente.
- Activar leaked password protection o pasar a Pro.
- Forzar el cambio de contraseña a los usuarios existentes, o un indicador de fortaleza en vivo.
- HSTS `preload` y la configuración de un dominio de producción.
- `allowedDevOrigins` desde una variable de entorno.

Cada uno de estos, si se hace, va en su propio spec.
