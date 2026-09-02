'use strict';
/**
 * polizas.js — Cartera de pólizas (Promotoría P1).
 * Depende de: api.js, polizas.service.js, clientes.service.js, catalogos.service.js,
 *             fmt, toast, modal, picker, table, formErrors
 */

const state = { page: 1, limit: 15, filtros: {}, polizaNuevaId: null };

// Picker de cliente (Bf-07): sustituye al <select> que bajaba la cartera
// completa con limit:500 — el backend topa en 100, devolvía 422 y el select
// quedaba vacío sin aviso.
let pickerCliente = null;

const MAPA = {
  cliente_id: 'p-cliente', aseguradora_id: 'p-aseguradora', ramo_id: 'p-ramo',
  numero_poliza: 'p-numero', producto: 'p-producto', vigencia_inicio: 'p-vig-inicio',
  vigencia_fin: 'p-vig-fin', prima_total: 'p-prima', forma_pago: 'p-forma-pago',
  comision_pct: 'p-comision', notas: 'p-notas',
};

document.addEventListener('DOMContentLoaded', async () => {
  pickerCliente = picker.bind({
    inputId:     'p-cliente-label',
    hiddenId:    'p-cliente',
    botonId:     'p-cliente-btn',
    titulo:      'Seleccionar cliente',
    placeholder: 'Nombre, RFC o teléfono…',
    vacio:       'Escribe para buscar en la cartera.',
    buscar:      (q, page) => clientesService.listar({ buscar: q, page, limit: 20 }),
    item:        c => ({
      id:     c.id,
      titulo: c.nombre,
      sub:    `${c.rfc || 's/RFC'} · ${c.telefono ? fmt.telefono(c.telefono) : '—'}`,
    }),
  });

  await Promise.all([cargarRamos(), cargarAseguradoras()]);
  await cargarPolizas();

  let timer;
  document.getElementById('filtro-buscar')?.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.filtros.buscar = e.target.value.trim(); state.page = 1; cargarPolizas(); }, 350);
  });
  ['filtro-estatus', 'filtro-ramo', 'filtro-aseguradora'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => { aplicarFiltros(); });
  });
  document.getElementById('filtro-venc-desde')?.addEventListener('change', aplicarFiltros);
  document.getElementById('filtro-venc-hasta')?.addEventListener('change', aplicarFiltros);
  document.getElementById('btn-limpiar')?.addEventListener('click', limpiarFiltros);
  document.getElementById('btn-nueva-poliza')?.addEventListener('click', () => abrirModalCrear());
  document.getElementById('btn-guardar-poliza')?.addEventListener('click', guardarPoliza);
  document.getElementById('btn-add-asist')?.addEventListener('click', () => agregarAsistRow());
  document.getElementById('btn-ir-poliza')?.addEventListener('click', () => {
    if (state.polizaNuevaId) window.location.href = `/comercial/poliza.html?id=${state.polizaNuevaId}`;
  });

  // Abrir modal prefilleado desde la ficha del cliente
  const params = new URLSearchParams(window.location.search);
  if (params.get('nuevo')) abrirModalCrear(params.get('cliente_id'));
});

function aplicarFiltros() {
  state.filtros.estatus        = document.getElementById('filtro-estatus').value;
  state.filtros.ramo_id        = document.getElementById('filtro-ramo').value;
  state.filtros.aseguradora_id = document.getElementById('filtro-aseguradora').value;
  state.filtros.vigencia_fin_desde = document.getElementById('filtro-venc-desde').value;
  state.filtros.vigencia_fin_hasta = document.getElementById('filtro-venc-hasta').value;
  state.page = 1; cargarPolizas();
}

