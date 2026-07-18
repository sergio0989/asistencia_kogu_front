'use strict';
/**
 * oportunidad.js — Detalle de oportunidad (Promotoría P2, Bf-05).
 * Cotizaciones, acciones de estatus (desde transiciones_disponibles del API) y
 * conversión a póliza. Maneja 403/404 con toast + redirección al pipeline.
 * Depende de: api.js, oportunidades.service.js, catalogos.service.js,
 *             fmt, toast, modal, formErrors.
 */

const oportunidadId = new URLSearchParams(window.location.search).get('id');

const est = {
  op: null,                 // detalle actual
  aseguradoras: [],         // cache para el modal de cotización
  labelRespuestas: {},      // campo.id → label (del esquema del ramo)
  cotizEditId: null,        // id de cotización en edición (null = alta)
  pendingEstatus: null,     // estatus destino en modales motivo/recontacto
  uploadCotizId: null,      // cotización objetivo al subir documento
};

const MAPA_COTIZ = {
  aseguradora_id: 'ct-aseguradora', plan: 'ct-plan', prima_total: 'ct-prima',
  suma_asegurada: 'ct-suma', deducible: 'ct-deducible', vigencia_dias: 'ct-vigencia', notas: 'ct-notas',
};
const MAPA_CONVERTIR = {
  numero_poliza: 'cv-numero', forma_pago: 'cv-forma-pago', vigencia_inicio: 'cv-vig-inicio',
  vigencia_fin: 'cv-vig-fin', prima_total: 'cv-prima', producto: 'cv-producto',
  comision_pct: 'cv-comision', notas: 'cv-notas',
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!oportunidadId) { toast.error('Oportunidad no especificada'); volver(); return; }
  await cargarAseguradoras();
  await cargar();

  document.getElementById('btn-nueva-cotizacion')?.addEventListener('click', abrirNuevaCotizacion);
  document.getElementById('btn-guardar-cotizacion')?.addEventListener('click', guardarCotizacion);
  document.getElementById('btn-confirmar-motivo')?.addEventListener('click', confirmarMotivo);
  document.getElementById('btn-confirmar-recontacto')?.addEventListener('click', confirmarRecontacto);
  document.getElementById('btn-convertir')?.addEventListener('click', abrirConvertir);
  document.getElementById('btn-confirmar-convertir')?.addEventListener('click', confirmarConvertir);
  document.getElementById('input-file-cotiz')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file && est.uploadCotizId) await subirDocumento(est.uploadCotizId, file);
    e.target.value = '';
  });
});

function volver() { setTimeout(() => { window.location.href = '/comercial/pipeline.html'; }, 1200); }

// ─── Carga ──────────────────────────────────────────────────────────────────
async function cargarAseguradoras() {
  try { est.aseguradoras = await catalogosService.getEmpresas() || []; }
  catch { est.aseguradoras = []; }
}

async function cargar() {
  try {
    est.op = await oportunidadesService.obtener(oportunidadId);
    await cargarEsquemaRamo(est.op.ramo_id);
    renderDatos(est.op);
    renderRespuestas(est.op.respuestas);
    renderCotizaciones(est.op.cotizaciones || []);
    renderBitacora(est.op.bitacora || []);
    renderAcciones(est.op.transiciones_disponibles || [], est.op);
  } catch (err) {
    if (err.status === 403) { toast.error('No tienes acceso a esta oportunidad'); volver(); return; }
    if (err.status === 404) { toast.error('Oportunidad no encontrada'); volver(); return; }
    toast.error('Error al cargar la oportunidad');
    console.error(err);
  }
}

// Esquema del ramo → mapa id→label para render legible de respuestas (1 llamada).
async function cargarEsquemaRamo(ramoId) {
  est.labelRespuestas = {};
  if (!ramoId) return;
  try {
    const forms = await catalogosService.getFormulariosPromotoria(ramoId) || [];
    const esquema = forms[0]?.esquema;
    (esquema?.secciones || []).forEach(sec => {
      (sec.campos || []).forEach(c => { if (c.id) est.labelRespuestas[c.id] = c.label || c.id; });
    });
  } catch { /* sin esquema: se muestran las claves crudas */ }
}

