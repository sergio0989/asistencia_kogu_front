'use strict';
/**
 * pipeline.js — Kanban del embudo de oportunidades (Promotoría P2, Bf-05).
 * Depende de: api.js, oportunidades.service.js, catalogos.service.js,
 *             agentes.service.js, auth.service.js, fmt, toast.
 *
 * El scoping lo hace el API (no se filtra por rol en el front). Se ocultan los
 * filtros por agente a los agentes puros. Sin llamada por tarjeta (sin N+1).
 */

// Columnas de la máquina de estatus (contexto 'oportunidad').
const COLS_ABIERTAS = ['primer_contacto', 'calificado', 'en_cotizacion', 'cotizado', 'en_emision'];
const COLS_CERRADAS = ['ganada', 'recontacto_programado', 'perdida', 'no_califica'];

// Tope de tarjetas cargadas (el listado del API pagina; máx. 100 por página).
const CARD_CAP = 100;

// ¿El usuario puede ver/filtrar por agente? (rol no-agente-puro)
const PUEDE_AGENTES = authService.hasAnyRole('admin', 'supervisor', 'operador', 'promotor');

// 'elevado' | 'agente_raiz' | 'subagente' — un agente raíz no filtra por agente
// (solo ve su cartera) pero sí por cuál de sus sub-agentes trabaja el trato.
let perfil = 'elevado';

const state = { filtros: {} };

document.addEventListener('DOMContentLoaded', async () => {
  await authService.asegurarPerfilComercial();
  perfil = authService.perfilComercial();

  await Promise.all([cargarRamos(), montarFiltroAgente(), montarFiltroSubagente()]);
  await Promise.all([cargarKpis(), cargarPipeline()]);

  let timer;
  document.getElementById('filtro-buscar')?.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.filtros.buscar = e.target.value.trim(); cargarPipeline(); }, 350);
  });
  document.getElementById('filtro-ramo')?.addEventListener('change', e => {
    state.filtros.ramo_id = e.target.value; cargarPipeline();
  });
  document.getElementById('filtro-agente')?.addEventListener('change', e => {
    state.filtros.agente_id = e.target.value; cargarPipeline();
  });
  document.getElementById('filtro-subagente')?.addEventListener('change', e => {
    state.filtros.subagente_id = e.target.value; cargarPipeline();
  });
  document.getElementById('filtro-canal')?.addEventListener('change', e => {
    state.filtros.canal_origen = e.target.value; cargarPipeline();
  });
  document.getElementById('btn-limpiar')?.addEventListener('click', limpiarFiltros);
  document.getElementById('btn-nueva-oportunidad')?.addEventListener('click', () => {
    window.location.href = '/comercial/nueva-oportunidad.html';
  });
  document.getElementById('closed-toggle')?.addEventListener('click', toggleCerradas);
});

// ─── Catálogos de apoyo ─────────────────────────────────────────────────────
async function cargarRamos() {
  try {
    const ramos = await catalogosService.getRamos() || [];
    document.getElementById('filtro-ramo').innerHTML =
      '<option value="">Todos los ramos</option>' +
      ramos.map(r => `<option value="${fmt.esc(r.id)}">${fmt.esc(r.nombre)}</option>`).join('');
  } catch (err) {
    console.error('No se pudieron cargar los ramos', err);
    toast.error('No se pudieron cargar los ramos');
  }
}

// Bf-07: los filtros de agente pasan de <select> volcado (limit:200) a pickers
// con búsqueda contra el servidor. Se montan por separado porque su alcance no
// es el mismo: filtrar por AGENTE solo tiene sentido para quien ve varios,
// mientras que filtrar por SUB-AGENTE también le sirve al agente raíz para ver
// qué trabaja cada uno de los suyos.
let pkFiltroAgente = null;
let pkFiltroSub    = null;

function montarFiltroAgente() {
  if (!PUEDE_AGENTES) return;   // agente puro: el API fuerza su cartera
  pkFiltroAgente = picker.bind({
    inputId:     'filtro-agente-label', hiddenId: 'filtro-agente',
    botonId:     'filtro-agente-btn',   limpiarId: 'filtro-agente-clear',
    titulo:      'Seleccionar agente',
    placeholder: 'Nombre, RFC o correo…',
    vacio:       'Escribe para buscar agentes.',
    buscar:      (q, page) => agentesService.listar({ buscar: q, page, limit: 20 }),
    item:        a => ({ id: a.id, titulo: a.nombre, sub: a.email || a.rfc || '—' }),
  });
  document.getElementById('grupo-filtro-agente').style.display = '';
}

// Filtro por sub-agente (B2-06: el backend acepta subagente_id en el listado de
// oportunidades). Un sub-agente no lo necesita: no tiene equipo debajo.
function montarFiltroSubagente() {
  if (!PUEDE_AGENTES && perfil !== 'agente_raiz') return;

  // El agente raíz filtra dentro de su propio equipo: fijar agente_padre_id lo
  // deja además fuera de su propia lista, que como "sub-agente" sería ruido.
  const padre = perfil === 'agente_raiz'
    ? (authService.getUser()?.agente_id || undefined)
    : undefined;

  pkFiltroSub = picker.bind({
    inputId:     'filtro-subagente-label', hiddenId: 'filtro-subagente',
    botonId:     'filtro-subagente-btn',   limpiarId: 'filtro-subagente-clear',
    titulo:      'Filtrar por sub-agente',
    placeholder: 'Nombre, RFC o correo…',
    vacio:       'Escribe para buscar sub-agentes.',
    buscar:      (q, page) => agentesService.listar({ buscar: q, page, limit: 20, agente_padre_id: padre }),
    item:        a => ({ id: a.id, titulo: a.nombre, sub: a.padre_nombre ? `Depende de ${a.padre_nombre}` : 'Agente raíz' }),
  });
  document.getElementById('grupo-filtro-subagente').style.display = '';
}

