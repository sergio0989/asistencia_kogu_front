# Bf-11 — Los botones de estatus del expediente salen del catálogo

**Repo:** `sergio0989/asistencia_kogu_front`
**Origen:** auditoría 2026-09-02 — KA-F-06
**Depende de:** `B2-10` desplegado (el detalle debe devolver `transiciones_disponibles`)
**Tamaño:** medio día

---

## Qué está mal hoy

`detalle.html:375-382` tiene **seis botones de estatus escritos a mano**. El catálogo del
backend modela **16 estatus** y unas 30 transiciones. Consecuencias, todas reales:

1. **Un botón apunta a un estatus que no existe.** `pendiente_pago` (línea 380) **no está en
   `catalogo_estatus`** — lo verifiqué. Pulsarlo siempre falla.
2. **Se ofrecen transiciones inválidas.** Los seis botones se muestran siempre, sin mirar el
   estatus actual: desde `cerrado` se ofrece "En proceso", y el usuario recibe el error crudo
   `Transición no permitida: "cerrado" → "en_proceso"` como toast.
3. **El comentario dice "opcional" y a veces es obligatorio.** Las transiciones a
   `archivado` y `anulado`, y el desasignar (`asignado → abierto`), llevan
   `requiere_motivo = TRUE`. Archivar con el campo vacío falla.
4. **Faltan estatus que sí existen**: `observado`, `resuelto` y toda la mitad administrativa.

`comercial/oportunidad.js` ya resolvió esto bien. **Este brief es traer ese patrón**, no
inventar uno.

## 1. El patrón a replicar

`js/pages/oportunidad.js:259-290` — `renderAcciones(transiciones, o)` y
`iniciarTransicion(toClave, requiereMotivo)`:

- Un botón **por cada transición que devuelve el API**, con `t.to_nombre` como etiqueta.
  Nada hardcodeado.
- `t.requiere_motivo` decide si se abre el modal que **exige** el motivo o si basta un
  `modal.confirm`.
- Las transiciones destructivas se pintan distinto (ahí, `perdida`/`no_califica`).

Léelo antes de escribir nada y respeta su estructura: la idea es que las dos pantallas se
comporten igual y que la próxima persona reconozca el patrón.

## 2. En `detalle.html` / `js/pages/detalle.js`

- **Borrar** los seis `<button class="estatus-btn" data-nuevo-estatus="…">` y dejar un
  contenedor vacío (`<div id="acciones-estatus">`) que se llena en tiempo de ejecución.
- `cargarExpediente()` ya recibe el detalle: pasarle `transiciones_disponibles` al render.
  Si el array viene vacío, mostrar "No hay cambios de estatus disponibles" en vez de un
  hueco — desde `archivado` es el estado correcto, no un error.
- **El motivo deja de ser un textarea suelto.** Cuando `requiere_motivo` sea true, el modal
  no debe permitir confirmar con el campo vacío; cuando sea false, sigue siendo opcional.
  Etiquetar el campo según el caso ("Motivo *" vs "Comentario (opcional)").
- Mantener el gate de permisos de Bf-10: cambiar estatus es admin/supervisor/operador. Los
  botones se renderizan **solo** si `permisos.puedeAccion('asistenciasEstatus')`.
- Tras cambiar el estatus, recargar el detalle: la lista de transiciones cambia con él.

## 3. Errores legibles

Con `B2-10`, el backend distingue: **409** = ya está en ese estatus, **422** = falta el
motivo, **403** = no tienes permiso. Que cada uno diga algo distinto y en lenguaje de
negocio, no el mensaje crudo del API.

## 4. Cierre

- `node --check` sobre lo tocado.
- Probar contra QA sirviendo la rama en **`http://localhost:5500`**, ambiente QA.
- **Recorrido:** abre un expediente en `abierto` — deben salir *Asignado*, *Archivado* y
  *Anulado*, y **no** "En proceso" (esa transición no existe desde `abierto`). Cámbialo a
  `asignado` y comprueba que la lista de botones **se rehace sola**. Intenta archivar sin
  motivo: debe impedirlo el front, no el 422 del backend. Y confirma que ya no existe
  ningún botón "Pend. pago".
- Al desplegar: `python3 scripts/versionar-assets.py 1.6` (ya sube el badge solo).
