# Bf-07 — Picker de búsqueda, sub-agentes y campos nuevos en el alta de póliza

**Repo:** `sergio0989/asistencia_kogu_front`
**Depende de:** B2-06 en el backend (debe estar desplegado en QA antes de probar)
**Estado:** abierto

---

## 0. El bug que origina este brief

En el alta de póliza **no se puede seleccionar cliente: la lista sale vacía**.

Causa raíz: `js/pages/polizas.js:72` llama `clientesService.listar({ limit: 500 })`, pero el
validador del backend topa `limit` en `max(100)` (`clientes.validators.js:45`). El backend
responde **422** y el `catch { /* silencioso */ }` de la línea 76 se lo traga: el `<select>`
queda vacío, sin error en pantalla ni en consola.

**No es un caso aislado.** El mismo patrón está en seis lugares más:

| Archivo | Pide | Síntoma hoy |
|---|---|---|
| `js/pages/polizas.js:72` | clientes `limit:500` | no se puede elegir cliente |
| `js/pages/agentes.js:108` | agentes `limit:500` | "Editar agente" no abre nada |
| `js/pages/detalle.js:503,505` | proveedores `limit:200` | asignar proveedor sale vacío |
| `js/pages/clientes.js:46` | agentes `limit:200` | filtro de agente vacío |
| `js/pages/pipeline.js:61` | agentes `limit:200` | filtro de agente vacío |
| `js/pages/nueva-oportunidad.js:88` | agentes `limit:200` | select de agente vacío |

Bajar los números a 100 lo tapa hoy y vuelve en silencio con 101 registros. La sección 1
lo cierra de raíz.

---

## 1. `js/utils/picker.js` — componente nuevo

Modal de búsqueda reutilizable que **reemplaza los `<select>` poblados por volcado completo**.
Busca contra el servidor, paginado, sin límites inventados.

### API

```js
picker.open({
  titulo:      'Seleccionar cliente',
  placeholder: 'Nombre, RFC o teléfono…',
  buscar:      async (q, page) => clientesService.listar({ buscar: q, page, limit: 20 }),
  item:        c => ({ id: c.id, titulo: c.nombre, sub: `${c.rfc || 's/RFC'} · ${c.telefono || '—'}` }),
  onSelect:    c => { ... },
});

// Atajo declarativo: enlaza un input readonly + botón + hidden
picker.bind({ inputId: 'p-cliente-label', hiddenId: 'p-cliente', botonId: 'p-cliente-btn', ...opciones });
```

### Requisitos no negociables

- **Debounce** de 300 ms en el input.
- **Secuenciación por token**: cada búsqueda incrementa un contador; una respuesta cuyo token
  no sea el último se descarta. (Esto además cierra KA-F-13, la carrera al filtrar que hoy
  afecta a `pipeline.js`, `polizas.js`, `clientes.js` y `usuarios.js`.)
- **Paginación real**: `limit: 20` y botón "Cargar más" usando `meta.pages`.
- **Errores visibles dentro del modal.** Prohibido `catch {}` vacío: si la petición falla,
  se pinta el mensaje en el cuerpo del modal con un botón "Reintentar". Este es el punto
  del brief — el bug de origen fue un error tragado.
- **Estado vacío explícito**: "Sin resultados para «…»".
- Escape con `fmt.esc()` en todo lo interpolado.
- Accesible: foco al input al abrir, `Esc` cierra, `↑/↓` navegan, `Enter` selecciona.
- Reutiliza `modal.js` para el backdrop; no inventa uno nuevo.

### Dónde se aplica (eliminar todos los `limit:500/200`)

| Campo | Pantallas |
|---|---|
| Cliente | `comercial/polizas.html`, `comercial/nueva-oportunidad.html` |
| Agente | `comercial/polizas.html`, `clientes.html`, `pipeline.html`, `nueva-oportunidad.html` |
| **Sub-agente** | `comercial/polizas.html` (nuevo) |
| Aseguradora | `comercial/polizas.html` |
| Proveedor | `detalle.html` (`js/pages/detalle.js:503,505`) |

