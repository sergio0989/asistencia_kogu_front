# Bf-05 — Frontend Fase P2 de Promotoría: pipeline, alta de oportunidad y cotizaciones

Brief para Claude Code. **Requiere B2-04 cerrado y mergeado** (backend de
oportunidades/cotizaciones en `main` del API y verificado) **y Bf-04 en `main`**
(front P1 de promotoría). Se pega completo en Claude Code como un solo prompt.

Trabajo sobre `/Users/sergioj/Documents/Claude/Projects/Kogu Asistencia/kogu-asistencias-web`.

---

## Control de avance

| Brief | Descripción                                   | Estado    | Fecha | Commit | Notas |
|-------|-----------------------------------------------|-----------|-------|--------|-------|
| Bf-05 | Front P2 Promotoría (pipeline/oportunidades)  | Pendiente | —     | —      | —     |

---

## Contexto

El backend expone los módulos de P2 (ver colección Postman **"Promotoría P2"** y
`docs/briefs/B2-04_modulo_oportunidades_cotizaciones.md` en el repo del API para
el contrato exacto). Este brief construye su frontend siguiendo las convenciones
YA establecidas en el repo, sin framework: páginas HTML + JS nativo por página
en `comercial/`, servicios en `js/services/`, utilidades en `js/utils/`
(`table`, `modal`, `toast`, `formErrors`, `format` con `fmt.esc()`), sidebar
como componente, `config.js` para la URL del API, sesión/token con el patrón de
`auth.service.js`/`api.js`.

Endpoints disponibles (prefijo `/api/v1`):
`oportunidades` (CRUD, `/:id/estatus`, `/:id/convertir`, `/kpis`,
`/recontactos`), cotizaciones como sub-recurso
(`/oportunidades/:id/cotizaciones…` con `/seleccionar` y `/documentos`),
catálogos `/ramos` y `/formularios-promotoria?ramo_id=`, más los de P1 ya
consumidos (clientes, pólizas, aseguradoras vía `/catalogos/empresas`).

## Decisiones de diseño

1. **Extraer el renderer de formulario dinámico a un util compartido.** Hoy
   `js/pages/nuevo-caso.js` tiene `renderFormularioDinamico` / `renderCampo` /
   `evaluarCondicionales` / la recolección de `respuestas`. Moverlos a
   `js/utils/formRenderer.js` (window.formRenderer) y hacer que **tanto
   `nuevo-caso.js` como la nueva alta de oportunidad** lo consuman. Refactor
   pequeño y sin cambiar el comportamiento de `nuevo-caso.js` (verificar que
   sigue funcionando). El esquema JSON de los cuestionarios de promotoría es el
   mismo formato de secciones/campos que el de asistencias.
2. **El scoping es del servidor.** El front no filtra por rol: muestra lo que el
   API devuelve y maneja 403 con toast + redirección al pipeline. Sí oculta
   enlaces de sidebar por rol (mismo patrón de Bf-04).
3. **Los botones de estatus vienen de la máquina, no del front.** El detalle de
   la oportunidad pinta como acciones únicamente las `transiciones_disponibles`
   que devuelve `GET /oportunidades/:id`. No hardcodear el flujo. `perdida` /
   `no_califica` abren modal de **motivo obligatorio**; `recontacto_programado`
   pide **fecha**.
4. **Sanitización obligatoria (Bf-03):** toda interpolación de datos de API en
   `innerHTML` pasa por `fmt.esc()`. Sin excepciones nuevas.
5. **Sin framework, sin librerías nuevas.** Mismo stack y estilo visual; agregar
   clases al CSS existente solo si faltan (p. ej. columnas/tarjetas del kanban).
6. **422 → `formErrors` por campo; 403 → toast + redirección; 401 → flujo de
   sesión existente.** Al convertir, redirigir a `comercial/poliza.html?id=` de
   la póliza creada.

## Alcance — SÍ

### 1. `comercial/pipeline.html` + `js/pages/pipeline.js`
- Vista **kanban** con una columna por estatus abierto (`primer_contacto`,
  `calificado`, `en_cotizacion`, `cotizado`, `en_emision`) y las cerradas
  (`ganada` / `perdida` / `no_califica` / `recontacto_programado`) en una
  sección colapsable o filtro aparte. Cada tarjeta: folio, cliente, ramo,
  agente, días en etapa, prima de la cotización seleccionada si existe.
- Filtros arriba: ramo, agente (visible solo para roles no-agente), canal,
  búsqueda (folio/cliente).
- Fila de **KPIs** (de `/oportunidades/kpis`): abiertas por etapa, tasa de
  cierre, por recontactar, valor potencial.
- Botón **"Nueva oportunidad"** → `comercial/nueva-oportunidad.html`.
- Click en tarjeta → `comercial/oportunidad.html?id=`.
- (Si el kanban resulta pesado, se acepta como alternativa una tabla paginada
  con filtro por estatus, a criterio siguiendo el patrón de `polizas.js`; el
  kanban es lo preferido.)

