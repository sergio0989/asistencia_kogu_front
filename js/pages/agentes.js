'use strict';
/**
 * agentes.js — Agentes de la promotoría (P1). Solo admin/sup/promotor (el API
 * y el sidebar lo restringen). Depende de: api.js, agentes.service.js,
 * catalogos.service.js, fmt, toast, modal, table, formErrors
 */

const state = { page: 1, limit: 15, filtros: {}, editandoId: null, docsAgenteId: null, filas: [] };

const MAPA = {
  nombre: 'a-nombre', rfc: 'a-rfc', telefono: 'a-telefono', email: 'a-email',
  promotoria_id: 'a-promotoria', cedula_tipo: 'a-cedula-tipo',
  cedula_numero: 'a-cedula-numero', cedula_vigencia: 'a-cedula-vigencia',
};

document.addEventListener('DOMContentLoaded', async () => {
  await cargarPromotorias();
  await cargarAgentes();

  let timer;
  document.getElementById('filtro-buscar')?.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.filtros.buscar = e.target.value.trim(); state.page = 1; cargarAgentes(); }, 350);
  });
  document.getElementById('filtro-activo')?.addEventListener('change', e => { state.filtros.activo = e.target.value; state.page = 1; cargarAgentes(); });
  document.getElementById('btn-limpiar')?.addEventListener('click', limpiarFiltros);
  document.getElementById('btn-nuevo-agente')?.addEventListener('click', abrirModalCrear);
  document.getElementById('btn-guardar-agente')?.addEventListener('click', guardarAgente);
  document.getElementById('btn-subir-doc-agente')?.addEventListener('click', subirDocumento);
});

async function cargarPromotorias() {
  try {
    const proms = await catalogosService.getPromotorias() || [];
    document.getElementById('a-promotoria').innerHTML =
      proms.map(p => `<option value="${fmt.esc(p.id)}">${fmt.esc(p.nombre)}</option>`).join('');
    document.getElementById('grupo-promotoria').style.display = proms.length > 1 ? 'block' : 'none';
  } catch { /* el promotor puede no ver el catálogo; el API usa su scope */ }
}

// ─── Lista ────────────────────────────────────────────────────────────────────
async function cargarAgentes() {
  table.showSkeleton('#tabla-agentes-body', 7, 6);
  try {
    const result = await agentesService.listar({ ...state.filtros, page: state.page, limit: state.limit });
    const rows = result?.data || [];
    const meta = result?.meta || { total: rows.length, page: 1, limit: state.limit, pages: 1 };
    state.filas = rows;          // el editar sale de aquí, no de otra descarga
    renderFilas(rows);
    document.getElementById('contador-agentes').textContent = `${meta.total} agente${meta.total !== 1 ? 's' : ''}`;
    table.renderPagination('#paginacion', meta, p => { state.page = p; cargarAgentes(); });
  } catch (err) {
    toast.error('Error al cargar agentes');
    console.error(err);
  }
}

// Estado de la cédula según su vigencia.
function estadoCedula(fecha) {
  if (!fecha) return { label: '—', class: 'badge-secondary' };
  const dias = Math.floor((new Date(fecha) - new Date()) / 86400000);
  if (dias < 0)  return { label: 'Vencida',    class: 'badge-danger' };
  if (dias <= 30) return { label: 'Por vencer', class: 'badge-warning' };
  return { label: 'Vigente', class: 'badge-success' };
}