// ─── Datos ──────────────────────────────────────────────────────────────────
function renderDatos(o) {
  document.getElementById('op-folio').textContent = o.folio || 'Oportunidad';
  document.title = `${o.folio || 'Oportunidad'} — Kogu Asistencias`;
  const canal = fmt.canal(o.canal_origen);
  document.getElementById('op-sub').innerHTML =
    `${fmt.esc(o.cliente_nombre || '')} · ${fmt.esc(o.ramo_nombre || o.ramo_clave || '')} · ` +
    fmt.estatusOportunidadBadge(o.estatus, o.estatus_nombre);

  const f = (label, val) => `<div class="data-field"><div class="data-field__label">${label}</div><div class="data-field__value">${val}</div></div>`;
  const rows = [
    f('Estatus', fmt.estatusOportunidadBadge(o.estatus, o.estatus_nombre)),
    f('Cliente', o.cliente_id
      ? `<a href="/comercial/cliente.html?id=${o.cliente_id}" style="color:#0891b2;text-decoration:none">${fmt.esc(o.cliente_nombre || '—')}</a>`
      : fmt.esc(o.cliente_nombre || '—')),
    f('Teléfono', o.cliente_telefono ? fmt.esc(fmt.telefono(o.cliente_telefono)) : '—'),
    f('Email', o.cliente_email ? fmt.esc(o.cliente_email) : '—'),
    f('Agente', fmt.esc(o.agente_nombre || '—')),
    f('Ramo', fmt.esc(o.ramo_nombre || o.ramo_clave || '—')),
    f('Canal', `${canal.icon} ${fmt.esc(canal.label)}`),
    f('Promotoría', fmt.esc(o.promotoria_nombre || '—')),
    f('Vence póliza actual', o.vencimiento_poliza_actual ? fmt.fecha(o.vencimiento_poliza_actual) : '—'),
    f('Aseguradora actual', fmt.esc(o.aseguradora_actual || '—')),
  ];
  if (o.fecha_recontacto) rows.push(f('Recontacto programado', fmt.fecha(o.fecha_recontacto)));
  if (o.motivo_perdida)   rows.push(f('Motivo de cierre', fmt.esc(o.motivo_perdida)));
  rows.push(f('Alta', fmt.fecha(o.created_at)));
  if (o.notas) rows.push(f('Notas', fmt.esc(o.notas)));

  document.getElementById('op-datos').innerHTML = rows.join('');
}

// ─── Respuestas del cuestionario (render legible) ───────────────────────────
function renderRespuestas(respuestas) {
  const cont = document.getElementById('op-respuestas');
  const keys = respuestas && typeof respuestas === 'object' ? Object.keys(respuestas) : [];
  if (!keys.length) { cont.innerHTML = '<p style="color:#94a3b8;font-size:13px">Sin respuestas registradas.</p>'; return; }
  cont.innerHTML = `<div class="resp-grid">${keys.map(k => {
    const label = est.labelRespuestas[k] || k;
    let val = respuestas[k];
    if (Array.isArray(val)) val = val.length ? val.join(', ') : '—';
    return `<div class="resp-item"><div class="k">${fmt.esc(label)}</div><div class="v">${fmt.esc(val)}</div></div>`;
  }).join('')}</div>`;
}