### 2. `comercial/nueva-oportunidad.html` + `js/pages/nueva-oportunidad.js`
Stepper de 3 pasos (espejo de `nuevo-caso.js`):
- **Paso 1** — canal (chips, incl. `agente`) + ramo (select de `/catalogos/ramos`)
  + cliente: o buscar/seleccionar un cliente existente, o alta de **prospecto
  nuevo** con **consentimiento DP-07 obligatorio** (versión del aviso + canal) +
  datos de primer contacto comunes (`vencimiento_poliza_actual`,
  `aseguradora_actual`).
- **Paso 2** — cuestionario dinámico del ramo: cargar
  `/catalogos/formularios-promotoria?ramo_id=` y renderizar con
  `formRenderer` (decisión 1). Condicionales funcionando.
- **Paso 3** — confirmación con el folio `PR-…` generado; enlaces a la
  oportunidad y al pipeline.
- El alta hace `POST /oportunidades` con `respuestas` = JSON recogido del
  cuestionario.

### 3. `comercial/oportunidad.html` + `js/pages/oportunidad.js` (detalle)
- Consume `GET /oportunidades/:id`: datos + cliente + ramo + respuestas del
  cuestionario (render legible) + cotizaciones + bitácora + transiciones
  disponibles.
- **Cotizaciones**: alta en modal (aseguradora, plan, prima, suma, deducible,
  vigencia_dias), editar, **seleccionar** (una sola marcada), documento adjunto
  opcional (patrón de endosos de `polizas`).
- **Acciones de estatus**: un botón por cada transición disponible; modal de
  motivo para pérdidas y de fecha para recontacto.
- **Convertir a póliza** cuando el estatus es `en_emision`: modal con datos de
  póliza pre-llenados desde la cotización seleccionada (aseguradora, prima,
  ramo, cliente); al confirmar, `POST /oportunidades/:id/convertir` y
  redirección a `comercial/poliza.html?id=` de la póliza nueva.

### 4. Servicios y transversal
- `js/services/oportunidades.service.js`: `listar(filtros)`, `obtener(id)`,
  `crear(data)`, `actualizar(id,data)`, `cambiarEstatus(id,{estatus,motivo,fecha})`,
  `convertir(id,data)`, `getKpis()`, `getRecontactos()`, y cotizaciones
  (`crearCotizacion`, `actualizarCotizacion`, `seleccionarCotizacion`,
  `eliminarCotizacion`, `subirDocumentoCotizacion`, `getUrlDocumentoCotizacion`)
  — patrón de `polizas.service.js` con `api.get/post/patch/postFormData`.
- Ampliar `js/services/catalogos.service.js` con
  `getFormulariosPromotoria(ramo_id)` (y `getRamos` si no está ya).
- `js/utils/formRenderer.js`: nuevo util compartido (decisión 1).
- `js/components/sidebar.js`: agregar a la sección **Promotoría** (grupo
  `promotoria`, roles `COMERCIAL`) el enlace **"🗂️ Pipeline"**
  (`/comercial/pipeline.html`) y opcionalmente **"⏰ Recontactos"**; mantener el
  patrón de marcado de enlace activo. Insertar en `NAV_LINKS`.
- Dashboard (`dashboard.html`): opcional, para roles comerciales, sumar al
  bloque existente 2 métricas de pipeline (abiertas / por recontactar) que
  enlacen al pipeline; no rehacer el dashboard.

## Alcance — NO

- NO cálculo de comisiones, NO notificaciones email/WhatsApp, NO APIs de
  cotización de aseguradoras (captura manual).
- NO rediseño visual, NO migración a framework, NO tocar páginas operativas
  (bandeja/detalle de asistencia) salvo el refactor de `formRenderer` (que debe
  dejar `nuevo-caso.js` funcionando igual) y el sidebar/dashboard.
- NO lógica de scoping en el front (la decide el API).

## Criterios de aceptación

1. Flujo completo en navegador contra API local: **nueva oportunidad**
   (prospecto nuevo con consentimiento + cuestionario del ramo) → folio `PR-…`
   → aparece en el **pipeline** en `primer_contacto` → agregar cotizaciones y
   seleccionar una → mover por la máquina hasta `en_emision` → **convertir** →
   cliente promovido, póliza creada (redirección a su detalle), oportunidad en
   `ganada`; KPIs actualizados.
2. Login `agente.demo@koguasistencias.mx`: sidebar muestra solo Promotoría +
   Dashboard; el pipeline trae solo su cartera; acceso directo por URL a una
   oportunidad ajena → toast de sin acceso y redirección (403 bien manejado).
3. Los botones de estatus reflejan exactamente las transiciones del API;
   `perdida`/`no_califica` bloquean sin motivo; recontacto pide fecha.
4. El cuestionario dinámico renderiza para los **5 ramos** (condicionales
   funcionan) y `nuevo-caso.js` sigue funcionando tras el refactor de
   `formRenderer`.
5. `grep -rn "innerHTML" js/pages/ js/utils/formRenderer.js comercial/`: toda
   interpolación dinámica nueva usa `fmt.esc()`. Sin errores en consola en las
   3 páginas nuevas.
6. 422 del API → mensajes por campo en los formularios; visual consistente con
   el resto.
7. Rama `feat/bf05-front-pipeline`, commits `feat(promotoria): Bf-05 …`, merge a
   `main` con `--no-ff` tras revisión externa (loop de revisión).