function renderFilas(rows) {
  const tbody = document.querySelector('#tabla-agentes-body');
  if (!tbody) return;
  if (!rows.length) {
    // estático: estado vacío
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8">No se encontraron agentes.</td></tr>`;
    return;
  }
  // a.id: UUID propio → onclick; demás datos escapados.
  tbody.innerHTML = rows.map(a => {
    const inicial = (a.nombre || '?').charAt(0).toUpperCase();
    const ced = estadoCedula(a.cedula_vigencia);
    return `
      <tr>
        <td><div style="display:flex;align-items:center;gap:10px">
          <div class="ag-avatar">${fmt.esc(inicial)}</div>
          <div><strong>${fmt.esc(a.nombre)}</strong>${a.rfc ? `<div style="font-size:11px;color:#94a3b8">${fmt.esc(a.rfc)}</div>` : ''}</div>
        </div></td>
        <td style="font-size:12px;color:#475569">${a.telefono ? fmt.esc(fmt.telefono(a.telefono)) : '—'}${a.email ? `<div style="color:#94a3b8">${fmt.esc(a.email)}</div>` : ''}</td>
        <td style="font-size:12px">${a.cedula_numero ? fmt.esc(a.cedula_numero) : '—'}${a.cedula_tipo ? ` <span style="color:#94a3b8">(${fmt.esc(a.cedula_tipo)})</span>` : ''}</td>
        <td>${a.cedula_vigencia ? `${fmt.fecha(a.cedula_vigencia)} ${fmt.badgeHtml(ced.label, ced.class)}` : '—'}</td>
        <td style="text-align:center">${fmt.esc(a.clientes_count ?? 0)}</td>
        <td>${a.activo ? '<span><span class="status-dot dot-active"></span>Activo</span>' : '<span style="color:#94a3b8"><span class="status-dot dot-inactive"></span>Inactivo</span>'}</td>
        <td style="text-align:center">
          <button class="btn btn-ghost btn-sm" onclick="abrirModalEditar('${a.id}')" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="abrirDocs('${a.id}','${fmt.esc(String(a.nombre||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"))}')" title="Documentos">📎</button>
        </td>
      </tr>`;
  }).join('');
}

// ─── Crear / editar ───────────────────────────────────────────────────────────
function abrirModalCrear() {
  state.editandoId = null;
  limpiarForm();
  document.getElementById('modal-agente-titulo').textContent = 'Nuevo agente';
  document.getElementById('grupo-activo').style.display = 'none';
  modal.open('modal-agente');
}

function abrirModalEditar(id) {
  // Bf-07: antes se volvía a bajar la tabla entera (limit:500) para encontrar
  // una fila que ya estaba en pantalla — y con el tope de 100 del backend eso
  // devolvía 422, así que el modal no abría. La fila ya está en `state.filas`.
  const a = state.filas.find(x => x.id === id);
  if (!a) { toast.error('Agente no encontrado; recarga la lista'); return; }
  try {
    state.editandoId = id;
    limpiarForm();
    document.getElementById('modal-agente-titulo').textContent = 'Editar agente';
    document.getElementById('a-nombre').value          = a.nombre || '';
    document.getElementById('a-rfc').value             = a.rfc || '';
    document.getElementById('a-telefono').value        = a.telefono || '';
    document.getElementById('a-email').value           = a.email || '';
    document.getElementById('a-cedula-tipo').value     = a.cedula_tipo || '';
    document.getElementById('a-cedula-numero').value   = a.cedula_numero || '';
    document.getElementById('a-cedula-vigencia').value = (a.cedula_vigencia || '').slice(0, 10);
    document.getElementById('a-activo').checked        = a.activo;
    document.getElementById('grupo-activo').style.display = 'block';
    if (a.promotoria_id) document.getElementById('a-promotoria').value = a.promotoria_id;
    modal.open('modal-agente');
  } catch (err) {
    // Antes no había try/catch: cualquier fallo dejaba el modal a medio armar.
    console.error('No se pudo abrir el editor de agente', err);
    toast.error('No se pudo abrir el editor del agente');
    state.editandoId = null;
  }
}

