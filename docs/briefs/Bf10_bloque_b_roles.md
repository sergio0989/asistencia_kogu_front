# Bf-10 — Bloque B: coherencia de roles en el front

**Repo:** `sergio0989/asistencia_kogu_front`
**Origen:** auditoría 2026-09-02 — KA-F-04, KA-F-03, KA-F-08 y el resto de KA-F-07
**Tamaño:** medio día
**Estado:** abierto

> Requiere **un cambio de una línea en el backend** (sección 5). Sin él, la parte de
> agentes no se puede cerrar.

---

## El problema de fondo

El front decide qué mostrar con listas de roles escritas a mano en `sidebar.js`, y esas
listas **no coinciden con lo que el backend realmente permite**. El resultado tiene las dos
formas posibles del mismo error: pantallas y botones ofrecidos a quien recibe 403, y
funcionalidad escondida a quien sí tiene permiso.

El caso más grave es el segundo: **el rol `abogado` hoy no llega a ninguna pantalla.**
`OPERATIVOS` (`sidebar.js:15`) no lo incluye, así que no ve la Bandeja, y `landingUrl()`
(`auth.js:11-20`) lo manda a `/dashboard.html`, que le devuelve 403. Inicia sesión y no
tiene a dónde ir — siendo el proveedor legal, el actor que sostiene la venta de la Fase 1.

---

## 1. La matriz real de permisos (verificada contra las rutas del backend)

Esta es la fuente de verdad. Cualquier lista del front debe derivarse de aquí.

| Recurso | Quién puede |
|---|---|
| `GET /asistencias` y `/asistencias/:id` | admin, supervisor, operador, **abogado**, cabina |
| `POST /asistencias` | admin, supervisor, operador, cabina |
| `PATCH /asistencias/:id` · `POST /:id/estatus` | admin, supervisor, operador |
| `POST /:id/proveedor` · `POST /:id/cerrar` | admin, supervisor |
| `POST /:id/comentario` | admin, supervisor, operador, **abogado** |
| `GET /asistencias/kpis` | admin, supervisor, operador |
| `GET /usuarios` | admin, supervisor |
| `POST /usuarios` · `PATCH /usuarios/:id` · reset password | **solo admin** |
| `GET /proveedores` | admin, supervisor, operador |
| `POST /proveedores` · `PATCH /proveedores/:id` | admin, supervisor |
| `GET /agentes` | admin, supervisor, promotor, **agente** (acotado, B2-07) |
| `POST /agentes` · `PATCH /agentes/:id` | admin, supervisor |
| `GET /catalogos/promotorias` | **solo admin** ← ver sección 5 |

## 2. KA-F-04 — el abogado necesita un lugar donde trabajar

- `sidebar.js`: añadir `abogado` a los roles que ven **Bandeja de casos**. NO añadirlo a
  "Nuevo caso" (no puede crear).
- `auth.js` `landingUrl()`: un abogado (sin rol operativo) debe aterrizar en
  `/bandeja.html`, no en `/dashboard.html`.
- El scoping ya lo hace el API: el abogado solo verá los expedientes de su proveedor.
- En `detalle.html` debe poder **comentar** y **subir documentos**, que es su trabajo real.

## 3. KA-F-03 — el Dashboard se ofrece a quien recibe 403

`sidebar.js:22` es el único enlace **sin** `rolesPermitidos`, así que lo ven todos. La
página pide `/asistencias/kpis` y `/proveedores` —ambos admin/supervisor/operador— dentro
de un `Promise.all` (`dashboard.js:55`), así que **un solo 403 tumba el render entero** y
la pantalla queda en blanco con un toast.

- Restringir el enlace a `['admin','supervisor','operador']`.
- Cambiar `Promise.all` por **`Promise.allSettled`** con degradado por bloque: si un
  fragmento falla, los demás se pintan igual. Aplica también a `cargarConteoCanales`
  (`dashboard.js:134`).
- Un bloque que no cargó debe decirlo en su sitio, no desaparecer sin explicación.

## 4. KA-F-08 — acciones visibles a quien no puede usarlas

Crear un helper compartido —`js/utils/permisos.js` con `puede(...roles)` leyendo el usuario
de sesión— y usarlo en vez de repetir listas por pantalla.

- **Sidebar:** "Usuarios" pasa de `OPERATIVOS` a `['admin','supervisor']`. "Proveedores"
  y "Empresas" se quedan en admin/supervisor/operador (coinciden con el GET).
- **`usuarios/lista.html`:** para un **supervisor**, ocultar "Nuevo usuario", "Editar",
  "Restablecer contraseña" y "Desactivar" — los cuatro son admin-only y hoy fallan siempre.
  El supervisor conserva la lectura.
- **`detalle.html`:** "Asignar proveedor" y "Cerrar expediente" solo admin/supervisor;
  "Cambiar estatus" admin/supervisor/operador. Hoy se muestran a todos los que abren la
  ficha, incluidos abogado y cabina.
- **`catalogos/proveedores.html` y `empresas.html`:** ocultar alta y edición para `operador`
  (puede leer, no escribir).

Criterio general: si el backend lo va a rechazar con 403, **no se muestra**. Un botón que
siempre falla es peor que un botón ausente.

## 5. Resto de KA-F-07 — el alta de agentes sigue rota para supervisor

`comercial/agentes.html` exige `promotoria_id` y llena ese select desde
`GET /catalogos/promotorias`, que es **solo admin**. Para un supervisor el 403 se traga, el
select queda vacío y el alta manda `promotoria_id: undefined` → 422 siempre.

**Cambio en el backend (una línea, hazlo primero):** en
`src/modules/catalogos/catalogos.routes.js:87`, añadir `'supervisor'` a
`roles('admin')` de `/promotorias`. Es un catálogo de lectura y el supervisor ya crea
agentes; negárselo solo rompe su propia pantalla. Añadir un test de que un supervisor
recibe 200 y un `agente` sigue recibiendo 403.

En el front: mostrar "Nuevo agente" y editar solo a `['admin','supervisor']` — el
`promotor` puede listar pero no escribir.

---

## 6. Cierre

- `node --check` sobre cada `.js` tocado.
- Probar contra QA sirviendo la rama en **`http://localhost:5500`** (el puerto que permite
  `CORS_ORIGINS`) y eligiendo ambiente QA en el login.
- **Recorrido por rol, que es el punto del bloque.** Entrar con cada uno y confirmar que
  llega a una pantalla útil y que no ve ni un botón que le vaya a dar 403:
  `jorge.ramirez` (abogado, `Kogu2024!`) · `roberto.sanchez` (cabina) ·
  `carlos.mendoza` (operador) · `ana.martinez` (supervisor) · `admin`.
- El abogado es el caso a mirar con más cuidado: debe aterrizar en la Bandeja, ver solo los
  expedientes de su proveedor, y poder comentar.
