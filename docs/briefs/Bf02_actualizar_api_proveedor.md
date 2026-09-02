# Bf-02 — Alinear el front al rename `abogado` → `proveedor` del API

Brief para Claude Code. Esta mini-brecha cierra el front después de que el
backend cerró B-05 + B-08. Necesario porque hoy `dev-asistencia.onrender.com`
responde con 404 a `/api/v1/catalogos/abogados` y el dashboard rompe el
`Promise.all`.

Trabajo sobre `/Users/sergioj/Documents/Claude/Projects/Kogu Asistencia/kogu-asistencias-web`
(repo `https://github.com/sergio0989/asistencia_kogu_front`).

---

## Control de avance

| Brecha | Descripción                                                | Estado    | Fecha | Commit | Notas |
|--------|------------------------------------------------------------|-----------|-------|--------|-------|
| Bf-02  | Front consume `/proveedor` y `proveedor_*` en vez de viejos | Pendiente |       |        |       |

---

## Contexto

El backend en `main` (commit `a15ed62`) ya no expone:

- `POST /api/v1/asistencias/:id/abogado` (ahora `/proveedor`).
- `GET /api/v1/catalogos/abogados` (eliminado).
- Campo `abogado_id` en body (ahora `proveedor_id`).
- Alias `abogado_nombre`/`abogado_tel`/`abogado_email` en JSON (ahora `proveedor_*`).
- KPI `sin_abogado` (ahora `sin_proveedor`).

El front sigue consumiendo los viejos en `dashboard.js`, `bandeja.js`,
`detalle.js`, `asistencias.service.js` y `catalogos.service.js`. Eso causa el
404 que se ve hoy en `cotizador.kogu.ink/dashboard.html` y rompe la carga
del dashboard completo.

## Principio de diseño

Solo cambia el **consumo del API** (endpoints, claves del JSON de respuesta,
nombres de campos en el body). **Las etiquetas UX visibles para el usuario
final ("Abogado", "Sin abogado", "Asignar abogado") se mantienen** porque
"Abogado" es la etiqueta de la vertical legal — concepto de producto, no
término técnico del backend. Igual con los IDs del DOM, las clases CSS y los
nombres de archivo.

## Alcance — SÍ

1. `js/services/asistencias.service.js`: renombrar `asignarAbogado` →
   `asignarProveedor`, cambiar ruta y body.
2. `js/services/catalogos.service.js`: eliminar la función que consume
   `/catalogos/abogados`.
3. `js/pages/dashboard.js`: reemplazar la llamada a `catalogosService.getAbogados()`
   por `proveedoresService.listar({ todos: 1, limit: 4 })`, renombrar
   `renderTopAbogados` → `renderTopProveedores`, actualizar las claves
   `sin_abogado` → `sin_proveedor` y `abogado_nombre` → `proveedor_nombre` en
   las lecturas del response.
4. `js/pages/bandeja.js`: actualizar `kpis.sin_abogado` → `kpis.sin_proveedor`
   y `r.abogado_nombre` → `r.proveedor_nombre`. Reordenar los URL params: el
   front pasa a leer y escribir `proveedor_id` como nombre canónico
   (mantener compat de lectura para `abogado_id` por URLs viejas: si llega,
   mapearlo a `proveedor_id`).
5. `js/pages/detalle.js`: actualizar las claves
   `e.abogado_nombre`/`tel`/`email` → `e.proveedor_*`.

## Alcance — NO

- No cambiar el HTML de las pantallas (IDs como `abogado-nombre`,
  `kpi-sin-abogado`, `lista-abogados`, `modal-abogado`, `top-abogados-list`,
  `btn-asignar-abogado` se mantienen — son IDs del DOM, no contratos del API).
- No cambiar las clases CSS (`abogado-card`, `abogado-avatar`, etc.).
- No cambiar los textos UX visibles ("Asignar abogado", "Sin abogado",
  "Top abogados", "Requiere abogado inmediato"). Son etiquetas de la
  vertical legal, intencionales.
- No tocar `js/utils/auth.guard.js` (el mapping `abogado: 'Abogado'` es del
  rol, legítimo).
- No tocar `sidebar.js` (sus paths ya son correctos).
- No tocar `proveedores.service.js` (`listar` ya existe y funciona).

---

## 1. `js/services/asistencias.service.js`

Reemplazar la función `asignarAbogado` por `asignarProveedor`:

```js
// Antes (líneas ~38-40):
//   // ─── Asignar abogado ────────────────────────────
//   async asignarAbogado(id, abogado_id) {
//     return api.post(`/asistencias/${id}/abogado`, { abogado_id });
//   },

// Ahora:
  // ─── Asignar proveedor ──────────────────────────────────────────────────────
  async asignarProveedor(id, proveedor_id) {
    return api.post(`/asistencias/${id}/proveedor`, { proveedor_id });
  },
```