En `js/pages/agentes.js:106-110`, `abrirModalEditar` deja de re-descargar la lista completa:
usa el registro ya cargado en la fila o llama al detalle. Agregar el `try/catch` que hoy no tiene.

---

## 2. Alta de póliza — campos nuevos

`comercial/polizas.html`, modal `#modal-poliza`, y `js/pages/polizas.js` (constante `MAPA`).

### Campos que se agregan

| Campo | Control | Notas |
|---|---|---|
| **Fecha venta** | `input[type=date]` `#p-fecha-venta` | default = hoy al abrir el modal |
| **Uso** | `select` `#p-uso` | **dependiente del ramo**: se llena con `GET /catalogos/usos?ramo_id=`; si el ramo no tiene usos, el campo se oculta (hoy solo AUT los tiene) |
| **Prima neta** | `input[type=number]` `#p-prima-neta` | step `0.01`, min `0` |
| **Sub-agente** | picker `#p-subagente` | **deshabilitado hasta elegir agente**; busca con `agente_padre_id=<agente elegido>` |
| **Comisión sub-agente %** | `input[type=number]` `#p-comision-sub` | 0–100; visible solo si hay sub-agente |

### Cambios en campos existentes

- **Agente**: pasa de no existir en el modal a picker `#p-agente`. Al cambiarlo, **limpiar el
  sub-agente** (deja de ser coherente) y volver a deshabilitar su picker.
- **Comisión %**: cambiar la etiqueta a **"Comisión agente % (sobre prima neta)"**.
- **Prima total**: etiqueta **"Prima total (lo que paga el cliente)"**, con nota al pie
  "El plan de recibos se genera sobre la prima total".
- **Ramo**: ya existe (`#p-ramo`, línea 93). Al cambiarlo, recargar el select de Uso.

### Validación de cliente

- `prima_neta` ≤ `prima_total` antes de enviar; si no, marcar el campo con `formErrors`
  en vez de esperar el 422.
- Sub-agente sin agente → imposible por construcción (picker deshabilitado).

---

## 3. Detalle de póliza — `comercial/poliza.html` + `js/pages/poliza.js`

Mostrar en la ficha: **Fecha de venta**, **Uso** (`uso_nombre`), **Prima neta**,
**Sub-agente** (`subagente_nombre`) y los dos montos calculados que ya devuelve el backend:
`comision_monto` y `comision_subagente_monto`, formateados con `fmt.moneda`.

Cuando `comision_monto` venga `null` (falta prima neta o falta el %), mostrar "—" y no `$0.00`:
son cosas distintas.

> **Nota de estilo:** esta pantalla usa `.data-section`, que hoy solo está definido dentro de
> `detalle.html` y `comercial/oportunidad.html` (hallazgo KA-F-14). Aprovechar y **mover
> `.data-section` / `.data-section__title` a `styles/styles.css`**, que arregla de paso los
> títulos sin formato del panel comercial, la ficha de cliente y renovaciones.

---

## 4. Agentes — `comercial/agentes.html` + `js/pages/agentes.js`

- Columna nueva **"Depende de"** (`padre_nombre`, o "—" si es agente raíz).
- Columna **"Sub-agentes"** con `subagentes_count`.
- Filtro **"Solo agentes raíz / Solo sub-agentes"** → `solo_raiz=true` / `agente_padre_id`.
- En el alta y edición: campo **"Depende de (agente)"** con picker, opcional, filtrado a
  agentes raíz de la misma promotoría.
- El backend responde 422 con mensaje claro si la jerarquía es inválida: mostrarlo con
  `formErrors` en el campo, no como toast genérico.

---

## 5. Listado de pólizas — `comercial/polizas.html`

- Filtro nuevo por **sub-agente** (picker), y por **uso** cuando el ramo filtrado sea AUT.
- La tabla ya tiene 8 columnas; **no agregar más**: el sub-agente se ve en el detalle.

---

## 6. Cierre

- `node --check` sobre todos los `.js` tocados.
- Probar en QA con el usuario admin y con un usuario **agente** que tenga sub-agentes:
  el agente debe ver las pólizas de sus sub-agentes; el sub-agente solo las suyas.