// ─── KPIs (snapshot global del pipeline, independiente de los filtros) ───────
async function cargarKpis() {
  try {
    const k = await oportunidadesService.getKpis();
    const tile = (label, value, sub) =>
      `<div class="kpi-card"><div class="k">${label}</div>
        <div class="v">${value}${sub ? ` <small>${sub}</small>` : ''}</div></div>`;
    // label es texto estático; value ya viene formateado/escapado abajo.
    document.getElementById('kpi-row').innerHTML =
      tile('Abiertas',        fmt.esc(k.abiertas ?? 0)) +
      tile('Ganadas',         fmt.esc(k.ganadas ?? 0)) +
      tile('Tasa de cierre',  k.tasa_cierre_pct != null ? `${fmt.esc(k.tasa_cierre_pct)}%` : '—') +
      tile('Por recontactar', fmt.esc(k.por_recontactar ?? 0)) +
      tile('Valor potencial', fmt.esc(fmt.moneda(k.valor_potencial)));
  } catch (err) {
    console.error('Error cargando KPIs:', err);
  }
}

// ─── Pipeline (kanban) ──────────────────────────────────────────────────────
async function cargarPipeline() {
  try {
    const result = await oportunidadesService.listar({ ...state.filtros, page: 1, limit: CARD_CAP });
    const rows = result?.data || [];
    const meta = result?.meta || { total: rows.length };

    renderColumnas('kanban-abiertas', COLS_ABIERTAS, rows);
    renderColumnas('kanban-cerradas', COLS_CERRADAS, rows);

    const cerradasCount = rows.filter(o => COLS_CERRADAS.includes(o.estatus)).length;
    document.getElementById('closed-count').textContent = cerradasCount;

    document.getElementById('contador').textContent =
      `${meta.total} oportunidad${meta.total !== 1 ? 'es' : ''}`;

    // Sin truncado silencioso: si hay más de las cargadas, avisar.
    const banner = document.getElementById('banner-cap');
    if (meta.total > rows.length) {
      banner.style.display = '';
      banner.textContent = `Mostrando las primeras ${rows.length} de ${meta.total}. Usa los filtros para acotar el tablero.`;
    } else {
      banner.style.display = 'none';
    }
  } catch (err) {
    toast.error('Error al cargar el pipeline');
    console.error(err);
  }
}

function renderColumnas(containerId, columnas, rows) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  // El nombre de la etapa lo trae el API en estatus_nombre; fallback al mapa.
  const nombrePorClave = {};
  rows.forEach(o => { if (o.estatus_nombre) nombrePorClave[o.estatus] = o.estatus_nombre; });

  cont.innerHTML = columnas.map(clave => {
    const cards = rows.filter(o => o.estatus === clave);
    const titulo = fmt.esc(nombrePorClave[clave] || fmt.estatusOportunidad(clave).label);
    const cuerpo = cards.length
      ? cards.map(tarjeta).join('')
      : '<div class="kanban-empty">—</div>';
    return `<div class="kanban-col">
      <div class="kanban-col__head">
        <span class="kanban-col__title">${titulo}</span>
        <span class="kanban-col__count">${cards.length}</span>
      </div>
      ${cuerpo}
    </div>`;
  }).join('');
}

function tarjeta(o) {
  // o.id: UUID propio → navegación. Todo dato de API escapado (Bf-03).
  // Sin prima por tarjeta (la lista no la trae; el valor total vive en KPIs).
  const ramo = o.ramo_clave || o.ramo_nombre;
  const dias = diasDesde(o.created_at);
  const chips = [];
  if (ramo)            chips.push(`<span class="kanban-card__chip">${fmt.esc(ramo)}</span>`);
  if (o.agente_nombre) chips.push(`<span>${fmt.esc(o.agente_nombre)}</span>`);
  // Etiqueta honesta: "antigüedad" (la lista no expone el tiempo en la etapa).
  const antiguedad = dias != null ? `<span class="kanban-card__age" title="Antigüedad desde el alta">antigüedad: ${dias}d</span>` : '';

  return `<div class="kanban-card" onclick="window.location.href='/comercial/oportunidad.html?id=${o.id}'">
    <div class="kanban-card__folio">${fmt.esc(o.folio)}</div>
    ${o.cliente_nombre ? `<div class="kanban-card__cliente">${fmt.esc(o.cliente_nombre)}</div>` : ''}
    <div class="kanban-card__meta">${chips.join('')}${antiguedad}</div>
  </div>`;
}

function diasDesde(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / 86400000));
}

// ─── UI helpers ─────────────────────────────────────────────────────────────
function toggleCerradas() {
  const box   = document.getElementById('kanban-cerradas');
  const caret = document.getElementById('closed-caret');
  const abierto = box.style.display !== 'none';
  box.style.display = abierto ? 'none' : 'flex';
  caret.textContent = abierto ? '▸' : '▾';
}

function limpiarFiltros() {
  state.filtros = {};
  pkFiltroAgente?.set('', '');
  pkFiltroSub?.set('', '');
  ['filtro-buscar', 'filtro-ramo', 'filtro-canal']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  cargarPipeline();
}
