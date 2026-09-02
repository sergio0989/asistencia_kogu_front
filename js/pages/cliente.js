'use strict';
/**
 * cliente.js — Ficha 360 del cliente (Promotoría P1).
 * Consume /clientes/:id/vista360. Maneja 403 (sin acceso) con toast + redirección.
 * Depende de: api.js, clientes.service.js, fmt, toast, modal, formErrors
 */

const clienteId = new URLSearchParams(window.location.search).get('id');
let cliente = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!clienteId) { toast.error('Cliente no especificado'); volverALista(); return; }
  await cargar();

  document.getElementById('btn-editar-cliente')?.addEventListener('click', abrirEditar);
  document.getElementById('btn-guardar-editar')?.addEventListener('click', guardarEditar);
  document.getElementById('btn-nueva-poliza')?.addEventListener('click', () => {
    window.location.href = `/comercial/polizas.html?nuevo=1&cliente_id=${clienteId}`;
  });
  document.getElementById('btn-subir-doc')?.addEventListener('click', () => document.getElementById('input-file').click());
  document.getElementById('input-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) await subirDocumento(file);
    e.target.value = '';
  });
});

function volverALista() { setTimeout(() => window.location.href = '/comercial/clientes.html', 1200); }

async function cargar() {
  try {
    const v = await clientesService.vista360(clienteId);
    cliente = v.cliente;
    renderCliente(v.cliente);
    renderPolizas(v.polizas || []);
    renderRecibos(v.recibos_proximos || []);
    renderSiniestros(v.siniestros || [], v.asistencias || []);
    renderDocumentos(v.documentos || []);
  } catch (err) {
    if (err.status === 403) { toast.error('No tienes acceso a este cliente'); volverALista(); return; }
    if (err.status === 404) { toast.error('Cliente no encontrado'); volverALista(); return; }
    toast.error('Error al cargar la ficha del cliente');
    console.error(err);
  }
}

// ─── Render: datos ────────────────────────────────────────────────────────────
function renderCliente(c) {
  document.getElementById('cliente-nombre').textContent = c.nombre || 'Cliente';
  document.getElementById('cliente-sub').textContent =
    `${c.tipo_persona === 'moral' ? 'Persona moral' : 'Persona física'} · ${c.agente_nombre || 'Sin agente'}`;
  document.title = `${c.nombre} — Kogu Asistencias`;

  const f = (label, val) => `
    <div class="data-field">
      <div class="data-field__label">${label}</div>
      <div class="data-field__value">${val}</div>
    </div>`;
  document.getElementById('cliente-datos').innerHTML =
    f('Estado', fmt.estadoClienteBadge(c.estado)) +
    f('RFC', c.rfc ? fmt.esc(c.rfc) : '—') +
    f('Teléfono', c.telefono ? fmt.esc(fmt.telefono(c.telefono)) : '—') +
    f('Email', c.email ? fmt.esc(c.email) : '—') +
    f('Origen de contacto', c.origen_contacto ? fmt.esc(c.origen_contacto) : '—') +
    f('Promotoría', fmt.esc(c.promotoria_nombre || '—')) +
    f('Aviso de privacidad', c.aviso_privacidad_version ? fmt.esc(c.aviso_privacidad_version) : '—') +
    f('Consentimiento', c.consentimiento_at ? `${fmt.fecha(c.consentimiento_at)} · ${fmt.esc(c.consentimiento_canal || '')}` : '—') +
    f('Notas', c.notas ? fmt.esc(c.notas) : '—');
}

// ─── Render: pólizas ──────────────────────────────────────────────────────────
function renderPolizas(polizas) {
  const cont = document.getElementById('cliente-polizas');
  if (!polizas.length) { cont.innerHTML = '<p style="color:#94a3b8;font-size:13px">Sin pólizas registradas.</p>'; return; }
  // p.id: UUID propio → navegación; demás datos escapados.
  cont.innerHTML = `<table class="mini-table">
    <thead><tr><th>Número</th><th>Ramo</th><th>Aseguradora</th><th>Vigencia</th><th>Prima</th><th>Estatus</th></tr></thead>
    <tbody>${polizas.map(p => `
      <tr data-link onclick="window.location.href='/comercial/poliza.html?id=${p.id}'">
        <td><strong>${fmt.esc(p.numero_poliza)}</strong></td>
        <td>${fmt.esc(p.ramo_clave || p.ramo_nombre || '—')}</td>
        <td>${fmt.esc(p.aseguradora_nombre || '—')}</td>
        <td>${fmt.fecha(p.vigencia_inicio)} – ${fmt.fecha(p.vigencia_fin)}</td>
        <td>${fmt.moneda(p.prima_total)}</td>
        <td>${fmt.estatusPolizaBadge(p.estatus)}</td>
      </tr>`).join('')}</tbody></table>`;
}

