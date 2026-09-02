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
let pickerCliente   = null;
let pickerAgente    = null;
let pickerSubagente = null;
let pickerFiltroSub = null;
// 'elevado' | 'agente_raiz' | 'subagente' — decide qué pickers se muestran (§7.1).
let perfil = 'elevado';

const MAPA = {
  cliente_id: 'p-cliente', aseguradora_id: 'p-aseguradora', ramo_id: 'p-ramo',
  numero_poliza: 'p-numero', producto: 'p-producto', vigencia_inicio: 'p-vig-inicio',
  vigencia_fin: 'p-vig-fin', prima_total: 'p-prima', forma_pago: 'p-forma-pago',
  comision_pct: 'p-comision', notas: 'p-notas',
  // B2-06
  subagente_id: 'p-subagente', uso_id: 'p-uso', fecha_venta: 'p-fecha-venta',
  prima_neta: 'p-prima-neta', comision_subagente_pct: 'p-comision-sub',
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

  // La ubicación comercial decide qué pickers se ven en el alta (§7.1).
  await authService.asegurarPerfilComercial();
  perfil = authService.perfilComercial();

  montarPickersAgente();
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
  document.getElementById('filtro-ramo')?.addEventListener('change', e => cargarUsosFiltro(e.target.value));
  document.getElementById('filtro-subagente')?.addEventListener('change', aplicarFiltros);
  document.getElementById('filtro-uso')?.addEventListener('change', aplicarFiltros);
  document.getElementById('p-ramo')?.addEventListener('change', e => cargarUsos(e.target.value));
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
  state.filtros.subagente_id   = document.getElementById('filtro-subagente').value;
  state.filtros.uso_id         = document.getElementById('filtro-uso').value;
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

// ─── Agente / sub-agente (Bf-07 §7.1) ────────────────────────────────────────
//
// El backend decide el reparto según quién emite: un sub-agente cuelga la
// póliza de su padre y queda él en `subagente_id`. Por eso el formulario NO le
// pide esos campos; solo los pide a quien de verdad puede elegirlos.
//
// Límite real de la API: `GET /agentes` solo admite admin, supervisor y
// promotor. Un usuario con rol `agente` recibe 403, así que no puede alimentar
// ningún picker de agentes — ni siquiera para elegir entre sus propios
// sub-agentes. Para esos perfiles se muestra una línea informativa en vez de un
// picker que fallaría. (Ver nota al cierre de Bf-07.)
function montarPickersAgente() {
  if (perfil !== 'elevado') {
    mostrarAvisoAsignacion();
    return;
  }

  pickerAgente = picker.bind({
    inputId: 'p-agente-label', hiddenId: 'p-agente',
    botonId: 'p-agente-btn',   limpiarId: 'p-agente-clear',
    titulo:      'Seleccionar agente',
    placeholder: 'Nombre, RFC o correo…',
    vacio:       'Escribe para buscar agentes.',
    // solo_raiz: el titular de una póliza nunca es un sub-agente.
    buscar:      (q, page) => agentesService.listar({ buscar: q, page, limit: 20, solo_raiz: true }),
    item:        a => ({ id: a.id, titulo: a.nombre, sub: a.email || a.rfc || '—' }),
    // Cambiar de agente invalida al sub-agente elegido.
    onSelect: () => { limpiarSubagente(); habilitarSubagente(true); },
  });
  document.getElementById('grupo-p-agente').style.display = '';
  document.getElementById('p-agente-clear')?.addEventListener('click', () => {
    limpiarSubagente(); habilitarSubagente(false);
  });

  pickerSubagente = picker.bind({
    inputId: 'p-subagente-label', hiddenId: 'p-subagente',
    botonId: 'p-subagente-btn',   limpiarId: 'p-subagente-clear',
    titulo:      'Seleccionar sub-agente',
    placeholder: 'Nombre, RFC o correo…',
    vacio:       'Escribe para buscar sub-agentes.',
    buscar:      (q, page) => agentesService.listar({
      buscar: q, page, limit: 20, agente_padre_id: document.getElementById('p-agente').value || undefined,
    }),
    item:        a => ({ id: a.id, titulo: a.nombre, sub: a.email || a.rfc || '—' }),
    onSelect:    () => mostrarComisionSub(true),
  });
  document.getElementById('grupo-p-subagente').style.display = '';
  document.getElementById('p-subagente-clear')?.addEventListener('click', () => mostrarComisionSub(false));
  habilitarSubagente(false);   // hasta que haya agente elegido

  // Filtro del listado por sub-agente.
  pickerFiltroSub = picker.bind({
    inputId: 'filtro-subagente-label', hiddenId: 'filtro-subagente',
    botonId: 'filtro-subagente-btn',   limpiarId: 'filtro-subagente-clear',
    titulo:      'Filtrar por sub-agente',
    placeholder: 'Nombre, RFC o correo…',
    vacio:       'Escribe para buscar sub-agentes.',
    buscar:      (q, page) => agentesService.listar({ buscar: q, page, limit: 20 }),
    item:        a => ({ id: a.id, titulo: a.nombre, sub: a.padre_nombre ? `Depende de ${a.padre_nombre}` : 'Agente raíz' }),
  });
  document.getElementById('grupo-filtro-subagente').style.display = '';
}

/** Para agente raíz y sub-agente: se explica el reparto que hará el backend. */
function mostrarAvisoAsignacion() {
  const aviso = document.getElementById('p-aviso-subagente');
  const txt   = document.getElementById('p-aviso-subagente-txt');
  if (!aviso || !txt) return;
  txt.textContent = perfil === 'subagente'
    ? 'Se registrará a tu nombre como sub-agente, con tu agente titular en la póliza.'
    : 'La póliza se registrará a tu nombre.';
  aviso.style.display = '';
}

function habilitarSubagente(on) {
  pickerSubagente?.habilitar(on);
  const input = document.getElementById('p-subagente-label');
  if (input) input.placeholder = on ? 'Buscar sub-agente…' : 'Elige primero un agente';
}

function limpiarSubagente() {
  pickerSubagente?.set('', '');
  mostrarComisionSub(false);
}

function mostrarComisionSub(on) {
  const g = document.getElementById('grupo-p-comision-sub');
  if (g) g.style.display = on ? '' : 'none';
  if (!on) document.getElementById('p-comision-sub').value = '';
}

// ─── Usos por ramo (B2-06): el campo solo existe si el ramo tiene usos ──────
async function cargarUsos(ramoId) {
  const grupo  = document.getElementById('grupo-p-uso');
  const select = document.getElementById('p-uso');
  select.innerHTML = '<option value="">—</option>';
  if (!ramoId) { grupo.style.display = 'none'; return; }

  try {
    const usos = await catalogosService.getUsos(ramoId) || [];
    if (!usos.length) { grupo.style.display = 'none'; return; }
    select.innerHTML += usos
      .map(u => `<option value="${fmt.esc(u.id)}">${fmt.esc(u.nombre)}</option>`).join('');
    grupo.style.display = '';
  } catch (err) {
    console.error('No se pudieron cargar los usos del ramo', err);
    toast.error('No se pudieron cargar los usos del ramo');
    grupo.style.display = 'none';
  }
}

// Filtro de uso del listado: solo tiene sentido con un ramo que tenga usos.
async function cargarUsosFiltro(ramoId) {
  const select = document.getElementById('filtro-uso');
  select.innerHTML = '<option value="">Todos los usos</option>';
  if (!ramoId) { select.style.display = 'none'; select.value = ''; return; }
  try {
    const usos = await catalogosService.getUsos(ramoId) || [];
    if (!usos.length) { select.style.display = 'none'; return; }
    select.innerHTML += usos
      .map(u => `<option value="${fmt.esc(u.id)}">${fmt.esc(u.nombre)}</option>`).join('');
    select.style.display = '';
  } catch (err) {
    console.error('No se pudieron cargar los usos del filtro', err);
    select.style.display = 'none';
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

  // La comisión se calcula sobre la prima neta, que no puede exceder lo que
  // paga el cliente. Se marca aquí en vez de esperar el 422 del backend.
  const primaNetaRaw = document.getElementById('p-prima-neta').value;
  if (primaNetaRaw && Number(primaNetaRaw) > Number(prima_total)) {
    formErrors.aplicar(
      { status: 422, details: [{ field: 'prima_neta', message: 'La prima neta no puede ser mayor que la prima total' }] },
      MAPA,
    );
    return;
  }

  const num = (id) => {
    const v = document.getElementById(id).value;
    return v === '' ? undefined : Number(v);
  };
  const val = (id) => document.getElementById(id).value || undefined;

  const data = {
    cliente_id, aseguradora_id, ramo_id, numero_poliza,
    producto: document.getElementById('p-producto').value.trim() || undefined,
    vigencia_inicio, vigencia_fin,
    prima_total: Number(prima_total),
    forma_pago,
    comision_pct: num('p-comision'),
    asistencias_incluidas: recolectarAsistencias(),
    notas: document.getElementById('p-notas').value.trim() || undefined,
    // B2-06. agente_id y subagente_id solo se mandan cuando el usuario pudo
    // elegirlos; para agente raíz y sub-agente los resuelve el backend.
    fecha_venta:            val('p-fecha-venta'),
    uso_id:                 val('p-uso'),
    prima_neta:             num('p-prima-neta'),
    comision_subagente_pct: num('p-comision-sub'),
  };

  if (perfil === 'elevado') {
    data.agente_id    = val('p-agente');
    data.subagente_id = val('p-subagente');
  }

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
  pickerFiltroSub?.set('', '');
  cargarUsosFiltro('');
  cargarPolizas();
}

function limpiarForm() {
  formErrors.limpiar();
  ['p-numero', 'p-producto', 'p-vig-inicio', 'p-vig-fin', 'p-prima', 'p-comision', 'p-notas',
   'p-prima-neta', 'p-comision-sub', 'p-uso']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  pickerCliente?.limpiar();
  pickerAgente?.set('', '');
  limpiarSubagente();
  habilitarSubagente(false);
  document.getElementById('grupo-p-uso').style.display = 'none';
  // Fecha de venta: hoy por defecto (§2).
  document.getElementById('p-fecha-venta').value = new Date().toISOString().slice(0, 10);
  document.getElementById('p-aseguradora').value = '';
  document.getElementById('p-ramo').value = '';
  document.getElementById('p-forma-pago').value = 'anual';
  document.getElementById('asist-list').innerHTML = '';
}