// ─── Cotizaciones ───────────────────────────────────────────────────────────
function renderCotizaciones(cotiz) {
  const cont = document.getElementById('op-cotizaciones');
  if (!cotiz.length) { cont.innerHTML = '<p style="color:#94a3b8;font-size:13px">Sin cotizaciones. Agrega al menos una para poder convertir.</p>'; return; }
  // c.id: UUID propio → onclick; demás datos escapados.
  cont.innerHTML = `<table class="mini-table">
    <thead><tr><th></th><th>Aseguradora</th><th>Plan</th><th>Prima</th><th>Suma</th><th>Deducible</th><th>Vig.</th><th style="text-align:right">Acciones</th></tr></thead>
    <tbody>${cotiz.map(c => `
      <tr class="${c.seleccionada ? 'cotiz-sel' : ''}">
        <td>${c.seleccionada ? '✅' : ''}</td>
        <td>${fmt.esc(c.aseguradora_nombre || '—')}</td>
        <td>${fmt.esc(c.plan || '—')}</td>
        <td>${fmt.moneda(c.prima_total)}</td>
        <td>${fmt.moneda(c.suma_asegurada)}</td>
        <td>${fmt.esc(c.deducible || '—')}</td>
        <td>${c.vigencia_dias != null ? fmt.esc(c.vigencia_dias) + 'd' : '—'}</td>
        <td style="text-align:right;white-space:nowrap">
          ${c.seleccionada ? '' : `<button class="btn btn-ghost btn-sm" onclick="seleccionarCotizacion('${c.id}')" title="Seleccionar">Seleccionar</button>`}
          <button class="btn btn-ghost btn-sm" onclick="editarCotizacion('${c.id}')" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="subirDocClick('${c.id}')" title="Adjuntar documento">📎</button>
          <button class="btn btn-ghost btn-sm" style="color:#991b1b" onclick="eliminarCotizacion('${c.id}')" title="Eliminar">🗑</button>
        </td>
      </tr>`).join('')}</tbody></table>`;
}

function llenarSelectAseguradoras() {
  document.getElementById('ct-aseguradora').innerHTML =
    '<option value="">— Seleccionar —</option>' +
    est.aseguradoras.map(e => `<option value="${fmt.esc(e.id)}">${fmt.esc(e.razon_social || e.nombre_comercial || '')}</option>`).join('');
}

function abrirNuevaCotizacion() {
  est.cotizEditId = null;
  formErrors.limpiar();
  llenarSelectAseguradoras();
  ['ct-plan', 'ct-prima', 'ct-suma', 'ct-deducible', 'ct-vigencia', 'ct-notas'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('ct-aseguradora').value = '';
  document.getElementById('modal-cotiz-titulo').textContent = 'Nueva cotización';
  modal.open('modal-cotizacion');
}

function editarCotizacion(cotizId) {
  const c = (est.op.cotizaciones || []).find(x => x.id === cotizId);
  if (!c) return;
  est.cotizEditId = cotizId;
  formErrors.limpiar();
  llenarSelectAseguradoras();
  document.getElementById('ct-aseguradora').value = c.aseguradora_id || '';
  document.getElementById('ct-plan').value      = c.plan || '';
  document.getElementById('ct-prima').value     = c.prima_total ?? '';
  document.getElementById('ct-suma').value      = c.suma_asegurada ?? '';
  document.getElementById('ct-deducible').value = c.deducible || '';
  document.getElementById('ct-vigencia').value  = c.vigencia_dias ?? '';
  document.getElementById('ct-notas').value     = c.notas || '';
  document.getElementById('modal-cotiz-titulo').textContent = 'Editar cotización';
  modal.open('modal-cotizacion');
}

async function guardarCotizacion() {
  formErrors.limpiar();
  const aseguradora_id = document.getElementById('ct-aseguradora').value;
  if (!aseguradora_id) { toast.warning('Selecciona la aseguradora'); return; }

  const num = (id) => { const v = document.getElementById(id).value; return v === '' ? undefined : Number(v); };
  const data = {
    aseguradora_id,
    plan:           document.getElementById('ct-plan').value.trim() || undefined,
    prima_total:    num('ct-prima'),
    suma_asegurada: num('ct-suma'),
    deducible:      document.getElementById('ct-deducible').value.trim() || undefined,
    vigencia_dias:  num('ct-vigencia'),
    notas:          document.getElementById('ct-notas').value.trim() || undefined,
  };

  const btn = document.getElementById('btn-guardar-cotizacion');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    if (est.cotizEditId) await oportunidadesService.actualizarCotizacion(oportunidadId, est.cotizEditId, data);
    else                 await oportunidadesService.crearCotizacion(oportunidadId, data);
    toast.success('Cotización guardada');
    modal.close('modal-cotizacion');
    await cargar();
  } catch (err) {
    if (!formErrors.aplicar(err, MAPA_COTIZ)) toast.error(err.message || 'Error al guardar la cotización');
  } finally { btn.disabled = false; btn.textContent = 'Guardar'; }
}

