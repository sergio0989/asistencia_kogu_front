'use strict';
/**
 * clientes.js — Cartera de clientes (Promotoría P1).
 * Depende de: api.js, clientes.service.js, agentes.service.js, catalogos.service.js,
 *             fmt, toast, modal, table, formErrors
 */

const state = { page: 1, limit: 15, filtros: {}, editandoId: null };
// ¿El usuario puede ver/asignar agentes? (cualquier rol no-agente-puro)
const PUEDE_AGENTES = authService.hasAnyRole('admin', 'supervisor', 'operador', 'promotor');

const MAPA_ERRORES = {
  nombre: 'c-nombre', rfc: 'c-rfc', telefono: 'c-telefono', email: 'c-email',
  tipo_persona: 'c-tipo-persona', origen_contacto: 'c-origen', agente_id: 'c-agente',
  promotoria_id: 'c-promotoria', aviso_privacidad_version: 'c-aviso-version',
  consentimiento_canal: 'c-consent-canal', notas: 'c-notas',
};

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([montarPickersAgente(), cargarPromotorias()]);
  await cargarClientes();

  let timer;
  document.getElementById('filtro-buscar')?.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.filtros.buscar = e.target.value.trim(); state.page = 1; cargarClientes(); }, 350);
  });
  document.getElementById('filtro-estado')?.addEventListener('change', e => {
    state.filtros.estado = e.target.value; state.page = 1; cargarClientes();
  });
  document.getElementById('filtro-agente')?.addEventListener('change', e => {
    state.filtros.agente_id = e.target.value; state.page = 1; cargarClientes();
  });
  document.getElementById('btn-limpiar')?.addEventListener('click', limpiarFiltros);
  document.getElementById('btn-nuevo-cliente')?.addEventListener('click', abrirModalCrear);
  document.getElementById('btn-guardar-cliente')?.addEventListener('click', guardarCliente);
});

// ─── Catálogos de apoyo ───────────────────────────────────────────────────────
// Bf-07: los agentes ya no se vuelcan completos (limit:200) a dos <select>;
// se buscan contra el servidor con el picker. Nada que precargar aquí: basta
// con enlazar los campos y mostrar el filtro a quien puede usarlo.
let pkFiltroAgente = null;
let pkAgenteForm   = null;

function montarPickersAgente() {
  if (!PUEDE_AGENTES) {
    document.getElementById('grupo-agente').style.display = 'none';
    return;
  }

  const opciones = {
    titulo:      'Seleccionar agente',
    placeholder: 'Nombre, RFC o correo…',
    vacio:       'Escribe para buscar agentes.',
    buscar:      (q, page) => agentesService.listar({ buscar: q, page, limit: 20 }),
    item:        a => ({ id: a.id, titulo: a.nombre, sub: a.email || a.rfc || '—' }),
  };

  pkFiltroAgente = picker.bind({
    inputId: 'filtro-agente-label', hiddenId: 'filtro-agente',
    botonId: 'filtro-agente-btn',   limpiarId: 'filtro-agente-clear',
    ...opciones,
  });
  document.getElementById('grupo-filtro-agente').style.display = '';

  pkAgenteForm = picker.bind({
    inputId: 'c-agente-label', hiddenId: 'c-agente',
    botonId: 'c-agente-btn',   limpiarId: 'c-agente-clear',
    ...opciones,
  });
}

async function cargarPromotorias() {
  if (!PUEDE_AGENTES) return; // agente puro: el API fuerza su promotoría
  try {
    const res = await catalogosService.getPromotorias();
    const proms = res || [];
    if (proms.length) {
      document.getElementById('grupo-promotoria').style.display = proms.length > 1 ? 'block' : 'none';
      document.getElementById('c-promotoria').innerHTML =
        proms.map(p => `<option value="${fmt.esc(p.id)}">${fmt.esc(p.nombre)}</option>`).join('');
    }
  } catch { /* admin sin promotorías visibles: el alta usará lo que mande el form */ }
}

// ─── Cargar lista ─────────────────────────────────────────────────────────────
async function cargarClientes() {
  table.showSkeleton('#tabla-clientes-body', 6, 8);
  try {
    const result = await clientesService.listar({ ...state.filtros, page: state.page, limit: state.limit });
    const rows = result?.data || [];
    const meta = result?.meta || { total: rows.length, page: 1, limit: state.limit, pages: 1 };

    renderFilas(rows);
    document.getElementById('contador-clientes').textContent =
      `${meta.total} cliente${meta.total !== 1 ? 's' : ''}`;
    table.renderPagination('#paginacion', meta, p => { state.page = p; cargarClientes(); });
  } catch (err) {
    toast.error('Error al cargar clientes');
    console.error(err);
  }
}