> Mantener el comentario "Asignar proveedor" en clave técnica. Si en algún
> consumidor (p. ej. `detalle.js`) se invoca `asistenciasService.asignarAbogado`,
> renombrarlo también ahí al `asignarProveedor`.

## 2. `js/services/catalogos.service.js`

Eliminar completamente la función que llama a `/catalogos/abogados`
(línea ~111), incluyendo su entrada en el objeto/exports del servicio. El
módulo `catalogos` del front ya no necesita exponer `getAbogados`.

## 3. `js/pages/dashboard.js`

Tres cambios:

**(a) Promise.all (línea ~32):** reemplazar la llamada a abogados por
proveedores y extraer `.data` (la API devuelve `{ data: [...], meta: {...} }`).

```js
// Antes:
// const [kpis, recientes, criticos, abogados, porCanal] = await Promise.all([
//   asistenciasService.getKpis(),
//   asistenciasService.listar({ limit: 8, page: 1 }),
//   asistenciasService.listar({ nivel_urgencia: 'critico', estatus_macro: 'activo', limit: 5, page: 1 }),
//   catalogosService.getAbogados(),
//   ...
// ]);

// Ahora:
const [kpis, recientes, criticos, proveedoresResp, porCanal] = await Promise.all([
  asistenciasService.getKpis(),
  asistenciasService.listar({ limit: 8, page: 1 }),
  asistenciasService.listar({ nivel_urgencia: 'critico', estatus_macro: 'activo', limit: 5, page: 1 }),
  proveedoresService.listar({ todos: 1, limit: 4 }),
  // ...
]);
const proveedores = proveedoresResp?.data ?? [];
```

**(b) Llamada al renderer (línea ~44):**

```js
// Antes: renderTopAbogados(abogados || []);
// Ahora: renderTopProveedores(proveedores);
```

**(c) Claves del response (líneas ~62, 141, 145, 146):**

```js
// Línea ~62:
// setEl('kpi-sin-abogado',  k.sin_abogado        ?? '—');
// → cambiar la clave del JSON, el ID del DOM se queda igual:
setEl('kpi-sin-abogado',  k.sin_proveedor      ?? '—');

// Línea ~141:
// const sinAbogado = !r.abogado_nombre;
// →
const sinAbogado = !r.proveedor_nombre;

// Líneas ~145-146:
// : `${r.abogado_nombre} · ${fmt.estatus(r.estatus_operativo).label}`;
// →
: `${r.proveedor_nombre} · ${fmt.estatus(r.estatus_operativo).label}`;
```

**(d) Función renderer (líneas ~160-167):** renombrar
`renderTopAbogados(abogados)` → `renderTopProveedores(proveedores)`. El
shape del item del array de proveedores incluye `nombre`, `email`,
`telefono` (ver `proveedores.service.js`). Si la lógica original mostraba
"carga" (cantidad de asistencias asignadas), reemplázala por mostrar el
nombre + correo o teléfono, lo que tenga el shape disponible. Si la sección
queda sin un dato útil, deja una versión mínima funcional sin inventar
campos.

> El ID del contenedor `top-abogados-list` se mantiene (es UX).

## 4. `js/pages/bandeja.js`

**(a) URL params (líneas ~26-28):** unificar a `proveedor_id` como canónico,
manteniendo compat de lectura:

```js
// Antes:
// if (params.get('abogado_id'))   state.filtros.abogado_id  = params.get('abogado_id');
// if (params.get('proveedor_id')) state.filtros.abogado_id  = params.get('proveedor_id');

// Ahora:
if (params.get('proveedor_id')) state.filtros.proveedor_id = params.get('proveedor_id');
else if (params.get('abogado_id')) state.filtros.proveedor_id = params.get('abogado_id'); // compat URL viejas
```

Renombrar el campo de estado de `state.filtros.abogado_id` a
`state.filtros.proveedor_id` en TODAS las apariciones del archivo
(incluyendo dónde se usa para construir el query y dónde se limpia el filtro
en líneas ~270, ~274). La query que se envía al API debe usar `proveedor_id`.

**(b) Banner informativo (líneas ~30-38):** mantener la lógica, solo
ajustar el nombre de la variable y el chequeo. El texto visible puede
quedarse igual ("Mostrando casos del proveedor seleccionado" cuando aplica).

**(c) Claves del response (líneas ~96, ~158, ~178-179):**