- Verificar en consola que **no queda ningún `catch` vacío** en las rutas tocadas
  (`grep -rn "catch {" js/`).
- Confirmar que ya no existe ningún `limit: 500` ni `limit: 200` en `js/`.

---

## 7. Addendum tras B2-06 (backend cerrado, commits 945c4fb / defb8a3 / 7e9def0)

El backend cambió dos cosas que este brief no contemplaba cuando se escribió.

### 7.1 El reparto agente / sub-agente lo decide el backend, no el formulario

Si quien emite es un **sub-agente**, el backend asigna solo: `agente_id` = su agente padre y
`subagente_id` = él mismo. El front **no debe** pedirle esos dos campos ni mandarlos.

Regla de UI, tanto en alta de póliza como en alta de oportunidad:

- Usuario con rol elevado (admin / supervisor / operador) o **promotor** → muestra los dos
  pickers (agente y sub-agente), como dice la sección 2.
- Usuario **agente raíz** → oculta el picker de agente (se asigna a sí mismo) y deja solo el de
  sub-agente, filtrado a sus propios sub-agentes.
- Usuario **sub-agente** → oculta ambos y muestra una línea informativa:
  "Se registrará a tu nombre, con <nombre del agente> como titular."

**Resuelto en el backend (commit `270098f`, ya en `main` y desplegado en QA):** `GET /auth/me`
devuelve ahora `agente_id`, `agente_padre_id` y `promotoria_id`. Guárdalos en `sessionStorage`
junto al resto del usuario, en `auth.service`, y decide con ellos:

- `agente_padre_id != null` ⇒ **sub-agente**
- `agente_id != null && agente_padre_id == null` ⇒ **agente raíz**
- ambos `null` ⇒ rol elevado o promotor (los dos pickers visibles)

**Cuidado con la semántica:** los tres campos salen del *alcance comercial*, no de la existencia de
fila en `agentes`. Un admin o supervisor CON fila los recibe en `null`, y un promotor recibe solo
`promotoria_id`. Para esta decisión de UI alcanza; no los uses para "la ficha de agente del usuario".

### 7.2 Las oportunidades también tienen sub-agente

`oportunidades.subagente_id` existe desde `7e9def0`, con el mismo reparto y el mismo scoping.
Por lo tanto:

- `comercial/nueva-oportunidad.html`: agregar el picker de sub-agente con la misma regla por rol
  del punto 7.1, y el de agente donde corresponda.
- `comercial/oportunidad.html` + `js/pages/oportunidad.js`: mostrar `subagente_nombre` en la ficha.
- `comercial/pipeline.html`: agregar el filtro `subagente_id` (el backend ya lo acepta).
- En el modal de **conversión** a póliza: si el usuario no manda un sub-agente explícito, la póliza
  hereda el par (agente, sub-agente) de la oportunidad. No hace falta re-preguntarlo; si se muestra,
  que sea prellenado con lo que ya trae la oportunidad.

### 7.3 Campos nuevos a mostrar

En el detalle de póliza, además de lo que pide la sección 3, el backend ya devuelve
`comision_monto` y `comision_subagente_monto` calculados. Recordatorio del criterio:
`null` → "—", nunca "$0.00". Son cosas distintas y el usuario de negocio las lee distinto.


---

## 8. Cómo partirlo

El brief es grande. Conviene hacerlo en dos pasadas sobre la misma rama `feat/bf07-picker-poliza`,
para poder verificar la primera de forma independiente:

**Pasada 1 — el picker y su aplicación (secciones 0 y 1).** Crea `js/utils/picker.js` y sustituye
con él los siete selects que hoy se llenan por volcado. Al terminar esto el error original
—"no se puede seleccionar cliente al crear póliza"— ya está cerrado, y se puede probar en QA sin
depender de nada más.

**Pasada 2 — campos nuevos y sub-agentes (secciones 2 a 7).** Modal de alta, detalle de póliza,
pantalla de agentes, filtros, y el comportamiento por rol del addendum.
