'use strict';
/**
 * poliza.js — Detalle de póliza (Promotoría P1): recibos, endosos, documentos,
 * bitácora, renovar, cancelar. Maneja 403/404 con toast + redirección.
 * Depende de: api.js, polizas.service.js, fmt, toast, modal, formErrors
 */

const polizaId = new URLSearchParams(window.location.search).get('id');
let poliza = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!polizaId) { toast.error('Póliza no especificada'); volver(); return; }
  await cargar();

  document.getElementById('btn-editar')?.addEventListener('click', abrirEditar);
  document.getElementById('btn-guardar-editar')?.addEventListener('click', guardarEditar);
  document.getElementById('btn-renovar')?.addEventListener('click', abrirRenovar);
  document.getElementById('btn-confirmar-renovar')?.addEventListener('click', confirmarRenovar);
  document.getElementById('btn-cancelar')?.addEventListener('click', () => { document.getElementById('cancel-motivo').value = ''; modal.open('modal-cancelar'); });
  document.getElementById('btn-confirmar-cancelar')?.addEventListener('click', confirmarCancelar);
  document.getElementById('btn-nuevo-endoso')?.addEventListener('click', abrirEndoso);
  document.getElementById('btn-guardar-endoso')?.addEventListener('click', guardarEndoso);
  document.getElementById('btn-subir-doc')?.addEventListener('click', () => document.getElementById('input-file').click());
  document.getElementById('input-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (file) await subirDocumento(file); e.target.value = '';
  });
});

function volver() { setTimeout(() => window.location.href = '/comercial/polizas.html', 1200); }

async function cargar() {
  try {
    poliza = await polizasService.obtener(polizaId);
    renderDatos(poliza);
    renderRecibos(poliza.recibos || []);
    renderEndosos(poliza.endosos || []);
    renderDocumentos(poliza.documentos || []);
    renderBitacora(poliza.bitacora || []);
  } catch (err) {
    if (err.status === 403) { toast.error('No tienes acceso a esta póliza'); volver(); return; }
    if (err.status === 404) { toast.error('Póliza no encontrada'); volver(); return; }
    toast.error('Error al cargar la póliza');
    console.error(err);
  }
}

// ─── Datos ────────────────────────────────────────────────────────────────────
function renderDatos(p) {
  document.getElementById('pol-numero').textContent = p.numero_poliza || 'Póliza';
  document.getElementById('pol-sub').textContent = `${p.ramo_nombre || p.ramo_clave || ''} · ${p.aseguradora_nombre || ''}`;
  document.title = `${p.numero_poliza} — Kogu Asistencias`;

  // Estatus calculado y acciones según el estado de la póliza.
  const terminal = p.estatus === 'renovada' || p.estatus === 'cancelada';
  document.getElementById('btn-renovar').style.display  = terminal ? 'none' : '';
  document.getElementById('btn-cancelar').style.display = terminal ? 'none' : '';

  const asist = Array.isArray(p.asistencias_incluidas)
    ? p.asistencias_incluidas.map(a => `${fmt.esc(a.tipo)} (${fmt.esc(a.eventos)})`).join(', ')
    : '—';
  const f = (label, val) => `<div class="data-field"><div class="data-field__label">${label}</div><div class="data-field__value">${val}</div></div>`;
  const pct = (v) => (v != null ? `${fmt.esc(v)}%` : '—');
  // El backend calcula las comisiones sobre la prima neta y devuelve NULL
  // cuando no son calculables (falta la prima neta o el %). "No calculable" y
  // "cero" son cosas distintas para negocio: NULL se muestra como "—".
  const montoComision = (v) => (v != null ? fmt.moneda(v) : '—');
  document.getElementById('pol-datos').innerHTML =
    f('Estatus', fmt.estatusPolizaBadge(p.estatus_calculado || p.estatus) + (p.dias_para_vencer != null ? ` <span style="color:#94a3b8;font-size:11px">(${fmt.esc(p.dias_para_vencer)} días)</span>` : '')) +
    f('Cliente', `<a href="/comercial/cliente.html?id=${p.cliente_id}" style="color:#0891b2;text-decoration:none">${fmt.esc(p.cliente_nombre || '—')}</a>`) +
    f('Teléfono cliente', p.cliente_telefono ? fmt.esc(fmt.telefono(p.cliente_telefono)) : '—') +
    f('Agente', fmt.esc(p.agente_nombre || '—')) +
    f('Sub-agente', fmt.esc(p.subagente_nombre || '—')) +
    f('Producto', p.producto ? fmt.esc(p.producto) : '—') +
    f('Uso', fmt.esc(p.uso_nombre || '—')) +
    f('Fecha de venta', p.fecha_venta ? fmt.fecha(p.fecha_venta) : '—') +
    f('Vigencia', `${fmt.fecha(p.vigencia_inicio)} – ${fmt.fecha(p.vigencia_fin)}`) +
    f('Prima total', fmt.moneda(p.prima_total)) +
    f('Prima neta', p.prima_neta != null ? fmt.moneda(p.prima_neta) : '—') +
    f('Forma de pago', fmt.esc(p.forma_pago || '—')) +
    f('Comisión agente', pct(p.comision_pct)) +
    f('Monto comisión agente', montoComision(p.comision_monto)) +
    f('Comisión sub-agente', pct(p.comision_subagente_pct)) +
    f('Monto comisión sub-agente', montoComision(p.comision_subagente_monto)) +
    f('Asistencias incluidas', asist) +
    f('Póliza anterior', p.poliza_anterior_id
      ? `<a href="/comercial/poliza.html?id=${p.poliza_anterior_id}" style="color:#0891b2;text-decoration:none">${fmt.esc(p.poliza_anterior_numero || 'Ver cadena')}</a>`
      : '—');
}

