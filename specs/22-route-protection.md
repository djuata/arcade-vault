# SPEC 22 — Protección de rutas en el proxy

> **Status:** Approved
> **Depends on:** SPEC 19 (supabase-auth), SPEC 20 (oauth-google-github)
> **Date:** 2026-10-13
> **Objective:** Agregar a `proxy.ts` un control de acceso optimista por ruta, con una lista de rutas protegidas (requieren sesión) y otra de rutas solo para invitados (echan a quien tiene sesión), sin reemplazar los chequeos de las páginas ni la RLS.

---

## Por qué existe esta spec

Durante la SPEC 21 se pidió "protección de rutas con middleware". Estado del código el 2026-10-13:

1. **En Next 16 el middleware se llama `proxy.ts`, y ya existe.** `proxy.ts` → `updateSession()` en `lib/supabase/proxy.ts`:
   - refresca el token en cada request;
   - manda a `/login/nombre` a quien tiene sesión y no tiene profile (SPEC 20, D2).
2. **El acceso por sesión hoy vive solo en las páginas:**
   - `app/login/page.tsx:11` redirige a `/games` si hay sesión;
   - `app/login/nombre/page.tsx:30` redirige a `/login` si no la hay.

   No hay un lugar central que diga qué ruta requiere qué.
3. **Hoy no existe ninguna ruta privada de producto.** `CLAUDE.md`: *"Login is optional; no route is protected"*. Jugar, rankings y "Acerca de" son públicos, y eso **no cambia**.
4. **El proxy no es una frontera de seguridad.** `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md:29` dice que no debe usarse *"as a full session management or authorization solution"*: sirve para chequeos **optimistas**. El CVE-2025-29927 permitía saltearse el middleware con un header. Por eso la defensa es en capas:
   - el **proxy** redirige (UX);
   - las **páginas y Server Actions** vuelven a chequear;
   - la **RLS** es la llave real.

Esta spec deja el mecanismo central probado con los dos casos reales que hay hoy, listo para una futura página de cuenta.

---

## Alcance

**Dentro:**

- **Nuevo módulo puro `lib/auth/route-access.ts`:**
  - `PROTECTED_PATHS = ["/login/nombre"]`: requieren sesión y matchean exacto **o** subárbol (`/x` y `/x/...`, pero no `/xy`);
  - `GUEST_ONLY_PATHS = ["/login"]`: solo para invitados y matchean **exacto**, para no atrapar `/login/nombre`;
  - `getRouteAccess(pathname)` → `"protected" | "guest-only" | "public"`.
- **`updateSession()` en `lib/supabase/proxy.ts`**, después de `getClaims()` y en este orden:
  1. sin sesión + `protected` → redirige a `/login`;
  2. gate de profile de la SPEC 20, sin cambios;
  3. con sesión + `guest-only` → redirige a `/games`.

  Todos los redirects copian las cookies refrescadas (`redirectWithCookies`, que ya existe).
- **Los chequeos de las páginas se mantienen** (defensa en profundidad): `app/login/page.tsx` y `app/login/nombre/page.tsx` quedan como están.
- `CLAUDE.md` (sección *Session*): se describen el control de acceso, las dos listas y que el proxy es optimista.

**Fuera de alcance (specs futuras):**

- **Exigir login para jugar o para cualquier ruta de producto.** Sería un cambio de producto que rompe el modo invitado de la SPEC 19.
- La página de cuenta (`/cuenta`) y cualquier otra ruta privada nueva. Cuando exista, se agrega a `PROTECTED_PATHS`.
- Volver a la página de origen después del login (`?next=`). Ya se descartó en D5 de la SPEC 20 por el riesgo de open redirect.
- Roles o permisos (admin, moderación).
- Proteger `/api/*` en el proxy. Las APIs actuales son públicas.
- Los headers y los advisors de la SPEC 21.

---

## Modelo de datos

Esta spec no agrega tablas, columnas ni tipos de Supabase.

