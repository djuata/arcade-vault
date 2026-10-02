# SPEC 04 — Conexión inicial a Supabase

> **Status:** Implemented
> **Depends on:** SPEC 01 (arcade-vault-mvp-visual)
> **Date:** 2026-10-01
> **Objective:** Dejar la aplicación Next.js conectada a Supabase con clientes de browser y de servidor listos para usar y un health check verificable, sin crear tablas, sin autenticación y sin tocar ninguna pantalla.

---

## Por qué existe esta spec

Hoy Arcade Vault simula tres cosas con `localStorage` y datos mock: la sesión (`av_user` en `lib/session-context.tsx`), los puntajes (`av_scores` en `components/player/GamePlayer.tsx`) y el ranking del Salón de la Fama (datos generados en `lib/games.ts`). Reemplazarlas por Supabase es el objetivo de fondo, pero es demasiado grande para una sola spec (auth + base de datos + UI de varias pantallas).

Esta spec es **solo el cimiento**: que la app pueda hablar con el proyecto Supabase y que podamos comprobarlo. Las specs siguientes (auth, puntajes, ranking) se apoyan en estos clientes sin tener que rehacer la estructura.

Decisiones ya cerradas con el usuario:

1. **Alcance mínimo:** solo conexión. Nada de tablas, migraciones, RLS ni autenticación.
2. **Librerías:** `@supabase/supabase-js` + `@supabase/ssr`, con un cliente de browser y uno de servidor — es el patrón oficial para App Router y evita rehacer la estructura cuando llegue auth con cookies.
3. **Verificación:** Route Handler `GET /api/health/supabase` que usa el cliente de servidor. Queda como health check permanente.
4. **Credenciales:** solo URL + publishable key. La `service_role` **nunca** entra al repo ni a la app en esta spec.

---

## Scope

**In:**

- Instalación de `@supabase/supabase-js` y `@supabase/ssr` con `npm install <paquete>@<versión exacta> --save-exact` (el proyecto usa `npm`/`package-lock.json`, coherente con `CLAUDE.md`). Antes de instalar, verificar con `npm info <paquete> time` la fecha de publicación de la versión elegida y **no usar una publicada hace menos de 1 día**; si la última es demasiado reciente, usar la versión estable anterior.
- `lib/supabase/client.ts`: factory `createClient()` para componentes cliente, basada en `createBrowserClient` de `@supabase/ssr`.
- `lib/supabase/server.ts`: factory asíncrona `createClient()` para Server Components y Route Handlers, basada en `createServerClient` de `@supabase/ssr` y `cookies()` de `next/headers`.
- `app/api/health/supabase/route.ts`: `GET` que crea el cliente de servidor, hace una llamada liviana que no requiere tablas (`supabase.auth.getSession()`) y responde `{ ok: true }` o un error genérico sanitizado.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, agregadas a `.env.example` (sin valores reales) y cargadas en `.env.local` por el desarrollador (no se commitea).
- Fallo claro si faltan las variables: las factories lanzan un `Error` con mensaje explícito en vez de crear un cliente roto.

**Out of scope (para specs futuras):**

- Tablas, migraciones, políticas RLS y generación de tipos TypeScript de la base (`generate_typescript_types`).
- Autenticación (login/signup, OAuth, magic link) y reemplazo de `lib/session-context.tsx`. El `localStorage` actual de sesión y puntajes **no se toca**.
- `proxy.ts` (antes `middleware.ts`) para refrescar la sesión por cookies: sin auth no hay sesión que refrescar.
- Persistencia real de puntajes y Salón de la Fama.
- Guardar los mensajes del formulario de contacto (SPEC 03) en la base.
- La `service_role` key o cualquier operación administrativa desde el servidor.
- Tests automatizados — el proyecto sigue sin test runner configurado.
- Cambios a cualquier pantalla, componente o CSS existente.

---

## Data model

Esta spec **no introduce datos persistentes**: no hay tablas ni esquemas. Introduce únicamente configuración y contratos de código:

**Variables de entorno** (documentadas en `.env.example`, sin valores reales):

- `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto Supabase (`https://<project_ref>.supabase.co`).
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key del proyecto. Es pública por diseño; su protección real será RLS en specs futuras.

**Firmas de las factories:**

```ts
// lib/supabase/client.ts
export function createClient(): SupabaseClient;

// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>;
```

**Contrato de `GET /api/health/supabase`:**

- Response `200`: `{ ok: true }` — el cliente de servidor se creó y Supabase respondió a `auth.getSession()` sin error.
- Response `500`: `{ ok: false, error: "No se pudo conectar con Supabase" }` — mensaje genérico y fijo; nunca se expone el detalle interno (URL, claves ni mensaje crudo del SDK).

---

## Implementation plan