// ─── Recibos ──────────────────────────────────────────────────────────────────
function renderRecibos(recibos) {
  const cont = document.getElementById('pol-recibos');
  if (!recibos.length) { cont.innerHTML = '<p style="color:#94a3b8;font-size:13px">Sin recibos.</p>'; return; }
  // r.id: UUID propio → onclick; demás datos escapados.
  cont.innerHTML = `<table class="mini-table">
    <thead><tr><th>#</th><th>Vencimiento</th><th>Monto</th><th>Estatus</th><th>Pagado</th><th></th></tr></thead>
    <tbody>${recibos.map(r => `
      <tr>
        <td>${fmt.esc(r.numero)}</td>
        <td>${fmt.fecha(r.vencimiento)}</td>
        <td>${fmt.moneda(r.monto)}</td>
        <td>${fmt.esc(r.estatus)}</td>
        <td>${r.pagado_at ? fmt.fecha(r.pagado_at) : '—'}</td>
        <td style="text-align:right">${r.estatus !== 'pagado'
          ? `<button class="btn btn-ghost btn-sm" onclick="pagarRecibo('${r.id}')">Marcar pagado</button>` : '✓'}</td>
      </tr>`).join('')}</tbody></table>`;
}

async function pagarRecibo(reciboId) {
  try {
    await polizasService.pagarRecibo(polizaId, reciboId);
    toast.success('Recibo marcado como pagado');
    await cargar();   // refresca la fila
  } catch (err) { toast.error(err.message || 'Error al registrar el pago'); }
}

// ─── Endosos ──────────────────────────────────────────────────────────────────
function renderEndosos(endosos) {
  const cont = document.getElementById('pol-endosos');
  if (!endosos.length) { cont.innerHTML = '<p style="color:#94a3b8;font-size:13px">Sin endosos.</p>'; return; }
  cont.innerHTML = endosos.map(e => `
    <div style="padding:8px 0;border-bottom:1px solid #f8fafc;font-size:13px">
      <strong>${fmt.esc(e.tipo)}</strong> <span style="color:#94a3b8;font-size:11px">· ${fmt.fecha(e.fecha)}</span>
      <div style="color:#475569">${fmt.esc(e.descripcion)}</div>
    </div>`).join('');
}

