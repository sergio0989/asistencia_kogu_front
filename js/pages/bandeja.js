'use strict';
/**
 * bandeja.js — Bandeja operativa con filtros, tabs y paginación.
 * Depende de: api.js, asistencias.service.js, catalogos.service.js,
 *             fmt, toast, table
 */

const state = {
  page:     1,
  limit:    20,
  filtros:  {},
  total:    0,
  cargando: false,
};

document.addEventListener('DOMContentLoaded', async () => {
  // Cargar KPIs y empresas en paralelo mientras se cargan los expedientes
  await Promise.all([
    cargarKpis(),
    inicializarFiltros(),
  ]);

  // Leer filtros de la URL
  const params = new URLSearchParams(window.location.search);
  if (params.get('empresa_id'))   state.filtros.empresa_id  = params.get('empresa_id');
  if (params.get('abogado_id'))   state.filtros.abogado_id  = params.get('abogado_id');
  // proveedor_id (desde proveedores.html → "Ver casos") mapea al mismo filtro del backend
  if (params.get('proveedor_id')) state.filtros.abogado_id  = params.get('proveedor_id');

  // Banner informativo cuando se llega filtrado por abogado / proveedor
  if (state.filtros.abogado_id) {
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      const esProveedor = !!params.get('proveedor_id');
      const banner = document.createElement('div');
      banner.id = 'filtro-abogado-banner';
      banner.style.cssText = 'background:#ecfeff;border:1px solid #a5f3fc;border-radius:8px;padding:8px 14px;font-size:12px;color:#0e7490;display:flex;align-items:center;justify-content:space-between;margin-top:8px';
      banner.innerHTML = `<span>⚖️ ${esProveedor ? 'Mostrando casos del proveedor seleccionado' : 'Mostrando casos del abogado seleccionado'}</span>
        <button onclick="quitarFiltroAbogado()" style="background:none;border:none;cursor:pointer;font-size:12px;color:#0e7490;font-weight:700">✕ Quitar filtro</button>`;
      topbar.appendChild(banner);
    }
  }

  await cargarBandeja();

  // ─── Tabs ──────────────────────────────────────────────────────────────────
  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const valor = tab.dataset.tab;
      state.filtros.estatus_operativo = valor === 'todos' ? '' : valor;
      state.filtros.estatus_macro     = '';
      state.page = 1;
      cargarBandeja();
    });
  });

  // ─── Filtros ───────────────────────────────────────────────────────────────
  // Buscar con debounce
  let searchTimer;
  document.getElementById('filtro-buscar')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filtros.buscar = e.target.value.trim();
      state.page = 1;
      cargarBandeja();
    }, 400);
  });

  // Botón Filtrar — aplica todos los selects a la vez
  document.getElementById('btn-aplicar-filtros')?.addEventListener('click', () => {
    state.filtros.nivel_urgencia = document.getElementById('filtro-urgencia')?.value  || '';
    state.filtros.canal_origen   = document.getElementById('filtro-canal')?.value     || '';
    state.filtros.empresa_id     = document.getElementById('filtro-empresa')?.value   || '';
    state.filtros.fecha_desde    = document.getElementById('filtro-fecha-desde')?.value || '';
    state.filtros.fecha_hasta    = document.getElementById('filtro-fecha-hasta')?.value || '';
    state.page = 1;
    cargarBandeja();
  });

  // Limpiar
  document.getElementById('btn-limpiar-filtros')?.addEventListener('click', limpiarFiltros);

  // Botón nuevo caso
  document.getElementById('btn-nuevo-caso')?.addEventListener('click', () => {
    window.location.href = '/nuevo-caso.html';
  });
});

// ─── KPIs del topbar ──────────────────────────────────────────────────────────
async function cargarKpis() {
  try {
    const kpis = await asistenciasService.getKpis();
    setEl('kpi-activos',      kpis.activos           ?? '—');
    setEl('kpi-sin-asignar',  kpis.sin_abogado        ?? '—');
    setEl('kpi-criticos',     kpis.criticos_abiertos  ?? '—');
  } catch { /* silencioso */ }
}