// ─── Catálogos de apoyo ───────────────────────────────────────────────────────
async function cargarRamos() {
  try {
    const ramos = await catalogosService.getRamos() || [];
    const opts = ramos.map(r => `<option value="${fmt.esc(r.id)}">${fmt.esc(r.nombre)}</option>`).join('');
    document.getElementById('filtro-ramo').innerHTML = '<option value="">Todos los ramos</option>' + opts;
    document.getElementById('p-ramo').innerHTML = '<option value="">— Seleccionar —</option>' + opts;
  } catch (err) {
    console.error('No se pudieron cargar los ramos', err);
    toast.error('No se pudieron cargar los ramos');
  }
}
async function cargarAseguradoras() {
  try {
    const emp = await catalogosService.getEmpresas() || [];
    const opts = emp.map(e => `<option value="${fmt.esc(e.id)}">${fmt.esc(e.razon_social || e.nombre_comercial)}</option>`).join('');
    document.getElementById('filtro-aseguradora').innerHTML = '<option value="">Todas las aseguradoras</option>' + opts;
    document.getElementById('p-aseguradora').innerHTML = '<option value="">— Seleccionar —</option>' + opts;
  } catch (err) {
    console.error('No se pudieron cargar las aseguradoras', err);
    toast.error('No se pudieron cargar las aseguradoras');
  }
}

// ─── Cargar lista ─────────────────────────────────────────────────────────────
async function cargarPolizas() {
  table.showSkeleton('#tabla-polizas-body', 8, 8);
  try {
    const result = await polizasService.listar({ ...state.filtros, page: state.page, limit: state.limit });
    const rows = result?.data || [];
    const meta = result?.meta || { total: rows.length, page: 1, limit: state.limit, pages: 1 };
    renderFilas(rows);
    document.getElementById('contador-polizas').textContent = `${meta.total} póliza${meta.total !== 1 ? 's' : ''}`;
    table.renderPagination('#paginacion', meta, p => { state.page = p; cargarPolizas(); });
  } catch (err) {
    toast.error('Error al cargar pólizas');
    console.error(err);
  }
}

