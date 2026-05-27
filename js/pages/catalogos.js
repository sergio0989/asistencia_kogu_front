'use strict';
/**
 * catalogos.js — Gestión de empresas y convenios.
 * Depende de: api.js, catalogos.service.js, fmt, toast, modal, table
 */

const state = { page: 1, limit: 15, filtros: {}, editandoId: null };

document.addEventListener('DOMContentLoaded', async () => {
  await cargarEmpresas();

  let timer;
  document.getElementById('filtro-buscar')?.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.filtros.buscar = e.target.value.trim(); state.page = 1; cargarEmpresas(); }, 350);
  });
  document.getElementById('filtro-activo')?.addEventListener('change', e => {
    state.filtros.activo = e.target.value; state.page = 1; cargarEmpresas();
  });
  document.getElementById('btn-limpiar')?.addEventListener('click', limpiarFiltros);
  document.getElementById('btn-nueva-empresa')?.addEventListener('click', abrirModalCrear);
  document.getElementById('btn-guardar-empresa')?.addEventListener('click', guardarEmpresa);
});

// ─── Cargar lista ─────────────────────────────────────────────────────────────
async function cargarEmpresas() {
  table.showSkeleton('#tabla-empresas-body', 7, 8);
  try {
    // El endpoint no tiene paginación nativa aún — filtramos client-side
    const todas = await catalogosService.getEmpresas() || [];

    // Filtro client-side
    let rows = todas;
    if (state.filtros.buscar) {
      const q = state.filtros.buscar.toLowerCase();
      rows = rows.filter(e =>
        e.razon_social?.toLowerCase().includes(q) ||
        e.nombre_comercial?.toLowerCase().includes(q) ||
        e.rfc?.toLowerCase().includes(q)
      );
    }
    if (state.filtros.activo !== undefined && state.filtros.activo !== '') {
      rows = rows.filter(e => String(e.activo) === state.filtros.activo);
    }

    // Paginación client-side
    const total  = rows.length;
    const offset = (state.page - 1) * state.limit;
    const pagina = rows.slice(offset, offset + state.limit);
    const meta   = { total, page: state.page, limit: state.limit, pages: Math.ceil(total / state.limit) };

    document.getElementById('contador-empresas').textContent =
      `${total} empresa${total !== 1 ? 's' : ''}`;

    await renderFilas(pagina);
    table.renderPagination('#paginacion', meta, p => { state.page = p; cargarEmpresas(); });
  } catch (err) {
    toast.error('Error al cargar empresas');
    console.error(err);
  }
}