```js
// Línea ~96:
// setEl('kpi-sin-asignar',  kpis.sin_abogado        ?? '—');
// →
setEl('kpi-sin-asignar',  kpis.sin_proveedor      ?? '—');

// Línea ~158:
// const sinAb  = !r.abogado_nombre;
// →
const sinAb  = !r.proveedor_nombre;

// Líneas ~178-179:
// <td style="font-size:12px">${r.abogado_nombre
//   ? `<span style="color:#0f172a;font-weight:600">${r.abogado_nombre}</span>`
// →
<td style="font-size:12px">${r.proveedor_nombre
  ? `<span style="color:#0f172a;font-weight:600">${r.proveedor_nombre}</span>`
```

**(d) Limpieza de URL (líneas ~270, ~274):**

```js
// Antes:
// state.filtros.abogado_id = '';
// url.searchParams.delete('abogado_id');

// Ahora:
state.filtros.proveedor_id = '';
url.searchParams.delete('proveedor_id');
url.searchParams.delete('abogado_id'); // limpiar también compat
```

El ID del banner `filtro-abogado-banner` puede mantenerse (es UX/DOM).

## 5. `js/pages/detalle.js`

**Claves del response (líneas ~77-83):**

```js
// Antes:
// setEl('abogado-nombre', e.abogado_nombre || '—');
// setEl('abogado-tel',    e.abogado_tel ? fmt.telefono(e.abogado_tel) : '—');
// setEl('abogado-email',  e.abogado_email || '—');
// const av = document.getElementById('abogado-avatar-letra');
// if (av && e.abogado_nombre) av.textContent = e.abogado_nombre.charAt(0).toUpperCase();

// Ahora (los IDs del DOM se quedan, solo cambian las claves del response):
setEl('abogado-nombre', e.proveedor_nombre || '—');
setEl('abogado-tel',    e.proveedor_tel ? fmt.telefono(e.proveedor_tel) : '—');
setEl('abogado-email',  e.proveedor_email || '—');
const av = document.getElementById('abogado-avatar-letra');
if (av && e.proveedor_nombre) av.textContent = e.proveedor_nombre.charAt(0).toUpperCase();
```

Si `detalle.js` invoca `asistenciasService.asignarAbogado` en algún lugar,
renombrar a `asignarProveedor` y cambiar el campo `abogado_id` → `proveedor_id`
en la llamada.

El resto de IDs (`btn-asignar-abogado`, `btn-asignar-abogado-2`,
`modal-abogado`, `lista-abogados`, clases CSS `abogado-card`,
`abogado-avatar`) se mantienen.

---

## Criterios de aceptación

1. `grep -rn 'abogado_id\b\|abogado_nombre\|abogado_tel\|abogado_email\|sin_abogado\|/catalogos/abogados\|/asistencias/.*abogado'`
   en `js/` no devuelve coincidencias en lecturas/escrituras del API (sigue
   habiendo IDs DOM, textos UX y rol — esos son intencionales).
2. Abriendo `cotizador.kogu.ink/dashboard.html` (o servido local) contra
   `dev-asistencia.onrender.com`:
   - La consola NO muestra el 404 a `/api/v1/catalogos/abogados`.
   - Los KPIs cargan (Casos activos, Pendientes, Cerrados este mes, etc.).
   - La tarjeta "Sin abogado" muestra un número, no `—`.
   - La sección "Top abogados" (o como haya quedado) muestra entradas.
3. En `bandeja.html`, el filtro por proveedor funciona (puede llegar por
   URL `?proveedor_id=<uuid>` y también por `?abogado_id=<uuid>` por
   compatibilidad), y la columna del proveedor muestra el nombre real.
4. En `detalle.html`, la sección de información del proveedor muestra
   nombre, teléfono y email (no `—`).
5. La acción "Asignar abogado" en el modal de detalle.html llama a
   `POST /api/v1/asistencias/:id/proveedor` con `{ proveedor_id }` y la
   respuesta es 200.

## Cómo verificar manualmente

Abrir DevTools → Network y refrescar `dashboard.html`. Sin 404s.

```javascript
// En la consola del navegador, sanity check:
fetch(`${api.baseUrl}/asistencias/kpis`, {
  headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
}).then(r => r.json()).then(j => console.log(Object.keys(j.data)));
// Debe incluir "sin_proveedor", no "sin_abogado".
```

Si tienes un expediente con proveedor asignado vía API (POST `/proveedor`),
abrir `detalle.html?id=<uuid>` y confirmar que el panel de proveedor muestra
los datos.

## Al terminar

Reporta:

- Archivos modificados con rutas completas (5 archivos JS).
- Confirmación de que el dashboard carga sin 404.
- Resultado del grep del criterio 1.
- Commit con mensaje:
  `fix(api): alinear consumo a /proveedor tras rename del backend (Bf-02)`

Push a `origin/main` cuando confirme. El deploy de `cotizador.kogu.ink`
debería refrescar automáticamente.

Detente al terminar y reporta. Verifico desde aquí antes de cualquier paso
siguiente.