// ─── Cargar datos ─────────────────────────────────────────────────────────────
async function cargarBandeja() {
  if (state.cargando) return;
  state.cargando = true;

  // Skeleton mientras carga
  const tbody = document.getElementById('tabla-bandeja-body');
  if (tbody) {
    tbody.innerHTML = Array.from({ length: 8 }).map(() => `
      <tr class="skeleton-row">
        ${Array.from({ length: 9 }).map(() => `<td><div class="skeleton-line"></div></td>`).join('')}
      </tr>`).join('');
  }

  try {
    const result = await asistenciasService.listar({
      ...Object.fromEntries(Object.entries(state.filtros).filter(([, v]) => v !== '')),
      page:  state.page,
      limit: state.limit,
    });

    const rows = result?.data || [];
    const meta = result?.meta || { total: rows.length, page: 1, limit: state.limit, pages: 1 };

    state.total = meta.total;
    renderFilas(rows);
    renderContador(meta);
    table.renderPagination('#paginacion', meta, cambiarPagina);
    actualizarTabs(rows, meta.total);

  } catch (err) {
    console.error('Error cargando bandeja:', err);
    toast.error('Error al cargar expedientes');
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:#dc2626">
      Error al cargar datos. Verifica la conexión con el servidor.</td></tr>`;
  } finally {
    state.cargando = false;
  }
}

// ─── Renderizar filas ─────────────────────────────────────────────────────────
function renderFilas(rows) {
  const tbody = document.getElementById('tabla-bandeja-body');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:48px;color:#94a3b8">
      <div style="font-size:32px;margin-bottom:8px">📭</div>
      No se encontraron expedientes con los filtros seleccionados.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const urg    = fmt.urgencia(r.nivel_urgencia);
    const est    = fmt.estatus(r.estatus_operativo);
    const canal  = fmt.canal(r.canal_origen);
    const sinAb  = !r.abogado_nombre;

    return `
      <tr class="urgencia-row--${r.nivel_urgencia}" style="cursor:pointer" data-id="${r.id}">
        <td>
          <span class="folio-link" onclick="verExpediente('${r.id}')">${r.folio}</span>
          ${sinAb && r.nivel_urgencia === 'critico'
            ? '<div class="row-meta" style="color:#dc2626">⚠️ Sin asignar</div>'
            : ''}
        </td>
        <td>
          <strong style="font-size:13px">${r.conductor_nombre}</strong>
          <div class="row-meta">${r.siniestro_ref || ''}</div>
        </td>
        <td style="text-align:center">
          <span class="canal-icon" title="${canal.label}">${canal.icon}</span>
        </td>
        <td style="font-size:12px">${r.empresa_nombre || '<span style="color:#94a3b8">—</span>'}</td>
        <td>${fmt.badgeHtml(urg.label, urg.class)}</td>
        <td>${fmt.badgeHtml(est.label, est.class)}</td>
        <td style="font-size:12px">${r.abogado_nombre
          ? `<span style="color:#0f172a;font-weight:600">${r.abogado_nombre}</span>`
          : '<span style="color:#94a3b8">Sin asignar</span>'
        }</td>
        <td style="font-size:11px;color:#64748b">${fmt.tiempoRelativo(r.created_at)}</td>
        <td style="text-align:center">
          <div style="display:flex;gap:4px;justify-content:center">
            <button class="btn btn-ghost btn-sm"
              onclick="verExpediente('${r.id}')" title="Ver detalle">
              Ver
            </button>
            ${sinAb ? `<button class="btn btn-primary btn-sm"
              onclick="verExpediente('${r.id}')" title="Asignar abogado">
              Asignar
            </button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ─── Actualizar contadores en tabs ────────────────────────────────────────────
function actualizarTabs(rows, total) {
  // Actualiza solo el tab activo con el total
  const tabActivo = document.querySelector('[data-tab].active');
  if (tabActivo && total > 0) {
    const texto = tabActivo.dataset.tab === 'todos'
      ? `Todos (${total})`
      : `${tabActivo.textContent.split('(')[0].trim()} (${total})`;
    tabActivo.textContent = texto;
  }
}

// ─── Contador ─────────────────────────────────────────────────────────────────
function renderContador(meta) {
  const el = document.getElementById('contador-resultados');
  if (!el) return;
  const from = ((meta.page - 1) * meta.limit) + 1;
  const to   = Math.min(meta.page * meta.limit, meta.total);
  el.textContent = meta.total > 0 ? `${from}–${to} de ${meta.total} expedientes` : '0 expedientes';
}

// ─── Cargar empresas en el select ─────────────────────────────────────────────
async function inicializarFiltros() {
  try {
    const empresas = await catalogosService.getEmpresas();
    const sel = document.getElementById('filtro-empresa');
    if (sel && empresas?.length) {
      empresas.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.nombre_comercial || e.razon_social;
        sel.appendChild(opt);
      });
    }
    // Si venimos con empresa_id en la URL, seleccionarla
    const params = new URLSearchParams(window.location.search);
    const empId = params.get('empresa_id');
    if (empId && sel) sel.value = empId;
  } catch { /* silencioso */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function limpiarFiltros() {
  state.filtros = {};
  state.page    = 1;
  ['filtro-buscar','filtro-urgencia','filtro-canal','filtro-empresa',
   'filtro-fecha-desde','filtro-fecha-hasta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-tab="todos"]')?.classList.add('active');
  cargarBandeja();
}

function cambiarPagina(page) {
  state.page = page;
  cargarBandeja();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function verExpediente(id) {
  window.location.href = `/detalle.html?id=${id}`;
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function quitarFiltroAbogado() {
  state.filtros.abogado_id = '';
  document.getElementById('filtro-abogado-banner')?.remove();
  // Limpiar ambos params de la URL sin recargar la página
  const url = new URL(window.location.href);
  url.searchParams.delete('abogado_id');
  url.searchParams.delete('proveedor_id');
  window.history.replaceState({}, '', url);
  state.page = 1;
  cargarBandeja();
}

window.cambiarPagina      = cambiarPagina;
window.verExpediente      = verExpediente;
window.quitarFiltroAbogado = quitarFiltroAbogado;