```ts
// lib/auth/route-access.ts — pure, no I/O, no Next imports
export type RouteAccess = "protected" | "guest-only" | "public";

// Need a session. Match the path itself and its subtree ("/x", "/x/..."), never "/xy".
export const PROTECTED_PATHS = ["/login/nombre"] as const;

// Only for visitors without a session. Exact match ("/login" must not catch "/login/nombre").
export const GUEST_ONLY_PATHS = ["/login"] as const;

export function getRouteAccess(pathname: string): RouteAccess;
```

Destinos de los redirects:

| Caso | Destino |
| ---- | ------- |
| Sin sesión en una ruta `protected` | `/login` |
| Con sesión y sin profile (SPEC 20, sin cambios) | `/login/nombre` |
| Con sesión y con profile en una ruta `guest-only` | `/games` |

---

## Plan de implementación

1. **Crear `lib/auth/route-access.ts`** con las dos listas y `getRouteAccess`. Todavía no lo usa nadie, así que el sitio no cambia.
2. **Rama de rutas protegidas en `updateSession()`:** sin `userId` y con `getRouteAccess(pathname) === "protected"` → `redirectWithCookies(request, response, "/login")`. Verificación: `curl -sI localhost:3000/login/nombre` sin cookies devuelve un redirect con `location: /login`.
3. **Rama de rutas guest-only en `updateSession()`**, **después** del gate de profile:
   - con `userId` y `getRouteAccess(pathname) === "guest-only"` → `redirectWithCookies(request, response, "/games")`;
   - si va después del gate, un usuario sin profile que abre `/login` va directo a `/login/nombre`, en un solo redirect.

   Verificación manual en el navegador, con sesión: escribir `/login` en la barra termina en `/games`.
4. **`CLAUDE.md`, sección *Session*:**
   - el control de acceso en el proxy (las dos listas en `lib/auth/route-access.ts`);
   - que es **optimista** y que las páginas, las Server Actions y la RLS siguen chequeando;
   - se reemplaza *"no route is protected"* por *"no product route is protected; login stays optional"*.

---

## Criterios de aceptación

**Rutas protegidas**

- [ ] Sin sesión, `curl -sI localhost:3000/login/nombre` devuelve un redirect con `location` que termina en `/login`.
- [ ] Sin sesión, abrir `/login/nombre` en el navegador termina en `/login` sin error.
- [ ] Con sesión y sin profile, `/login/nombre` carga la pantalla "ELIGE TU NOMBRE" (sin redirect loop).
- [ ] Con sesión y con profile, `/login/nombre` termina en `/games` (el gate de la página sigue vigente).

**Rutas guest-only**

- [ ] Con sesión y con profile, escribir `/login` en la barra termina en `/games`.
- [ ] Con sesión y sin profile, escribir `/login` en la barra termina en `/login/nombre` en un solo redirect (sin pasar por `/games`).
- [ ] Sin sesión, `/login` carga el formulario normalmente.

**Regresión**

- [ ] Sin sesión, `/`, `/games`, `/games/snake`, `/games/snake/play`, `/hall-of-fame` y `/about` cargan sin redirect (login opcional).
- [ ] Como invitado se puede jugar y guardar un score con nombre libre.
- [ ] Las rutas que solo comparten prefijo no se protegen: sin sesión, `/login/nombrex` no redirige a `/login` (responde 404).
- [ ] El login con email, el registro, y el login con Google y GitHub siguen terminando en `/games` (o en `/login/nombre` para un usuario OAuth nuevo).
- [ ] `/auth/callback` sin `code` sigue terminando en `/login?error=oauth`.
- [ ] Después de varias navegaciones seguidas con sesión, la sesión se mantiene (los redirects copian las cookies).
- [ ] `curl localhost:3000/api/health/supabase` devuelve `{ ok: true }`.
- [ ] `app/login/page.tsx` y `app/login/nombre/page.tsx` mantienen sus chequeos de sesión.

**Repo**

- [ ] `npm run lint` termina sin errores.
- [ ] `lib/auth/route-access.ts` no importa nada de `next/*` ni de Supabase.
- [ ] `CLAUDE.md` describe el control de acceso del proxy y aclara que es optimista.

---

## Decisiones

