# Bf-04 — Frontend Fase P1 de Promotoría: clientes, pólizas y renovaciones

Brief para Claude Code. **Requiere Bf-03 (sanitización XSS) cerrado y mergeado**
— todas las interpolaciones dinámicas de este brief usan `esc()` desde el día
uno. El backend B2-02 ya está en `main` del API. Se pega completo en Claude
Code como un solo prompt.

Trabajo sobre `/Users/sergioj/Documents/Claude/Projects/Kogu Asistencia/kogu-asistencias-web`.

---

## Control de avance

| Brief | Descripción                                  | Estado    | Fecha | Commit | Notas |
|-------|----------------------------------------------|-----------|-------|--------|-------|
| Bf-04 | Front P1 Promotoría (clientes/pólizas/renov.)| Pendiente |       |        |       |

---

## Contexto

El backend expone los módulos comerciales de la Fase P1 (ver colección Postman
"Promotoría P1" en el repo del API y `docs/briefs/B2-02_modulo_clientes_polizas.md`
para el contrato exacto de cada endpoint). Este brief construye su frontend
siguiendo las convenciones existentes del repo: páginas HTML + JS nativo por
página, servicios en `js/services/`, utilidades en `js/utils/` (table, modal,
toast, format con `esc()`), sidebar como componente, `config.js` para la URL
del API, sesión/token con el patrón actual de `auth.service.js`/`api.js`.

Endpoints disponibles (prefijo `/api/v1`):
clientes (CRUD, `/:id/vista360`, documentos), polizas (CRUD, `/:id/renovar`,
`/:id/cancelar`, `/:id/recibos/:reciboId/pagar`, `/:id/endosos`, documentos,
`/bandeja-renovaciones`, `/kpis`), agentes (CRUD mínimo + documentos),
catálogos `/ramos` y `/promotorias`.

## Decisiones de diseño

1. **Carpeta nueva `comercial/`** para las páginas de promotoría (espejo de
   `catalogos/` y `usuarios/`): el sidebar gana una sección "Promotoría".
2. **El scoping es del servidor.** El front no filtra por rol: muestra lo que
   el API devuelve y maneja 403 con toast + redirección a la bandeja. Sí
   oculta enlaces de sidebar según roles del usuario (`agente`/`promotor` ven
   solo la sección Promotoría + dashboard; roles operativos ven todo, igual
   que el patrón actual).
3. **Sanitización obligatoria:** toda interpolación de datos de API en
   `innerHTML` pasa por `esc()` (regla de Bf-03). Sin excepciones nuevas.
4. **Sin framework, sin librerías nuevas.** Mismo stack y estilo visual
   (styles existentes; agregar clases nuevas al CSS actual solo si faltan,
   p. ej. el semáforo de renovaciones).

## Alcance — SÍ

### 1. `comercial/clientes.html` + `js/pages/clientes.js`
- Tabla paginada con filtros: estado (prospecto/cliente/inactivo), búsqueda
  nombre/teléfono/RFC, agente (select, solo visible para roles no-agente).
- Alta y edición en modal: datos generales + **consentimiento obligatorio**
  (versión del aviso + canal; el form no envía sin ambos — espejo del
  validador DP-07 del API).
- Badge de estado; click en fila → ficha 360.

### 2. `comercial/cliente.html` + `js/pages/cliente.js` (ficha 360)
- Consume `/clientes/:id/vista360`: datos del cliente, sus pólizas (con
  estatus calculado y badge), recibos próximos, siniestros y asistencias
  ligadas, documentos.
- Acciones: editar cliente, subir documento, crear póliza (pre-llenando
  cliente), ir al detalle de una póliza.

### 3. `comercial/polizas.html` + `js/pages/polizas.js`
- Tabla paginada con filtros: estatus (incluye calculados por_renovar/vencida),
  ramo, aseguradora, búsqueda por número, rango de vigencia_fin.
- Alta en modal: cliente (búsqueda/autocomplete simple), aseguradora, ramo,
  número, producto, vigencias, prima, forma de pago, % comisión,
  asistencias incluidas (lista simple tipo+eventos). Al crear, mostrar los
  recibos generados como confirmación.
- Detalle de póliza (sección expandible o página `comercial/poliza.html`, a
  criterio según el patrón de `detalle.html` existente): datos + cliente +
  recibos (con acción pagar) + endosos (alta con documento opcional) +
  documentos + bitácora. Acciones: editar, **renovar** (modal con datos
  pre-llenados de la anterior; muestra la cadena `poliza_anterior_id`),
  **cancelar** (motivo obligatorio).

### 4. `comercial/renovaciones.html` + `js/pages/renovaciones.js`
- Bandeja de `/polizas/bandeja-renovaciones`: tabla ordenada por urgencia con
  días restantes y **semáforo 45/30/15** (verde/naranja/rojo).
- Tarjetas KPI arriba (de `/polizas/kpis`): vigentes, prima total vigente,
  por renovar 45/30/15, tasa de retención, recibos vencidos.
- Acción directa "Renovar" desde la fila (mismo modal que en pólizas).

### 5. `comercial/agentes.html` + `js/pages/agentes.js` (solo admin/sup/promotor)
- Tabla de agentes, alta/edición en modal (datos + cédula + vigencia),
  documentos del agente con campo vencimiento y badge de estado del
  expediente (vigente / por vencer / vencido según fecha).

### 6. Transversal
- `js/services/`: `clientes.service.js`, `polizas.service.js`,
  `agentes.service.js`; ampliar `catalogos.service.js` con ramos/promotorias.
- `js/components/sidebar.js`: sección "Promotoría" (Clientes, Pólizas,
  Renovaciones, Agentes) con visibilidad por rol; mantener el patrón actual
  de marcado de enlace activo.
- Dashboard (`dashboard.html`): si el usuario tiene rol comercial, agregar
  tarjeta-resumen con 2-3 KPIs de cartera que enlaza a renovaciones (no
  rehacer el dashboard).
- Manejo de errores consistente: 422 muestra los mensajes de detalle Joi en
  el form; 403 toast "sin acceso"; 401 flujo de sesión existente.

## Alcance — NO

- NO oportunidades/cotizaciones ni cuestionarios de primer contacto (P2).
- NO rediseño visual, NO migración a framework, NO tocar páginas operativas
  existentes (bandeja, detalle de asistencia, etc.) salvo sidebar y la
  tarjeta del dashboard.
- NO lógica de scoping en el front (la decide el API).

## Criterios de aceptación

1. Flujo completo en navegador contra API local: alta de cliente (con
   consentimiento) → alta de póliza desde su ficha (recibos visibles) →
   aparece en bandeja de renovaciones al estar en ventana → renovar desde la
   bandeja (cadena visible en el detalle) → KPIs actualizados.
2. Login como `agente.demo@koguasistencias.mx`: sidebar muestra solo
   Promotoría + dashboard; su listado solo trae su cartera; acceso directo
   por URL a un cliente ajeno → toast de sin acceso y redirección (403 del
   API bien manejado).
3. Cancelar sin motivo bloqueado en el form; pagar recibo refresca la fila;
   endoso con archivo queda en el historial.
4. 422 del API se traduce a mensajes por campo en los formularios.
5. `grep -rn "innerHTML" js/pages/ comercial/`: toda interpolación dinámica
   nueva usa `esc()`.
6. Sin errores en consola en las 5 páginas; visual consistente con el resto.
7. Rama `feat/bf04-front-promotoria`, commits `feat(promotoria): Bf-04 …`,
   merge a `main` tras revisión externa.
