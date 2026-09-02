# Bf-08 — Bloque A (frontend): descargas, roles, paginación y doble alta

**Repo:** `sergio0989/asistencia_kogu_front`
**Origen:** auditoría 2026-09-02 — hallazgos KA-E-01 (parte front), KA-F-01, KA-F-02, KA-F-05
**Depende de:** `B2-08` en el backend, para la parte de descargas
**Estado:** abierto

Cuatro arreglos independientes entre sí. Los tres primeros son bugs que un usuario real
choca; el cuarto ensucia la base sin que nadie se entere.

---

## 1. KA-E-01 (front) — abrir un documento nunca puede funcionar

`detalle.js:721`, `cliente.js:142`, `poliza.js:167` hacen:

```js
const { url } = await servicio.getUrlDocumento(id, docId);
window.open(url, '_blank');
```

Con `STORAGE_DRIVER=local` esa URL apunta a `/api/v1/files/<key>`, **un endpoint que exige
el JWT en la cabecera `Authorization`**. `window.open` no manda cabeceras: aunque el host
sea correcto, la pestaña recibe 401. Con driver S3 la URL es prefirmada y sí abriría, pero
el front no puede saber cuál driver está activo.

Fix: **descargar con `fetch` autenticado y abrir un `blob:`**. Añadir a `js/services/api.js`
un método `getBlob(path)` que reuse el manejo de token y de refresh que ya tiene `request`
(no dupliques la lógica de `Authorization` ni el reintento con `/auth/refresh`), y un helper
compartido —`js/utils/descargas.js`— con:

```js
async function abrirDocumento(url, nombreSugerido) { … }
```

que resuelva ambos casos: si la URL es del propio API (`/api/v1/files/`), la baja con
`getBlob` y hace `URL.createObjectURL` + `window.open`; si es una URL prefirmada externa,
la abre directo. Liberar el objeto con `URL.revokeObjectURL` después.

Usarlo en los tres llamadores. **Los errores tienen que verse**: un 403 debe decir
"No tienes acceso a este documento" y un 404 "El documento ya no está disponible" con
`toast.error`, nunca un `catch` mudo — es la misma clase de fallo silencioso que originó Bf-07.

## 2. KA-F-01 — editar un usuario le borra los roles de promotoría

`usuarios/lista.html:117-121` solo tiene checkboxes para admin, supervisor, operador,
abogado y cabina. **`promotor` y `agente` no existen en el markup.** Al abrir "Editar",
`cb.checked = u.roles.includes(cb.value)` no marca esos roles, y al guardar el backend
**reemplaza el conjunto completo** con lo que llegó.

Escenario real: un usuario con `['operador','promotor']` al que el admin le corrige el
teléfono queda como `['operador']` y pierde toda la promotoría — justo los roles que
acabamos de construir. Si solo tenía `promotor`, el front bloquea con "Selecciona al menos
un rol" y el usuario queda **ineditable**.

Fix: poblar los checkboxes desde **`GET /catalogos/roles`** (ya existe, `catalogos.controller.js:70`)
en vez de escribirlos a mano. Es admin-only, y el modal de edición también lo es, así que
no hay conflicto de permisos. Añadir el servicio en `catalogos.service.js` si falta.
Actualizar igual el **filtro de rol** de `usuarios/lista.html:46-53`, al que le faltan los
mismos dos.

## 3. KA-F-02 — la paginación de Empresas y Proveedores no avanza

`js/utils/table.js` serializa el callback dentro del atributo (5 ocurrencias de
`onPage.toString()`): el handler se evalúa en ámbito global y pierde el closure.
En `catalogos/empresas.html:410` y `catalogos/proveedores.html:674` el callback captura
`rows`, que es **parámetro** de `renderTabla`, así que pulsar "2" lanza
`ReferenceError: rows is not defined` en consola, sin toast ni indicio visual: la tabla
simplemente no cambia. Además rompe cualquier minificación futura y viola CSP.

Fix: **el patrón ya está resuelto en `js/utils/picker.js`** — botones con `data-page` y un
solo `container.addEventListener('click', …)` que lee el atributo y llama a `onPage` por
referencia. Cópialo. Revisar que las demás pantallas que usan `table.renderPagination`
sigan funcionando (`bandeja`, `clientes`, `polizas`, `pipeline`, `usuarios`).

## 4. KA-F-05 — retroceder en el alta de caso crea un expediente duplicado

`js/pages/nuevo-caso.js` — `avanzarPaso()` llama a `crearExpediente()` **cada vez** que se
está en el paso 1, sin mirar si `nc.expedienteId` ya tiene valor:

Paso 1 → Siguiente (crea `AS-LEG-…-00001`) → "Anterior" → Siguiente → crea
`AS-LEG-…-00002`. Quedan expedientes huérfanos en la bandeja y se queman folios del
contador atómico.

Fix: si `nc.expedienteId` ya existe, no volver a crear — recargar el formulario dinámico y
pasar al paso 2. Si además cambiaron datos del paso 1, mandarlos con `PATCH /asistencias/:id`
en lugar de un `POST` nuevo.

Aprovechar el mismo archivo para **KA-F-10**: `guardarFormulario()` (~línea 283) traga el
error con `console.warn` y aun así avanza al paso 3 mostrando "expediente creado" — el
usuario cree que el cuestionario se guardó. Que falle visible y no avance.

---

## 5. Cierre

- `node --check` sobre cada `.js` tocado.
- Probar contra QA sirviendo la rama en **`http://localhost:5500`** (es el puerto que
  `CORS_ORIGINS` permite; el 8080 rebota) y eligiendo ambiente QA en el login.
- Recorrido mínimo: abrir un documento de un expediente y de una póliza; editar un usuario
  que tenga rol `promotor` y confirmar que lo conserva; paginar Empresas con más de 20
  registros; y en el alta de caso, avanzar, retroceder y volver a avanzar comprobando que
  **no** se crea un segundo folio.