function renderFilas(rows) {
  const tbody = document.querySelector('#tabla-polizas-body');
  if (!tbody) return;
  if (!rows.length) {
    // estático: estado vacío
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8">
      No se encontraron pólizas con los filtros seleccionados.</td></tr>`;
    return;
  }
  // p.id: UUID propio → navegación; demás datos escapados.
  tbody.innerHTML = rows.map(p => `
    <tr style="cursor:pointer" onclick="window.location.href='/comercial/poliza.html?id=${p.id}'">
      <td><strong>${fmt.esc(p.numero_poliza)}</strong></td>
      <td style="font-size:12px">${fmt.esc(p.cliente_nombre || '—')}</td>
      <td>${fmt.esc(p.ramo_clave || '—')}</td>
      <td style="font-size:12px">${fmt.esc(p.aseguradora_nombre || '—')}</td>
      <td>${fmt.fecha(p.vigencia_fin)} ${p.dias_para_vencer != null ? `<span style="color:#94a3b8;font-size:11px">(${fmt.esc(p.dias_para_vencer)}d)</span>` : ''}</td>
      <td>${fmt.moneda(p.prima_total)}</td>
      <td style="font-size:12px;text-transform:capitalize">${fmt.esc(p.forma_pago || '—')}</td>
      <td>${fmt.estatusPolizaBadge(p.estatus)}</td>
    </tr>`).join('');
}

// ─── Modal crear ──────────────────────────────────────────────────────────────
async function abrirModalCrear(clienteId) {
  limpiarForm();
  agregarAsistRow();
  modal.open('modal-poliza');

  // Viene prellenado desde la ficha del cliente: hay que resolver su nombre
  // para el campo visible, porque el picker ya no tiene la lista en memoria.
  if (clienteId) {
    pickerCliente?.set(clienteId, '');
    try {
      const c = await clientesService.obtener(clienteId);
      pickerCliente?.set(clienteId, c?.nombre || '');
    } catch (err) {
      console.error('No se pudo resolver el cliente prellenado', err);
      toast.warning('No se pudo cargar el cliente; selecciónalo manualmente');
      pickerCliente?.limpiar();
    }
  }
}

function agregarAsistRow(tipo = '', eventos = '') {
  const cont = document.getElementById('asist-list');
  const row = document.createElement('div');
  row.className = 'asist-row';
  // inputs vacíos: el usuario teclea; no se interpola dato de API aquí.
  row.innerHTML = `
    <input type="text" class="form-control asist-tipo" placeholder="Tipo (p. ej. LEG)" maxlength="20">
    <input type="number" class="form-control asist-eventos" placeholder="Eventos" min="0" style="max-width:120px">
    <button type="button" class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">✕</button>`;
  cont.appendChild(row);
  if (tipo) row.querySelector('.asist-tipo').value = tipo;
  if (eventos !== '') row.querySelector('.asist-eventos').value = eventos;
}

function recolectarAsistencias() {
  const rows = [...document.querySelectorAll('#asist-list .asist-row')];
  const arr = rows.map(r => ({
    tipo: r.querySelector('.asist-tipo').value.trim(),
    eventos: parseInt(r.querySelector('.asist-eventos').value, 10),
  })).filter(a => a.tipo && !Number.isNaN(a.eventos));
  return arr.length ? arr : undefined;
}

async function guardarPoliza() {
  formErrors.limpiar();
  const cliente_id     = document.getElementById('p-cliente').value;
  const aseguradora_id = document.getElementById('p-aseguradora').value;
  const ramo_id        = document.getElementById('p-ramo').value;
  const numero_poliza  = document.getElementById('p-numero').value.trim();
  const vigencia_inicio = document.getElementById('p-vig-inicio').value;
  const vigencia_fin    = document.getElementById('p-vig-fin').value;
  const prima_total     = document.getElementById('p-prima').value;
  const forma_pago      = document.getElementById('p-forma-pago').value;

  if (!cliente_id)     { toast.warning('Selecciona el cliente'); return; }
  if (!numero_poliza)  { toast.warning('El número de póliza es obligatorio'); return; }
  if (!vigencia_inicio || !vigencia_fin) { toast.warning('Indica las vigencias'); return; }
  if (new Date(vigencia_fin) <= new Date(vigencia_inicio)) { toast.warning('La vigencia fin debe ser posterior al inicio'); return; }
  if (!prima_total)    { toast.warning('La prima total es obligatoria'); return; }

  const data = {
    cliente_id, aseguradora_id, ramo_id, numero_poliza,
    producto: document.getElementById('p-producto').value.trim() || undefined,
    vigencia_inicio, vigencia_fin,
    prima_total: Number(prima_total),
    forma_pago,
    comision_pct: document.getElementById('p-comision').value ? Number(document.getElementById('p-comision').value) : undefined,
    asistencias_incluidas: recolectarAsistencias(),
    notas: document.getElementById('p-notas').value.trim() || undefined,
  };

  const btn = document.getElementById('btn-guardar-poliza');
  btn.disabled = true; btn.textContent = 'Creando…';
  try {
    const poliza = await polizasService.crear(data);
    modal.close('modal-poliza');
    mostrarRecibos(poliza);
    await cargarPolizas();
  } catch (err) {
    if (!formErrors.aplicar(err, MAPA)) toast.error(err.message || 'Error al crear la póliza');
  } finally {
    btn.disabled = false; btn.textContent = 'Crear póliza';
  }
}

function mostrarRecibos(poliza) {
  state.polizaNuevaId = poliza.id;
  const recibos = poliza.recibos || [];
  document.getElementById('recibos-generados').innerHTML = recibos.length
    ? `<table class="table" style="width:100%;font-size:13px">
        <thead><tr><th>#</th><th>Vencimiento</th><th>Monto</th></tr></thead>
        <tbody>${recibos.map(r => `<tr><td>${fmt.esc(r.numero)}</td><td>${fmt.fecha(r.vencimiento)}</td><td>${fmt.moneda(r.monto)}</td></tr>`).join('')}</tbody></table>`
    : '<p style="color:#94a3b8;font-size:13px">Sin recibos generados.</p>';
  toast.success('Póliza creada');
  modal.open('modal-recibos');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function limpiarFiltros() {
  state.filtros = {}; state.page = 1;
  ['filtro-buscar', 'filtro-estatus', 'filtro-ramo', 'filtro-aseguradora', 'filtro-venc-desde', 'filtro-venc-hasta']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  cargarPolizas();
}

function limpiarForm() {
  formErrors.limpiar();
  ['p-numero', 'p-producto', 'p-vig-inicio', 'p-vig-fin', 'p-prima', 'p-comision', 'p-notas']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  pickerCliente?.limpiar();
  document.getElementById('p-aseguradora').value = '';
  document.getElementById('p-ramo').value = '';
  document.getElementById('p-forma-pago').value = 'anual';
  document.getElementById('asist-list').innerHTML = '';
}