- **D1 — Sí: el control vive en `proxy.ts` / `updateSession()`, que ya existe.** Corre en cada request, ya lee los claims y ya tiene `redirectWithCookies`. **No:** un archivo `middleware.ts`, que en Next 16 se renombró a `proxy.ts`.
- **D2 — Sí: el proxy es un chequeo optimista, y las páginas mantienen sus chequeos.** Si el proxy se saltea (como con el CVE-2025-29927) o cambia el `matcher`, la página sigue protegida, y la RLS sigue siendo la frontera real. **No:** sacar los chequeos de las páginas, porque todo quedaría en una capa que la propia doc de Next llama "optimista".
- **D3 — Sí: `PROTECTED_PATHS = ["/login/nombre"]`.** Es el único caso real que hoy requiere sesión, y deja el mecanismo verificable. **No:** una lista vacía, porque no se podría verificar.
- **D4 — Sí: el login sigue siendo opcional para jugar.** **No:** proteger `/games/[id]/play`, porque es un cambio de producto que rompe el modo invitado de la SPEC 19.
- **D5 — Sí: `PROTECTED_PATHS` matchea exacto + subárbol con `/`, y `GUEST_ONLY_PATHS` matchea exacto.** `/cuenta` cubriría `/cuenta/x` pero no `/cuentas`, y `/login` no atrapa `/login/nombre`. **No:** `startsWith` sin `/`, porque `/login` atraparía `/login/nombre` y `/loginx`. **No:** solo exacto en las protegidas, porque habría que listar cada subruta a mano.
- **D6 — Sí: las listas en un módulo puro `lib/auth/route-access.ts`**, separado del cliente de Supabase. Es la misma idea que `lib/auth/profiles.ts`: lógica compartible y fácil de testear cuando haya un test runner. **No:** dejarlas inline en `lib/supabase/proxy.ts`, que mezclaría reglas de acceso con infraestructura.
- **D7 — Sí: el gate de profile corre antes que la rama guest-only.** Un usuario sin profile que abre `/login` llega a `/login/nombre` en un solo redirect. **No:** guest-only primero, porque sumaría un salto `/login` → `/games` → `/login/nombre`.
- **D8 — Sí: sin `?next=`.** Después del login se va siempre a `/games`, como en D5 de la SPEC 20. **No:** recordar la ruta de origen, porque hay que validarla contra open redirect y hoy solo hay una ruta protegida.
- **D9 — Sí: spec separada de la SPEC 21.** La 21 es el checklist básico (headers + advisors). Esta toca el flujo de sesión y tiene sus propias decisiones.

---

## Riesgos identificados

| Riesgo | Mitigación |
| ------ | ---------- |
| Creer que el proxy "asegura" una ruta y no chequear en la página o en la action de una ruta privada futura. | D2 queda documentado en `CLAUDE.md`. Toda ruta nueva en `PROTECTED_PATHS` tiene que chequear la sesión también en su página, sus Server Actions y su RLS. |
| Redirect loop entre `/login` y `/login/nombre`. | `/login/nombre` es `protected` y no `guest-only`, `/login` matchea exacto, y el gate de profile exenta `/login/nombre`. Hay criterios para los dos estados de sesión. |
| Un redirect que no copie las cookies refrescadas haría perder la sesión. | Todos los redirects usan `redirectWithCookies`. Hay un criterio de navegaciones seguidas. |
| El proxy redirige también los POST: una Server Action posteada a `/login` con sesión (por ejemplo, desde otra pestaña ya logueada) recibe un redirect en vez de ejecutarse. | Es aceptable: con sesión no hay nada que hacer en `/login`, y la página termina en `/games`. Es el mismo comportamiento que el gate de profile de la SPEC 20. |
| Un cambio futuro del `matcher` de `proxy.ts` podría dejar rutas fuera del control. | Las páginas mantienen sus chequeos (D2). |

---

## Lo que **no** entra en esta spec

- Exigir login para jugar o para ver rankings.
- La página de cuenta u otras rutas privadas nuevas.
- `?next=` / volver a la página de origen.
- Roles y permisos.
- Proteger `/api/*` en el proxy.
- Headers de seguridad y advisors (SPEC 21).

Cada uno de estos, si se hace, va en su propio spec.
