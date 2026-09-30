# SPEC 03 — Página About y formulario de contacto con Resend

> **Status:** Implemented
> **Depends on:** SPEC 02 (home-landing-page)
> **Date:** 2026-09-26
> **Objective:** Implementar la pantalla About en `/about` (misión, highlights y formulario de contacto), portada de `resources/templates/home-about/about.jsx`, conectando el formulario a un envío real de correo vía Resend a través de un Route Handler server-side.

---

## Por qué existe esta spec

La spec 02 dejó explícitamente afuera la pantalla About y su link en el Nav (ver su sección "Out of scope"): "La pantalla About (`about.jsx`): misión, highlights y formulario de contacto. No se toca ni se referencia desde el Nav en esta spec." Esta spec cierra ese pendiente.

A diferencia del resto de las pantallas portadas hasta ahora (spec 01 y 02), el formulario de contacto de `about.jsx` no envía nada de verdad — hace un `setSent(form.name)` optimista sin llamar a ningún backend. Esta spec reemplaza ese submit falso por un envío real usando [Resend](https://resend.com), lo que agrega una superficie nueva al proyecto: un endpoint server-side, una API key secreta, validación de inputs no confiable-por-defecto (vienen de un formulario público) y un posible camino de error real que el prototipo nunca contempló.

Decisiones ya cerradas con el usuario:

1. El envío se implementa como **Route Handler** (`app/api/contact/route.ts`), no Server Action — es el patrón que documentan oficialmente Resend y Next.js, la API key nunca sale del servidor, y queda un endpoint fácil de probar de forma aislada.
2. Se usa el **remitente sandbox de Resend** (`onboarding@resend.dev`) para este MVP. Limitación real confirmada en la documentación de Resend: sin un dominio propio verificado, ese remitente **solo puede entregar al email de la cuenta de Resend del usuario**, no a cualquier destinatario. Verificar un dominio propio queda fuera de esta spec.
3. Los inputs se validan con **Zod**, en cliente (UX) y de nuevo en el Route Handler (la validación de cliente nunca es confiable).
4. Se agrega un **honeypot simple** (campo oculto extra) como única protección anti-spam de este MVP. Rate limiting y captcha quedan fuera.

---

## Scope

**In:**

- `app/about/page.tsx` (nueva ruta): renderiza `<About />`, con su propio `metadata.title`.
- `components/about/About.tsx` ("use client"): hero de misión (`about-hero`, `about-title`, `about-mission`) + 3 highlight cards (`highlight-row`), divisor decorativo (`about-divider`) y sección de contacto (`about-contact`: intro + tips + formulario), portados 1:1 de `resources/templates/home-about/about.jsx`, salvo el envío del formulario.
- `lib/use-reveal.ts`: hook `useReveal()` extraído del `IntersectionObserver` sobre `.reveal` que hoy vive duplicado de forma inline dentro de `components/home/Home.tsx`. Se extrae porque `About.tsx` necesita exactamente la misma lógica — es la segunda vez que se repite, ya no es especulativo. `Home.tsx` pasa a importarlo también, sin cambiar su comportamiento.
- `lib/contact.ts`: `ContactFormSchema` (Zod) y el tipo `ContactFormValues` derivado, compartidos entre `About.tsx` (validación en el submit) y el Route Handler (validación server-side).
- `lib/resend.ts`: instancia única del cliente `Resend` (`new Resend(process.env.RESEND_API_KEY)`).
- `app/api/contact/route.ts`: `POST` que valida el body con `ContactFormSchema`, descarta en silencio si el campo honeypot viene con contenido, y si pasa validación llama a `resend.emails.send(...)`. Chequea explícitamente el campo `error` que devuelve el SDK (no lanza excepción) antes de responder éxito.
- Formulario en `About.tsx` con estados: `idle` (campos vacíos), error de validación (shake, igual al prototipo), `loading` (botón deshabilitado, texto "ENVIANDO…"), error de envío real (mensaje inline, conserva los valores ingresados), éxito (`terminal-success`, igual al prototipo).
- Campo honeypot oculto (`company`) en el formulario: invisible para un usuario humano (fuera de pantalla, `aria-hidden`, `tabIndex={-1}`, `autoComplete="off"`), pensado para que un bot que autocompleta formularios lo llene.
- `components/nav/Nav.tsx`: agregar el link "Acerca de" (→ `/about`) al final, antes de "Iniciar Sesión", en desktop y en el panel móvil, con su propio estado activo (`isAboutActive`, solo en `/about`).
- Clases CSS de About portadas a `app/globals.css` desde `resources/templates/home-about/styles.css`: `.about-*`, `.contact-*`, `.highlight*`, `.div-*`, `.terminal-success`, `.term-*` — las mismas que spec 02 excluyó explícitamente por no ser necesarias para Home. Se agrega además una clase nueva `.contact-error` (paleta magenta existente) para el estado de error de envío real, que no existe en el prototipo.
- `.env.example` en la raíz, documentando `RESEND_API_KEY`, `CONTACT_TO_EMAIL` y `CONTACT_FROM_EMAIL` sin valores reales.
- Ajuste a `.gitignore`: agregar `!.env.example` inmediatamente después de la línea `.env*` — hoy ese patrón también ignora `.env.example`, y ese archivo sí debe commitearse como plantilla (sin secretos).
- Instalación de `resend` y `zod` vía `npm install <paquete>@<versión exacta> --save-exact` (el proyecto usa `npm`/`package-lock.json`, no pnpm — coherente con `CLAUDE.md`). Antes de instalar, verificar fecha de publicación de cada paquete y no usar una publicada hace menos de 1 día.

**Out of scope (para specs futuras):**

- Verificación de un dominio propio en Resend para poder enviar a cualquier destinatario (hoy solo llega al email de la cuenta de Resend, por la limitación del sandbox).
- Rate limiting o captcha en el formulario — el honeypot es la única protección anti-spam de este MVP.
- Persistencia de los mensajes de contacto en cualquier base de datos — solo se envían por email, no se guardan en ningún lado.
- Plantillas de email con React Email — el cuerpo del correo es texto/HTML simple armado a mano en el Route Handler.
- Cambios a cualquier otra pantalla o lógica de negocio existente, más allá de agregar el link "Acerca de" al Nav.
- Tests automatizados de cualquier tipo — el proyecto sigue sin test runner configurado.

---

## Data model

Esta spec introduce:

**`lib/contact.ts`** — schema Zod compartido cliente/servidor:

```ts
export const ContactFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  message: z.string().trim().min(1).max(2000),
});
export type ContactFormValues = z.infer<typeof ContactFormSchema>;
```

El campo honeypot (`company`) **no** forma parte de este schema — se lee y se descarta aparte en el Route Handler, antes de correr la validación real, para no mezclar "trampa anti-bot" con "regla de negocio".

**Contrato de `POST /api/contact`:**

- Request JSON: `{ name: string, email: string, message: string, company: string }` (`company` = honeypot, debe llegar vacío).
- Response `200`: `{ ok: true }` — tanto en un envío real exitoso como cuando se descarta por honeypot (misma respuesta, para no delatarle a un bot que fue detectado).
- Response `400`: `{ ok: false, fieldErrors: Record<string, string[]> }` — viene de `error.flatten().fieldErrors` de Zod cuando la validación falla.
- Response `500`: `{ ok: false, error: "No se pudo enviar el mensaje" }` — mensaje genérico y fijo; nunca se expone el detalle interno de Resend ni del error de red (regla de seguridad: sanitizar mensajes de error).

**Variables de entorno** (documentadas en `.env.example`, sin valores reales):

- `RESEND_API_KEY` — API key de Resend, nunca se hardcodea, solo se lee vía `process.env`.
- `CONTACT_TO_EMAIL` — dirección destino del formulario. Con el sandbox de Resend, debe ser el email de la cuenta de Resend del usuario.
- `CONTACT_FROM_EMAIL` — remitente, por defecto `Arcade Vault <onboarding@resend.dev>` si la variable no está seteada.

No se introduce persistencia ninguna — el mensaje de contacto vive solo mientras dura el request al Route Handler.

---

## Implementation plan

1. Instalar `resend` y `zod` con `npm install resend@<version> zod@<version> --save-exact`, verificando antes en npmjs.com que ninguno fue publicado hace menos de 1 día. Crear `.env.example` con `RESEND_API_KEY=`, `CONTACT_TO_EMAIL=` y `CONTACT_FROM_EMAIL=` (sin valores). Agregar `!.env.example` a `.gitignore` justo después de `.env*`. Test manual: `git status` muestra `.env.example` como archivo nuevo trackeable; `.env.local` (si se crea) sigue ignorado.
2. Crear `lib/contact.ts` con `ContactFormSchema` y `ContactFormValues`. Test manual: `npm run lint` no rompe con el archivo nuevo.
3. Crear `lib/resend.ts` con la instancia única de `Resend`. Test manual: se importa sin error en el paso 4.
4. Crear `app/api/contact/route.ts`: parsear el body, chequear honeypot (`company`) y devolver `200 { ok: true }` sin llamar a Resend si viene con contenido, validar con `ContactFormSchema` (400 si falla), llamar a `resend.emails.send({ from: CONTACT_FROM_EMAIL, to: [CONTACT_TO_EMAIL], replyTo: email, subject: ..., text: ... })`, chequear el campo `error` de la respuesta del SDK (500 si viene seteado), devolver `200 { ok: true }` si salió bien. Test manual: probar los 4 casos (honeypot, validación inválida, éxito, forzar un error temporal con una `RESEND_API_KEY` inválida) con `curl` contra `/api/contact`.
5. Extraer `lib/use-reveal.ts` con el hook `useReveal()` que hoy está inline en `components/home/Home.tsx`, y actualizar `Home.tsx` para importarlo en vez de definirlo. Test manual: `/` (Home) sigue animando las secciones `reveal` igual que antes.
6. Portar a `app/globals.css` las clases de About listadas en Scope, más la clase nueva `.contact-error`. Test manual: `npm run lint` no rompe, no quedan selectores duplicados con los que ya portó spec 02.
7. Construir `components/about/About.tsx` ("use client"): estructura visual portada 1:1 de `about.jsx` (hero, highlights, divisor, intro de contacto), usando `useReveal()` de `lib/use-reveal.ts`, con el formulario reescrito para: incluir el campo honeypot oculto, validar con `ContactFormSchema` antes de enviar (shake si falla, igual al prototipo), hacer `fetch("/api/contact", { method: "POST", ... })` con estado `loading` (botón deshabilitado + "ENVIANDO…"), mostrar `.contact-error` con mensaje inline si la respuesta no es `ok` (conservando los valores del formulario), y mostrar el `terminal-success` existente si la respuesta es `ok`. Test manual: comparar visualmente contra `resources/templates/home-about/arcade-vault-standalone.html`.
8. Crear `app/about/page.tsx` renderizando `<About />` con su `metadata.title`. Test manual: `/about` muestra la pantalla completa.
9. Actualizar `components/nav/Nav.tsx`: agregar "Acerca de" (→ `/about`) al final, antes de "Iniciar Sesión", en desktop y panel móvil, con `isAboutActive`. Test manual: el link se resalta solo en `/about`, en ambos layouts.
10. Pase final de integración: configurar `.env.local` con una `RESEND_API_KEY` real y `CONTACT_TO_EMAIL` apuntando al email de la cuenta de Resend, enviar el formulario y confirmar que el correo llega; forzar un error (API key inválida) y confirmar el estado `.contact-error`; rellenar el honeypot manualmente (vía devtools) y confirmar que no llega correo pero el cliente muestra éxito; recorrer todo el Nav; correr `npm run lint`.

---

## Acceptance criteria

- [ ] `/about` muestra el hero de misión, las 3 highlight cards y el divisor decorativo, portados del prototipo.
- [ ] La sección de contacto muestra el formulario con NOMBRE, CORREO ELECTRÓNICO, MENSAJE y un campo honeypot oculto no visible ni accesible por teclado para un usuario humano.
- [ ] Enviar el formulario con algún campo vacío dispara el shake de validación sin hacer ningún `fetch` a `/api/contact`.
- [ ] Enviar el formulario con datos válidos hace `POST /api/contact`, deshabilita el botón de envío y muestra "ENVIANDO…" mientras espera la respuesta.
- [ ] Un envío exitoso muestra el `terminal-success` con el nombre del remitente, igual que el prototipo.
- [ ] Un envío exitoso real entrega un correo a `CONTACT_TO_EMAIL` vía Resend, con el nombre, email (como `replyTo`) y mensaje del formulario.
- [ ] Si `/api/contact` responde con error (400 o 500), el formulario muestra `.contact-error` con un mensaje genérico y conserva los valores ingresados.
- [ ] Si el campo honeypot llega con contenido, `/api/contact` responde `200 { ok: true }` sin llamar a Resend, y el cliente muestra el mismo `terminal-success` que un envío real.
- [ ] `/api/contact` valida el body con `ContactFormSchema` (Zod) y responde `400` si el formato es inválido (ej. email sin `@`).
- [ ] El Nav muestra "Acerca de" (→ `/about`) al final, antes de "Iniciar Sesión", en desktop y en el panel móvil; se resalta como activo solo en `/about`.
- [ ] `.env.example` documenta `RESEND_API_KEY`, `CONTACT_TO_EMAIL` y `CONTACT_FROM_EMAIL` sin valores reales, y queda trackeado por git a pesar de `.env*` en `.gitignore`.
- [ ] `Home.tsx` sigue animando sus secciones `reveal` igual que antes de extraer `lib/use-reveal.ts`.
- [ ] `npm run lint` no reporta errores.
- [ ] Ninguna ruta muestra errores en la consola del navegador al navegar a `/about` y enviar el formulario, tanto en el camino de éxito como en el de error.

---

## Decisions

- **Sí:** el envío se implementa como Route Handler (`app/api/contact/route.ts`), no Server Action. Es el patrón que documentan oficialmente Resend y Next.js, deja la API key estrictamente server-side, y es más fácil de probar de forma aislada con `curl`.
- **Sí:** se usa el remitente sandbox `onboarding@resend.dev`. Limitación aceptada y documentada: solo entrega al email de la cuenta de Resend del usuario hasta que se verifique un dominio propio — eso queda para una spec futura si hace falta enviar a otros destinatarios.
- **Sí:** validación con Zod, compartida entre cliente y Route Handler (`lib/contact.ts`). Cumple la regla de seguridad del proyecto de validar inputs antes de enviarlos al servidor, y la validación de cliente nunca sustituye la del servidor.
- **Sí:** honeypot simple como única protección anti-spam de este MVP. Costo cero, sin dependencias ni fricción para un usuario real.
- **Sí:** se extrae `lib/use-reveal.ts` a partir del hook duplicado inline en `Home.tsx`. No es abstracción especulativa — es la segunda vez real que se necesita la misma lógica exacta, y `Home.tsx` se actualiza para usarlo también.
- **Sí:** los mensajes de error que ve el usuario son genéricos y fijos (`"No se pudo enviar el mensaje"`), nunca el detalle interno de Resend o de la red — regla de seguridad del proyecto de no exponer errores internos.
- **Sí:** instalación de `resend` y `zod` con `npm` y versión exacta (`--save-exact`), coherente con que el proyecto ya usa `npm`/`package-lock.json` (`CLAUDE.md`). Migrar el proyecto entero a `pnpm` queda fuera de esta spec por alcance.
- **No:** verificación de dominio propio en Resend en esta spec — agrega configuración de DNS que no bloquea probar el flujo completo con el sandbox.
- **No:** rate limiting, captcha o cualquier protección anti-spam más allá del honeypot — se agrega en otra spec si aparece spam real.
- **No:** persistir los mensajes de contacto en ninguna base de datos — solo se envían por email.
- **No:** plantillas de email con React Email — el cuerpo del correo es texto simple armado en el Route Handler.
- **No:** tooling de testing nuevo para esta spec — mismo motivo que specs 01 y 02, no hay test runner configurado.

---

## Risks

| Riesgo | Mitigación |
| --- | --- |
| El sandbox de Resend solo entrega al email de la cuenta del usuario, no a cualquier destinatario | Se documenta como limitación conocida; `CONTACT_TO_EMAIL` debe ser esa dirección hasta que se verifique un dominio propio (fuera de esta spec). |
| La API key de Resend queda expuesta (pegada en un chat, commit accidental, log) | Nunca se hardcodea en el código — solo `process.env.RESEND_API_KEY` leído desde `.env.local` (ignorado por git); si se expone, se rota desde el dashboard de Resend. |
| El SDK de Resend no lanza excepción en error, devuelve `{ data, error }` | El Route Handler chequea explícitamente el campo `error` de la respuesta antes de responder éxito al cliente. |
| El honeypot es una protección débil ante bots sofisticados que sí completan todos los campos | Aceptado como límite conocido de este MVP; rate limiting o captcha quedan para una spec futura si aparece spam real. |
| `.env*` en `.gitignore` también ignora `.env.example`, dejándolo sin commitear por accidente | Se agrega `!.env.example` inmediatamente después de esa línea, verificado con `git status` en el paso 1 del plan. |

---

## What is **not** in this spec

- Verificación de un dominio propio en Resend.
- Rate limiting, captcha, o cualquier protección anti-spam más allá de un honeypot simple.
- Persistencia de los mensajes de contacto.
- Plantillas de email con React Email.
- Cambios a cualquier otra pantalla o lógica de negocio existente, más allá del link "Acerca de" en el Nav.
- Tests automatizados de cualquier tipo.

Cada uno de estos, si se necesita, va en su propia spec.