async function guardarAgente() {
  formErrors.limpiar();
  const nombre = document.getElementById('a-nombre').value.trim();
  if (!nombre) { toast.warning('El nombre es obligatorio'); return; }
  const data = {
    nombre,
    rfc:             document.getElementById('a-rfc').value.trim() || undefined,
    telefono:        document.getElementById('a-telefono').value.trim() || undefined,
    email:           document.getElementById('a-email').value.trim() || undefined,
    cedula_tipo:     document.getElementById('a-cedula-tipo').value.trim() || undefined,
    cedula_numero:   document.getElementById('a-cedula-numero').value.trim() || undefined,
    cedula_vigencia: document.getElementById('a-cedula-vigencia').value || undefined,
  };
  if (state.editandoId) {
    data.activo = document.getElementById('a-activo').checked;
  } else {
    data.promotoria_id = document.getElementById('a-promotoria').value || undefined;
  }

  const btn = document.getElementById('btn-guardar-agente');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    if (state.editandoId) { await agentesService.actualizar(state.editandoId, data); toast.success('Agente actualizado'); }
    else                  { await agentesService.crear(data); toast.success('Agente creado'); }
    modal.close('modal-agente');
    await cargarAgentes();
  } catch (err) {
    if (!formErrors.aplicar(err, MAPA)) toast.error(err.message || 'Error al guardar el agente');
  } finally { btn.disabled = false; btn.textContent = 'Guardar'; }
}

// ─── Documentos ───────────────────────────────────────────────────────────────
async function abrirDocs(id, nombre) {
  state.docsAgenteId = id;
  document.getElementById('docs-agente-nombre').textContent = nombre;
  ['doc-tipo', 'doc-vencimiento'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('doc-archivo').value = '';
  await cargarDocs();
  modal.open('modal-docs');
}

async function cargarDocs() {
  try {
    const docs = await agentesService.getDocumentos(state.docsAgenteId) || [];
    const cont = document.getElementById('docs-list');
    if (!docs.length) { cont.innerHTML = '<p style="color:#94a3b8;font-size:13px">Sin documentos.</p>'; return; }
    cont.innerHTML = docs.map(d => {
      const est = estadoCedula(d.fecha_vencimiento);
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f8fafc;font-size:13px">
        <span>📎 ${fmt.esc(d.nombre)}${d.tipo_doc ? ` <span style="color:#94a3b8">(${fmt.esc(d.tipo_doc)})</span>` : ''}</span>
        <span>${d.fecha_vencimiento ? `${fmt.fecha(d.fecha_vencimiento)} ${fmt.badgeHtml(est.label, est.class)}` : ''}</span>
      </div>`;
    }).join('');
  } catch { document.getElementById('docs-list').innerHTML = '<p style="color:#dc2626;font-size:13px">Error al cargar documentos.</p>'; }
}

async function subirDocumento() {
  const file = document.getElementById('doc-archivo').files?.[0];
  if (!file) { toast.warning('Selecciona un archivo'); return; }
  const tipo_doc = document.getElementById('doc-tipo').value.trim();
  const fecha_vencimiento = document.getElementById('doc-vencimiento').value || '';
  const btn = document.getElementById('btn-subir-doc-agente');
  btn.disabled = true; btn.textContent = 'Subiendo…';
  try {
    await agentesService.subirDocumento(state.docsAgenteId, file, { tipo_doc, fecha_vencimiento });
    toast.success('Documento subido');
    document.getElementById('doc-archivo').value = '';
    await cargarDocs();
  } catch (err) { toast.error(err.message || 'Error al subir el documento'); }
  finally { btn.disabled = false; btn.textContent = 'Subir documento'; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function limpiarFiltros() {
  state.filtros = {}; state.page = 1;
  ['filtro-buscar', 'filtro-activo'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  cargarAgentes();
}
function limpiarForm() {
  formErrors.limpiar();
  ['a-nombre', 'a-rfc', 'a-telefono', 'a-email', 'a-cedula-tipo', 'a-cedula-numero', 'a-cedula-vigencia']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('a-activo').checked = true;
}

window.abrirModalEditar = abrirModalEditar;
window.abrirDocs        = abrirDocs;