// ─── Renderizar filas ─────────────────────────────────────────────────────────
async function renderFilas(rows) {
  const tbody = document.querySelector('#tabla-empresas-body');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8">
      No se encontraron empresas.</td></tr>`;
    return;
  }

  // Cargar convenios por empresa en paralelo
  const conveniosPorEmpresa = {};
  await Promise.all(rows.map(async e => {
    try {
      const cvs = await catalogosService.getConvenios(e.id);
      conveniosPorEmpresa[e.id] = cvs || [];
    } catch { conveniosPorEmpresa[e.id] = []; }
  }));

  tbody.innerHTML = rows.map(e => {
    const inicial  = (e.nombre_comercial || e.razon_social || '?').charAt(0).toUpperCase();
    const convenios = conveniosPorEmpresa[e.id] || [];
    const convHtml  = convenios.length
      ? convenios.map(c => `<span class="convenio-tag">${c.nombre}</span>`).join('')
      : '<span style="color:#94a3b8;font-size:12px">Sin convenios</span>';
    const estado = e.activo
      ? '<span class="badge success">● Activa</span>'
      : '<span class="badge" style="background:#f1f5f9;color:#94a3b8">● Inactiva</span>';

    return `
      <tr data-id="${e.id}">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="empresa-logo">${inicial}</div>
            <div>
              <strong>${e.razon_social}</strong>
              ${e.nombre_comercial ? `<div style="font-size:12px;color:#64748b">${e.nombre_comercial}</div>` : ''}
            </div>
          </div>
        </td>
        <td style="font-family:monospace;font-size:12px;color:#475569">${e.rfc || '—'}</td>
        <td style="color:#475569;font-size:12px">${e.email_contacto || '—'}</td>
        <td style="color:#475569">${e.tel_contacto ? fmt.telefono(e.tel_contacto) : '—'}</td>
        <td>${convHtml}</td>
        <td>${estado}</td>
        <td style="text-align:center">
          <div style="display:flex;gap:6px;justify-content:center">
            <button class="btn btn-ghost btn-sm" onclick="abrirModalEditar('${e.id}')" title="Editar">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="verExpedientes('${e.id}')" title="Ver expedientes">📋</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ─── Modal crear ──────────────────────────────────────────────────────────────
function abrirModalCrear() {
  state.editandoId = null;
  limpiarFormEmpresa();
  document.getElementById('modal-empresa-titulo').textContent = 'Nueva empresa';
  document.getElementById('seccion-convenios').style.display = 'none';
  modal.open('modal-empresa');
}

// ─── Modal editar ─────────────────────────────────────────────────────────────
async function abrirModalEditar(id) {
  try {
    const e = await catalogosService.getEmpresa(id);
    state.editandoId = id;
    document.getElementById('modal-empresa-titulo').textContent = e.nombre_comercial || e.razon_social;
    document.getElementById('e-razon-social').value    = e.razon_social    || '';
    document.getElementById('e-nombre-comercial').value= e.nombre_comercial|| '';
    document.getElementById('e-rfc').value             = e.rfc             || '';
    document.getElementById('e-email').value           = e.email_contacto  || '';
    document.getElementById('e-telefono').value        = e.tel_contacto    || '';

    // Cargar convenios
    const convenios = await catalogosService.getConvenios(id);
    renderConvenios(id, convenios);
    document.getElementById('seccion-convenios').style.display = 'block';
    modal.open('modal-empresa');
  } catch (err) {
    toast.error('Error al cargar la empresa');
  }
}

function renderConvenios(empresaId, convenios) {
  const lista = document.getElementById('lista-convenios');
  if (!lista) return;
  if (!convenios.length) {
    lista.innerHTML = '<p style="color:#94a3b8;font-size:13px">Sin convenios registrados</p>';
    return;
  }
  lista.innerHTML = convenios.map(c => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;
                background:#f8fafc;border-radius:8px;margin-bottom:6px;font-size:13px">
      <span><strong>${c.nombre}</strong>
        ${c.fecha_inicio ? `<span style="color:#64748b"> · ${fmt.fecha(c.fecha_inicio)}</span>` : ''}
      </span>
      <span class="badge ${c.activo ? 'success' : ''}">${c.activo ? 'Activo' : 'Inactivo'}</span>
    </div>`
  ).join('');
}

// ─── Guardar empresa ──────────────────────────────────────────────────────────
async function guardarEmpresa() {
  const razon_social     = document.getElementById('e-razon-social').value.trim();
  const nombre_comercial = document.getElementById('e-nombre-comercial').value.trim();
  const rfc              = document.getElementById('e-rfc').value.trim();
  const email_contacto   = document.getElementById('e-email').value.trim();
  const tel_contacto     = document.getElementById('e-telefono').value.trim();

  if (!razon_social) { toast.warning('La razón social es obligatoria'); return; }

  const data = {
    razon_social,
    nombre_comercial: nombre_comercial || undefined,
    rfc:              rfc              || undefined,
    email_contacto:   email_contacto   || undefined,
    tel_contacto:     tel_contacto     || undefined,
  };

  const btn = document.getElementById('btn-guardar-empresa');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    if (state.editandoId) {
      await catalogosService.actualizarEmpresa(state.editandoId, data);
      toast.success('Empresa actualizada');
    } else {
      await catalogosService.crearEmpresa(data);
      toast.success('Empresa creada correctamente');
    }
    modal.close('modal-empresa');
    limpiarFormEmpresa();
    await cargarEmpresas();
  } catch (err) {
    toast.error(err.message || 'Error al guardar la empresa');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

// ─── Ver expedientes de la empresa ───────────────────────────────────────────
function verExpedientes(empresaId) {
  window.location.href = `/bandeja.html?empresa_id=${empresaId}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function limpiarFiltros() {
  state.filtros = {}; state.page = 1;
  ['filtro-buscar','filtro-activo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  cargarEmpresas();
}

function limpiarFormEmpresa() {
  ['e-razon-social','e-nombre-comercial','e-rfc','e-email','e-telefono'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

window.abrirModalEditar = abrirModalEditar;
window.verExpedientes   = verExpedientes;