// ─── Render filas ─────────────────────────────────────────────────────────────
function renderFilas(rows) {
  const tbody = document.querySelector('#tabla-clientes-body');
  if (!tbody) return;
  if (!rows.length) {
    // estático: estado vacío
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#94a3b8">
      No se encontraron clientes con los filtros seleccionados.</td></tr>`;
    return;
  }
  // c.id: UUID propio → tal cual en navegación; demás datos de API escapados.
  tbody.innerHTML = rows.map(c => {
    const inicial = (c.nombre || '?').charAt(0).toUpperCase();
    return `
      <tr style="cursor:pointer" onclick="verCliente('${c.id}')">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="cli-avatar">${fmt.esc(inicial)}</div>
            <div>
              <strong>${fmt.esc(c.nombre)}</strong>
              <div style="font-size:11px;color:#94a3b8">${c.tipo_persona === 'moral' ? 'Persona moral' : 'Persona física'}${c.rfc ? ' · ' + fmt.esc(c.rfc) : ''}</div>
            </div>
          </div>
        </td>
        <td style="font-size:12px;color:#475569">
          ${c.telefono ? fmt.esc(fmt.telefono(c.telefono)) : '—'}
          ${c.email ? `<div style="color:#94a3b8">${fmt.esc(c.email)}</div>` : ''}
        </td>
        <td>${fmt.estadoClienteBadge(c.estado)}</td>
        <td style="text-align:center">${fmt.esc(c.polizas_count ?? 0)}</td>
        <td style="font-size:12px;color:#475569">${c.agente_nombre ? fmt.esc(c.agente_nombre) : '—'}</td>
        <td style="font-size:12px;color:#94a3b8">${fmt.fecha(c.created_at)}</td>
        <td style="text-align:center">
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); abrirModalEditar('${c.id}')" title="Editar">✏️</button>
        </td>
      </tr>`;
  }).join('');
}

// ─── Navegar a ficha 360 ──────────────────────────────────────────────────────
function verCliente(id) {
  window.location.href = `/comercial/cliente.html?id=${id}`;
}

// ─── Modal crear ──────────────────────────────────────────────────────────────
function abrirModalCrear() {
  state.editandoId = null;
  limpiarForm();
  document.getElementById('modal-cliente-titulo').textContent = 'Nuevo cliente';
  document.getElementById('grupo-consentimiento').style.display = '';
  modal.open('modal-cliente');
}

// ─── Modal editar ─────────────────────────────────────────────────────────────
async function abrirModalEditar(id) {
  try {
    const c = await clientesService.obtener(id);
    state.editandoId = id;
    limpiarForm();
    document.getElementById('modal-cliente-titulo').textContent = 'Editar cliente';
    document.getElementById('c-nombre').value       = c.nombre || '';
    document.getElementById('c-tipo-persona').value = c.tipo_persona || 'fisica';
    document.getElementById('c-rfc').value          = c.rfc || '';
    document.getElementById('c-telefono').value     = c.telefono || '';
    document.getElementById('c-email').value        = c.email || '';
    document.getElementById('c-origen').value       = c.origen_contacto || '';
    document.getElementById('c-notas').value        = c.notas || '';
    // El detalle ya trae el nombre del agente: no hace falta buscarlo.
    if (PUEDE_AGENTES) pkAgenteForm?.set(c.agente_id || '', c.agente_nombre || '');
    // En edición el consentimiento ya existe; se oculta el bloque obligatorio.
    document.getElementById('grupo-consentimiento').style.display = 'none';
    modal.open('modal-cliente');
  } catch (err) {
    toast.error('Error al cargar el cliente');
  }
}

// ─── Guardar ──────────────────────────────────────────────────────────────────
async function guardarCliente() {
  formErrors.limpiar();
  const nombre = document.getElementById('c-nombre').value.trim();
  if (!nombre) { toast.warning('El nombre es obligatorio'); return; }

  const data = {
    nombre,
    tipo_persona:    document.getElementById('c-tipo-persona').value,
    rfc:             document.getElementById('c-rfc').value.trim() || undefined,
    telefono:        document.getElementById('c-telefono').value.trim() || undefined,
    email:           document.getElementById('c-email').value.trim() || undefined,
    origen_contacto: document.getElementById('c-origen').value.trim() || undefined,
    notas:           document.getElementById('c-notas').value.trim() || undefined,
  };
  if (PUEDE_AGENTES) {
    data.agente_id = document.getElementById('c-agente').value || null;
    const prom = document.getElementById('c-promotoria').value;
    if (prom) data.promotoria_id = prom;
  }

  if (!state.editandoId) {
    // DP-07: el consentimiento es obligatorio en el alta (espejo del validador).
    const aviso = document.getElementById('c-aviso-version').value.trim();
    const canal = document.getElementById('c-consent-canal').value;
    if (!aviso || !canal) {
      toast.warning('El consentimiento (versión del aviso y canal) es obligatorio');
      return;
    }
    data.aviso_privacidad_version = aviso;
    data.consentimiento_canal     = canal;
  }

  const btn = document.getElementById('btn-guardar-cliente');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    if (state.editandoId) {
      await clientesService.actualizar(state.editandoId, data);
      toast.success('Cliente actualizado');
    } else {
      await clientesService.crear(data);
      toast.success('Cliente creado');
    }
    modal.close('modal-cliente');
    await cargarClientes();
  } catch (err) {
    if (!formErrors.aplicar(err, MAPA_ERRORES)) toast.error(err.message || 'Error al guardar el cliente');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function limpiarFiltros() {
  state.filtros = {}; state.page = 1;
  ['filtro-buscar', 'filtro-estado'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  pkFiltroAgente?.set('', '');
  cargarClientes();
}

function limpiarForm() {
  formErrors.limpiar();
  ['c-nombre', 'c-rfc', 'c-telefono', 'c-email', 'c-origen', 'c-notas',
   'c-aviso-version'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('c-tipo-persona').value = 'fisica';
  document.getElementById('c-consent-canal').value = '';
  if (PUEDE_AGENTES) pkAgenteForm?.set('', '');
}

window.verCliente       = verCliente;
window.abrirModalEditar = abrirModalEditar;