async function seleccionarCotizacion(cotizId) {
  try {
    await oportunidadesService.seleccionarCotizacion(oportunidadId, cotizId);
    toast.success('Cotización seleccionada');
    await cargar();
  } catch (err) { toast.error(err.message || 'Error al seleccionar la cotización'); await cargar(); }
}

function eliminarCotizacion(cotizId) {
  modal.confirm('¿Eliminar esta cotización?', async () => {
    try {
      await oportunidadesService.eliminarCotizacion(oportunidadId, cotizId);
      toast.success('Cotización eliminada');
      await cargar();
    } catch (err) { toast.error(err.message || 'Error al eliminar la cotización'); }
  }, { title: 'Eliminar cotización', danger: true });
}

function subirDocClick(cotizId) {
  est.uploadCotizId = cotizId;
  document.getElementById('input-file-cotiz').click();
}

async function subirDocumento(cotizId, file) {
  try {
    await oportunidadesService.subirDocumentoCotizacion(oportunidadId, cotizId, file);
    toast.success('Documento adjuntado a la cotización');
  } catch (err) { toast.error(err.message || 'Error al subir el documento'); }
  finally { est.uploadCotizId = null; }
}

// ─── Acciones de estatus (desde la máquina del API) ─────────────────────────
function renderAcciones(transiciones, o) {
  const cont = document.getElementById('acciones-estatus');
  // Botón por cada transición disponible; NO se hardcodea el flujo.
  cont.innerHTML = transiciones.map(t => {
    const label = fmt.esc(t.to_nombre || fmt.estatusOportunidad(t.to_clave).label);
    const danger = (t.to_clave === 'perdida' || t.to_clave === 'no_califica');
    return `<button class="btn ${danger ? 'btn-ghost' : 'btn-ghost'} btn-sm"
      ${danger ? 'style="color:#991b1b"' : ''}
      onclick="iniciarTransicion('${fmt.esc(t.to_clave)}', ${t.requiere_motivo ? 'true' : 'false'})">${label}</button>`;
  }).join('');

  // Convertir solo cuando está en emisión.
  document.getElementById('btn-convertir').style.display = o.estatus === 'en_emision' ? '' : 'none';
}

function iniciarTransicion(toClave, requiereMotivo) {
  est.pendingEstatus = toClave;
  const nombre = fmt.estatusOportunidad(toClave).label;

  if (toClave === 'recontacto_programado') {
    document.getElementById('recontacto-fecha').value = '';
    modal.open('modal-recontacto');
    return;
  }
  if (requiereMotivo) {
    document.getElementById('modal-motivo-titulo').textContent = `Marcar como "${nombre}"`;
    document.getElementById('motivo-texto').value = '';
    modal.open('modal-motivo');
    return;
  }
  modal.confirm(`¿Mover la oportunidad a "${nombre}"?`, () => aplicarEstatus(toClave, {}), { title: 'Cambiar estatus' });
}

async function confirmarMotivo() {
  const motivo = document.getElementById('motivo-texto').value.trim();
  if (!motivo) { toast.warning('El motivo es obligatorio'); return; }
  modal.close('modal-motivo');
  await aplicarEstatus(est.pendingEstatus, { motivo_perdida: motivo });
}

async function confirmarRecontacto() {
  const fecha = document.getElementById('recontacto-fecha').value;
  if (!fecha) { toast.warning('La fecha de recontacto es obligatoria'); return; }
  modal.close('modal-recontacto');
  await aplicarEstatus(est.pendingEstatus, { fecha_recontacto: fecha });
}

async function aplicarEstatus(estatus, { motivo_perdida, fecha_recontacto } = {}) {
  try {
    await oportunidadesService.cambiarEstatus(oportunidadId, { estatus, motivo_perdida, fecha_recontacto });
    toast.success('Estatus actualizado');
    await cargar();
  } catch (err) {
    // 403/otros: informa y recarga; si el acceso se perdió, cargar() redirige.
    toast.error(err.message || 'No se pudo cambiar el estatus');
    await cargar();
  } finally { est.pendingEstatus = null; }
}