function abrirEndoso() {
  ['end-tipo', 'end-descripcion', 'end-fecha'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('end-archivo').value = '';
  formErrors.limpiar();
  modal.open('modal-endoso');
}

async function guardarEndoso() {
  formErrors.limpiar();
  const tipo = document.getElementById('end-tipo').value.trim();
  const descripcion = document.getElementById('end-descripcion').value.trim();
  if (!tipo || !descripcion) { toast.warning('Tipo y descripción son obligatorios'); return; }
  const fecha = document.getElementById('end-fecha').value || undefined;
  const file  = document.getElementById('end-archivo').files?.[0] || null;
  const btn = document.getElementById('btn-guardar-endoso');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await polizasService.crearEndoso(polizaId, { tipo, descripcion, fecha }, file);
    toast.success('Endoso registrado');
    modal.close('modal-endoso');
    await cargar();
  } catch (err) {
    if (!formErrors.aplicar(err, { tipo: 'end-tipo', descripcion: 'end-descripcion', fecha: 'end-fecha' })) {
      toast.error(err.message || 'Error al registrar el endoso');
    }
  } finally { btn.disabled = false; btn.textContent = 'Registrar endoso'; }
}

// ─── Documentos ───────────────────────────────────────────────────────────────
function renderDocumentos(docs) {
  const cont = document.getElementById('pol-documentos');
  if (!docs.length) { cont.innerHTML = '<p style="color:#94a3b8;font-size:13px">Sin documentos.</p>'; return; }
  cont.innerHTML = docs.map(d => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f8fafc">
      <span style="font-size:13px">📎 ${fmt.esc(d.nombre)}</span>
      <button class="btn btn-ghost btn-sm" onclick="descargarDoc('${d.id}')">Ver</button>
    </div>`).join('');
}
async function descargarDoc(docId) {
  try {
    const { url, nombre } = await polizasService.getUrlDocumento(polizaId, docId);
    await descargas.abrirDocumento(url, nombre);
  } catch (err) {
    console.error('No se pudo obtener el documento', err);
    toast.error(err.message || 'No se pudo obtener el documento');
  }
}
async function subirDocumento(file) {
  try { await polizasService.subirDocumento(polizaId, file); toast.success('Documento subido'); await cargar(); }
  catch (err) { toast.error(err.message || 'Error al subir el documento'); }
}

// ─── Bitácora ─────────────────────────────────────────────────────────────────
function renderBitacora(items) {
  const cont = document.getElementById('pol-bitacora');
  if (!items.length) { cont.innerHTML = '<p style="color:#94a3b8;font-size:13px">Sin movimientos.</p>'; return; }
  cont.innerHTML = items.map(b => `
    <div style="padding:8px 0;border-bottom:1px solid #f8fafc;font-size:13px">
      <strong>${fmt.esc(b.usuario_nombre || b.usuario_nombre_join || 'Sistema')}</strong>
      <span style="color:#94a3b8;font-size:11px">· ${fmt.esc(b.accion)} · ${fmt.tiempoRelativo(b.created_at)}</span>
      ${b.descripcion ? `<div style="color:#475569">${fmt.esc(b.descripcion)}</div>` : ''}
    </div>`).join('');
}

// ─── Editar ───────────────────────────────────────────────────────────────────
function abrirEditar() {
  if (!poliza) return;
  formErrors.limpiar();
  document.getElementById('e-numero').value   = poliza.numero_poliza || '';
  document.getElementById('e-producto').value = poliza.producto || '';
  document.getElementById('e-prima').value    = poliza.prima_total || '';
  document.getElementById('e-comision').value = poliza.comision_pct || '';
  document.getElementById('e-prima-neta').value   = poliza.prima_neta ?? '';
  document.getElementById('e-comision-sub').value = poliza.comision_subagente_pct ?? '';
  document.getElementById('e-fecha-venta').value  = (poliza.fecha_venta || '').slice(0, 10);
  document.getElementById('e-notas').value    = poliza.notas || '';
  modal.open('modal-editar');
}
async function guardarEditar() {
  formErrors.limpiar();
  const data = {
    numero_poliza: document.getElementById('e-numero').value.trim() || undefined,
    producto:      document.getElementById('e-producto').value.trim() || undefined,
    prima_total:   document.getElementById('e-prima').value ? Number(document.getElementById('e-prima').value) : undefined,
    comision_pct:  document.getElementById('e-comision').value ? Number(document.getElementById('e-comision').value) : undefined,
    prima_neta:             document.getElementById('e-prima-neta').value ? Number(document.getElementById('e-prima-neta').value) : undefined,
    comision_subagente_pct: document.getElementById('e-comision-sub').value ? Number(document.getElementById('e-comision-sub').value) : undefined,
    fecha_venta:            document.getElementById('e-fecha-venta').value || undefined,
    notas:         document.getElementById('e-notas').value.trim() || undefined,
  };
  const btn = document.getElementById('btn-guardar-editar');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await polizasService.actualizar(polizaId, data);
    toast.success('Póliza actualizada');
    modal.close('modal-editar');
    await cargar();
  } catch (err) {
    if (!formErrors.aplicar(err, {
      numero_poliza: 'e-numero', producto: 'e-producto', prima_total: 'e-prima',
      comision_pct: 'e-comision', notas: 'e-notas',
      prima_neta: 'e-prima-neta', comision_subagente_pct: 'e-comision-sub', fecha_venta: 'e-fecha-venta',
    })) {
      toast.error(err.message || 'Error al guardar');
    }
  } finally { btn.disabled = false; btn.textContent = 'Guardar'; }
}

// ─── Renovar ──────────────────────────────────────────────────────────────────
function abrirRenovar() {
  if (!poliza) return;
  formErrors.limpiar();
  document.getElementById('ren-anterior').textContent = poliza.numero_poliza || '';
  document.getElementById('r-numero').value = (poliza.numero_poliza || '') + '-R';
  document.getElementById('r-vig-inicio').value = (poliza.vigencia_fin || '').slice(0, 10);
  document.getElementById('r-vig-fin').value = '';
  document.getElementById('r-prima').value = poliza.prima_total || '';
  document.getElementById('r-forma-pago').value = '';
  modal.open('modal-renovar');
}
async function confirmarRenovar() {
  formErrors.limpiar();
  const numero_poliza = document.getElementById('r-numero').value.trim();
  const vigencia_fin  = document.getElementById('r-vig-fin').value;
  if (!numero_poliza) { toast.warning('Indica el número de la nueva póliza'); return; }
  if (!vigencia_fin)  { toast.warning('Indica la vigencia fin de la renovación'); return; }
  const data = {
    numero_poliza, vigencia_fin,
    vigencia_inicio: document.getElementById('r-vig-inicio').value || undefined,
    prima_total: document.getElementById('r-prima').value ? Number(document.getElementById('r-prima').value) : undefined,
    forma_pago: document.getElementById('r-forma-pago').value || undefined,
  };
  const btn = document.getElementById('btn-confirmar-renovar');
  btn.disabled = true; btn.textContent = 'Renovando…';
  try {
    const res = await polizasService.renovar(polizaId, data);
    toast.success('Póliza renovada');
    modal.close('modal-renovar');
    const nuevaId = res?.poliza_nueva?.id;
    if (nuevaId) window.location.href = `/comercial/poliza.html?id=${nuevaId}`;
    else await cargar();
  } catch (err) {
    if (!formErrors.aplicar(err, { numero_poliza: 'r-numero', vigencia_fin: 'r-vig-fin', vigencia_inicio: 'r-vig-inicio', prima_total: 'r-prima', forma_pago: 'r-forma-pago' })) {
      toast.error(err.message || 'Error al renovar la póliza');
    }
  } finally { btn.disabled = false; btn.textContent = 'Renovar'; }
}

// ─── Cancelar ─────────────────────────────────────────────────────────────────
async function confirmarCancelar() {
  const motivo = document.getElementById('cancel-motivo').value.trim();
  if (!motivo) { toast.warning('El motivo de cancelación es obligatorio'); return; }
  const btn = document.getElementById('btn-confirmar-cancelar');
  btn.disabled = true; btn.textContent = 'Cancelando…';
  try {
    await polizasService.cancelar(polizaId, motivo);
    toast.success('Póliza cancelada');
    modal.close('modal-cancelar');
    await cargar();
  } catch (err) { toast.error(err.message || 'Error al cancelar la póliza'); }
  finally { btn.disabled = false; btn.textContent = 'Cancelar póliza'; }
}

window.pagarRecibo  = pagarRecibo;
window.descargarDoc = descargarDoc;