1. **Instalar dependencias.** Verificar fecha de publicación de `@supabase/supabase-js` y `@supabase/ssr` (regla de ≥1 día); instalar con versión exacta y `--save-exact`. Dejar el sistema funcionando: la app compila igual que antes.
2. **Variables de entorno.** Agregar las dos variables a `.env.example` (valores vacíos o placeholder). El desarrollador las completa en `.env.local` con la URL y la publishable key del proyecto `iruyduvdvikmohqaiwqp` (obtenibles con el MCP de Supabase: `get_project_url` y `get_publishable_keys`). `.gitignore` ya ignora `.env*` y permite `.env.example`.
3. **Cliente de browser.** Crear `lib/supabase/client.ts` con `createBrowserClient`, validando que las variables existan.
4. **Cliente de servidor.** Crear `lib/supabase/server.ts` con `createServerClient` y `await cookies()`, implementando `getAll`/`setAll`. El `setAll` se envuelve en `try/catch` porque desde un Server Component no se pueden escribir cookies (comportamiento documentado de `@supabase/ssr`).
5. **Health check.** Crear `app/api/health/supabase/route.ts` con el contrato definido arriba, manejando tanto el `error` devuelto por el SDK como una excepción.
6. **Verificación final.** Con `npm run dev`, ejecutar `curl http://localhost:3000/api/health/supabase` y confirmar `200 { ok: true }`; quitar una variable de `.env.local` y confirmar que responde `500` con el mensaje genérico; correr `npm run lint`.

Antes de escribir código de la implementación, consultar la guía de Next.js 16 en `node_modules/next/dist/docs/` (según `AGENTS.md`) para confirmar la API de `cookies()` y de Route Handlers en esta versión.

---

## Acceptance criteria

- [ ] `package.json` lista `@supabase/supabase-js` y `@supabase/ssr` con versión exacta (sin `^` ni `~`), y `package-lock.json` está actualizado.
- [ ] Ninguna de las dos versiones instaladas fue publicada hace menos de 1 día al momento de instalarlas.
- [ ] Existen `lib/supabase/client.ts` y `lib/supabase/server.ts`, cada uno exportando `createClient`.
- [ ] `.env.example` documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores reales, y `.env.local` no aparece en `git status`.
- [ ] Con las variables correctas, `GET /api/health/supabase` responde `200` con `{ "ok": true }`.
- [ ] Sin alguna de las dos variables, `GET /api/health/supabase` responde `500` con `{ "ok": false, "error": "No se pudo conectar con Supabase" }` y el body no contiene la URL, la clave ni texto crudo del SDK.
- [ ] La `service_role` key no aparece en ningún archivo del repo ni en variables `NEXT_PUBLIC_*`.
- [ ] `git diff` no muestra cambios en `components/`, `app/globals.css` ni `lib/session-context.tsx`.
- [ ] No existe ninguna tabla ni migración creada por esta spec (`list_tables` y `list_migrations` del MCP no muestran cambios atribuibles).
- [ ] `npm run lint` termina sin errores.

---

## Decisions taken and discarded

**Tomadas:**

- **`@supabase/ssr` + `supabase-js` con dos clientes** (browser/server) en vez de un cliente único: es más código hoy (dos archivos) pero evita rehacer la estructura cuando llegue la auth con cookies. Se paga ahora una vez para no pagarlo reescribiendo después.
- **Route Handler como health check permanente** en vez de un script puntual: deja una forma repetible de diagnosticar la conexión (útil para deploy), a cambio de una superficie pública mínima que solo devuelve `ok` o un error genérico.
- **`auth.getSession()` como sonda:** es la llamada más liviana que no depende de tablas. Ojo: `getSession()` lee de cookies y puede no tocar la red; si en implementación se comprueba que no prueba conectividad real, se reemplaza por una sonda equivalente (por ejemplo `auth.getUser()` o una petición liviana al endpoint de Auth) sin cambiar el contrato público del endpoint.
- **Solo publishable key**, sin `service_role`: lo mínimo necesario; menos riesgo de filtrar una clave que saltea RLS.
- **Versiones exactas verificadas al instalar**, no fijadas en el spec: `@supabase/ssr` se publicó/modificó hace horas al momento de redactar esto y la regla del proyecto exige ≥1 día.

**Descartadas:**

- **Un único cliente `supabase-js`:** más simple hoy, pero obliga a reestructurar al sumar cookies de sesión.
- **Verificar solo con el MCP de Supabase:** no prueba que Next.js (env vars, runtime de servidor) conecte realmente.
- **Agregar `proxy.ts` ahora:** sin auth no hay sesión que refrescar; sería código muerto.
- **Crear una tabla de prueba para validar la conexión:** contradice el alcance cerrado de "sin tablas".

---

## Identified risks

- **Versión demasiado reciente:** `@supabase/ssr` puede estar dentro del umbral de 1 día. Mitigación: usar la versión estable anterior; documentar cuál se eligió.
- **`getSession()` no demuestra conectividad:** podría devolver `ok` sin haber tocado la red. Mitigación: criterio de aceptación con las variables ausentes + revisar en implementación si hace falta una sonda más fuerte (ver Decisiones).
- **Confundir publishable con secreta:** `NEXT_PUBLIC_` expone la clave al browser. Es correcto para la publishable key, pero sería grave con la `service_role`. Mitigación: criterio de aceptación explícito de que `service_role` no aparece en el repo.
- **Endpoint público de diagnóstico:** `/api/health/supabase` es accesible sin autenticación. Mitigación: responde solo `ok` o un mensaje genérico fijo, sin detalles internos.
- **Cookies en Server Components:** `cookies().set` falla fuera de Route Handlers/Server Actions. Mitigación: `try/catch` en `setAll`, patrón oficial.