// ─── Render: recibos próximos ─────────────────────────────────────────────────
function renderRecibos(recibos) {
  const cont = document.getElementById('cliente-recibos');
  if (!recibos.length) { cont.innerHTML = '<p style="color:#94a3b8;font-size:13px">Sin recibos pendientes próximos.</p>'; return; }
  cont.innerHTML = `<table class="mini-table">
    <thead><tr><th>Póliza</th><th>Recibo</th><th>Vencimiento</th><th>Monto</th><th>Estatus</th></tr></thead>
    <tbody>${recibos.map(r => `
      <tr>
        <td>${fmt.esc(r.numero_poliza || '—')}</td>
        <td>#${fmt.esc(r.numero)}</td>
        <td>${fmt.fecha(r.vencimiento)}</td>
        <td>${fmt.moneda(r.monto)}</td>
        <td>${fmt.esc(r.estatus)}</td>
      </tr>`).join('')}</tbody></table>`;
}

// ─── Render: siniestros + asistencias ─────────────────────────────────────────
function renderSiniestros(siniestros, asistencias) {
  const cont = document.getElementById('cliente-siniestros');
  if (!siniestros.length && !asistencias.length) {
    cont.innerHTML = '<p style="color:#94a3b8;font-size:13px">Sin siniestros ni asistencias ligadas.</p>';
    return;
  }
  let html = '';
  if (siniestros.length) {
    html += '<div style="font-size:12px;font-weight:700;color:#64748b;margin:4px 0">Siniestros</div>';
    html += siniestros.map(s => `<div style="font-size:13px;padding:4px 0;border-bottom:1px solid #f8fafc">
      <strong>${fmt.esc(s.folio || '—')}</strong>${s.descripcion ? ' · ' + fmt.esc(s.descripcion) : ''}
      <span style="color:#94a3b8;font-size:11px"> · ${fmt.fecha(s.created_at)}</span></div>`).join('');
  }
  if (asistencias.length) {
    html += '<div style="font-size:12px;font-weight:700;color:#64748b;margin:10px 0 4px">Asistencias</div>';
    html += asistencias.map(a => `<div style="font-size:13px;padding:4px 0;border-bottom:1px solid #f8fafc">
      <strong>${fmt.esc(a.folio || '—')}</strong> · ${fmt.esc(a.tipo_nombre || '')} ${fmt.estatusBadge(a.estatus_operativo)}</div>`).join('');
  }
  cont.innerHTML = html;
}

// ─── Render: documentos ───────────────────────────────────────────────────────
function renderDocumentos(docs) {
  const cont = document.getElementById('cliente-documentos');
  if (!docs.length) { cont.innerHTML = '<p style="color:#94a3b8;font-size:13px">Sin documentos.</p>'; return; }
  // d.id: UUID propio → onclick; el nombre se escapa.
  cont.innerHTML = docs.map(d => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f8fafc">
      <span style="font-size:13px">📎 ${fmt.esc(d.nombre)}</span>
      <button class="btn btn-ghost btn-sm" onclick="descargarDoc('${d.id}')">Ver</button>
    </div>`).join('');
}

async function descargarDoc(docId) {
  try {
    const { url, nombre } = await clientesService.getUrlDocumento(clienteId, docId);
    await descargas.abrirDocumento(url, nombre);
  } catch (err) {
    console.error('No se pudo obtener el documento', err);
    toast.error(err.message || 'No se pudo obtener el documento');
  }
}

async function subirDocumento(file) {
  try {
    await clientesService.subirDocumento(clienteId, file);
    toast.success('Documento subido');
    await cargar();
  } catch (err) { toast.error(err.message || 'Error al subir el documento'); }
}

// ─── Editar cliente ───────────────────────────────────────────────────────────
function abrirEditar() {
  if (!cliente) return;
  formErrors.limpiar();
  document.getElementById('e-nombre').value   = cliente.nombre || '';
  document.getElementById('e-rfc').value       = cliente.rfc || '';
  document.getElementById('e-telefono').value  = cliente.telefono || '';
  document.getElementById('e-email').value     = cliente.email || '';
  document.getElementById('e-origen').value    = cliente.origen_contacto || '';
  document.getElementById('e-notas').value     = cliente.notas || '';
  modal.open('modal-editar');
}

async function guardarEditar() {
  formErrors.limpiar();
  const nombre = document.getElementById('e-nombre').value.trim();
  if (!nombre) { toast.warning('El nombre es obligatorio'); return; }
  const data = {
    nombre,
    rfc:             document.getElementById('e-rfc').value.trim() || undefined,
    telefono:        document.getElementById('e-telefono').value.trim() || undefined,
    email:           document.getElementById('e-email').value.trim() || undefined,
    origen_contacto: document.getElementById('e-origen').value.trim() || undefined,
    notas:           document.getElementById('e-notas').value.trim() || undefined,
  };
  const btn = document.getElementById('btn-guardar-editar');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await clientesService.actualizar(clienteId, data);
    toast.success('Cliente actualizado');
    modal.close('modal-editar');
    await cargar();
  } catch (err) {
    if (!formErrors.aplicar(err, { nombre: 'e-nombre', rfc: 'e-rfc', telefono: 'e-telefono', email: 'e-email', origen_contacto: 'e-origen', notas: 'e-notas' })) {
      toast.error(err.message || 'Error al guardar');
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

window.descargarDoc = descargarDoc;