// ─── Convertir a póliza ─────────────────────────────────────────────────────
function abrirConvertir() {
  formErrors.limpiar();
  const cotiz = (est.op.cotizaciones || []).find(c => c.seleccionada);
  if (!cotiz) { toast.warning('Selecciona una cotización antes de convertir'); return; }

  document.getElementById('cv-cotiz').textContent =
    `${cotiz.aseguradora_nombre || ''}${cotiz.plan ? ' · ' + cotiz.plan : ''}`.trim() || '—';
  document.getElementById('cv-numero').value   = '';
  document.getElementById('cv-forma-pago').value = 'anual';
  document.getElementById('cv-vig-inicio').value = new Date().toISOString().slice(0, 10);
  document.getElementById('cv-vig-fin').value  = '';
  document.getElementById('cv-prima').value    = cotiz.prima_total ?? '';
  document.getElementById('cv-producto').value = cotiz.plan || '';
  document.getElementById('cv-comision').value = '';
  document.getElementById('cv-notas').value    = '';
  modal.open('modal-convertir');
}

async function confirmarConvertir() {
  formErrors.limpiar();
  const numero_poliza   = document.getElementById('cv-numero').value.trim();
  const forma_pago      = document.getElementById('cv-forma-pago').value;
  const vigencia_inicio = document.getElementById('cv-vig-inicio').value;
  if (!numero_poliza)   { toast.warning('El número de póliza es obligatorio'); return; }
  if (!vigencia_inicio) { toast.warning('La vigencia inicio es obligatoria'); return; }

  const data = { numero_poliza, forma_pago, vigencia_inicio };
  const vf = document.getElementById('cv-vig-fin').value;
  const prima = document.getElementById('cv-prima').value;
  const producto = document.getElementById('cv-producto').value.trim();
  const comision = document.getElementById('cv-comision').value;
  const notas = document.getElementById('cv-notas').value.trim();
  if (vf)       data.vigencia_fin = vf;
  if (prima)    data.prima_total  = Number(prima);
  if (producto) data.producto     = producto;
  if (comision) data.comision_pct = Number(comision);
  if (notas)    data.notas        = notas;

  const btn = document.getElementById('btn-confirmar-convertir');
  btn.disabled = true; btn.textContent = 'Convirtiendo…';
  try {
    const res = await oportunidadesService.convertir(oportunidadId, data);
    toast.success('Oportunidad convertida en póliza');
    modal.close('modal-convertir');
    const polizaId = res?.poliza?.id;
    if (polizaId) window.location.href = `/comercial/poliza.html?id=${polizaId}`;
    else await cargar();
  } catch (err) {
    if (!formErrors.aplicar(err, MAPA_CONVERTIR)) toast.error(err.message || 'Error al convertir la oportunidad');
  } finally { btn.disabled = false; btn.textContent = 'Convertir'; }
}

// ─── Bitácora ───────────────────────────────────────────────────────────────
function renderBitacora(items) {
  const cont = document.getElementById('op-bitacora');
  if (!items.length) { cont.innerHTML = '<p style="color:#94a3b8;font-size:13px">Sin movimientos.</p>'; return; }
  cont.innerHTML = items.map(b => `
    <div style="padding:8px 0;border-bottom:1px solid #f8fafc;font-size:13px">
      <strong>${fmt.esc(b.usuario_nombre || b.usuario_nombre_join || 'Sistema')}</strong>
      <span style="color:#94a3b8;font-size:11px">· ${fmt.esc(b.accion)} · ${fmt.tiempoRelativo(b.created_at)}</span>
      ${b.descripcion ? `<div style="color:#475569">${fmt.esc(b.descripcion)}</div>` : ''}
    </div>`).join('');
}

// Exponer handlers usados en onclick inline.
window.iniciarTransicion    = iniciarTransicion;
window.seleccionarCotizacion = seleccionarCotizacion;
window.editarCotizacion     = editarCotizacion;
window.eliminarCotizacion   = eliminarCotizacion;
window.subirDocClick        = subirDocClick;
