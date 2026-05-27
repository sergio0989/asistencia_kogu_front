'use strict';
/**
 * detalle.js — Vista completa del expediente.
 * Depende de: api.js, asistencias.service.js, catalogos.service.js,
 *             fmt, toast, modal
 */

let expedienteId = null;
let expediente   = null;

document.addEventListener('DOMContentLoaded', async () => {
  expedienteId = new URLSearchParams(window.location.search).get('id');
  if (!expedienteId) {
    toast.error('ID de expediente no encontrado');
    setTimeout(() => window.location.href = '/bandeja.html', 1500);
    return;
  }

  await cargarExpediente();
  inicializarEventos();
});

// ─── Cargar expediente completo ───────────────────────────────────────────────
async function cargarExpediente() {
  try {
    expediente = await asistenciasService.obtener(expedienteId);
    renderExpediente(expediente);
    renderBitacora(expediente.bitacora || []);
    renderHistorial(expediente.historial_estatus || []);
    renderDocumentos(expediente.documentos || []);
    await renderCuestionario(expediente);
  } catch (err) {
    toast.error('Error al cargar el expediente');
    console.error(err);
  }
}

// ─── Render principal ─────────────────────────────────────────────────────────
function renderExpediente(e) {
  // Topbar y hero
  setEl('folio',               e.folio);
  setEl('folio-hero',          e.folio);
  setEl('tipo-nombre',         e.tipo_nombre);
  setEl('subtipo-nombre',      e.subtipo_nombre || '—');
  setEl('canal-origen',        `${fmt.canal(e.canal_origen).icon} ${fmt.canal(e.canal_origen).label}`);
  setEl('created-at',          fmt.fechaHora(e.created_at));
  setEl('creado-por',          e.creado_por_nombre || '—');
  setHtml('urgencia-badge',      fmt.urgenciaBadge(e.nivel_urgencia));
  setHtml('estatus-badge',       fmt.estatusBadge(e.estatus_operativo));
  setHtml('urgencia-badge-hero', fmt.urgenciaBadge(e.nivel_urgencia));
  setHtml('estatus-badge-hero',  fmt.estatusBadge(e.estatus_operativo));

  // Ocultar botón cerrar si ya está cerrado
  if (e.estatus_macro === 'cerrado') {
    document.getElementById('btn-cerrar-expediente')?.setAttribute('disabled', 'true');
    document.getElementById('btn-cerrar-expediente')?.style && (document.getElementById('btn-cerrar-expediente').style.opacity = '.4');
  }

  // Datos del siniestro
  setEl('siniestro-ref',    e.siniestro_ref    || '—');
  setEl('empresa-nombre',   e.empresa_nombre   || '—');
  setEl('convenio-nombre',  e.convenio_nombre  || '—');
  setEl('ajustador-nombre', e.ajustador_nombre || '—');
  setEl('ajustador-tel',    e.ajustador_tel ? fmt.telefono(e.ajustador_tel) : '—');
  setEl('ubicacion',        e.ubicacion);
  setEl('descripcion',      e.descripcion || '—');

  // Conductor
  setEl('conductor-nombre', e.conductor_nombre);
  setEl('conductor-tel',    fmt.telefono(e.conductor_tel));

  // Vehículo
  renderSeccionVehiculo(e.datos_vehiculo);

  // Abogado / proveedor asignado (columna real: proveedor_asignado_id)
  if (e.proveedor_asignado_id) {
    setEl('abogado-nombre', e.proveedor_nombre || '—');
    setEl('abogado-tel',    e.proveedor_tel ? fmt.telefono(e.proveedor_tel) : '—');
    setEl('abogado-email',  e.proveedor_email || '—');
    const av = document.getElementById('abogado-avatar-letra');
    if (av && e.proveedor_nombre) av.textContent = e.proveedor_nombre.charAt(0).toUpperCase();
    document.getElementById('sin-abogado')?.classList.add('hidden');
    document.getElementById('con-abogado')?.classList.remove('hidden');
  } else {
    document.getElementById('sin-abogado')?.classList.remove('hidden');
    document.getElementById('con-abogado')?.classList.add('hidden');
  }

  // Cierre
  if (e.estatus_macro === 'cerrado') {
    document.getElementById('seccion-cierre')?.classList.remove('hidden');
    setEl('fecha-cierre',   fmt.fechaHora(e.fecha_cierre));
    setEl('notas-cierre',   e.notas_cierre || '—');
    setEl('resultado',      e.resultado || '—');
  }

  // SLA (tiempo transcurrido)
  renderSla(e);

  // Título de la página
  document.title = `${e.folio} — Kogu Asistencias`;
}

// ─── SLA ──────────────────────────────────────────────────────────────────────
function renderSla(e) {
  const el = document.getElementById('sla-tiempo');
  if (!el) return;

  const inicio = new Date(e.created_at);
  const fin    = e.fecha_cierre ? new Date(e.fecha_cierre) : new Date();
  const horas  = Math.floor((fin - inicio) / 3600000);
  const dias   = Math.floor(horas / 24);
  const hRest  = horas % 24;

  el.textContent = dias > 0 ? `${dias}d ${hRest}h` : `${horas}h`;

  // Color del SLA según urgencia y tiempo
  const limites = { critico: 4, alto: 24, medio: 72, bajo: 168 };
  const limite  = limites[e.nivel_urgencia] || 72;
  const pct     = Math.min((horas / limite) * 100, 100);
  const bar     = document.getElementById('sla-bar');
  if (bar) {
    bar.style.width = `${pct}%`;
    bar.style.background = pct > 85 ? 'var(--danger)' : pct > 60 ? 'var(--warning)' : 'var(--primary)';
  }
}

// ─── Bitácora ─────────────────────────────────────────────────────────────────
function renderBitacora(items) {
  const container = document.getElementById('bitacora-list');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center">Sin movimientos registrados</p>';
    return;
  }

  container.innerHTML = items.map(item => {
    const iconMap = {
      APERTURA:           '📂',
      CAMBIO_ESTATUS:     '🔄',
      ASIGNACIÓN_ABOGADO: '👤',
      CIERRE:             '✅',
      DOCUMENTO_SUBIDO:   '📎',
      COMENTARIO:         '💬',
      ACTUALIZACIÓN:      '✏️',
      RESPUESTAS_GUARDADAS:'📋',
    };
    const icon = iconMap[item.accion] || '•';
    return `
      <div class="bitacora-item">
        <div class="bitacora-item__icon">${icon}</div>
        <div class="bitacora-item__content">
          <div class="bitacora-item__header">
            <strong>${item.usuario_nombre || 'Sistema'}</strong>
            <span class="bitacora-item__time">${fmt.tiempoRelativo(item.created_at)}</span>
          </div>
          <div class="bitacora-item__desc">${item.descripcion}</div>
        </div>
      </div>`;
  }).join('');
}

// ─── Historial de estatus ─────────────────────────────────────────────────────
function renderHistorial(items) {
  const container = document.getElementById('historial-list');
  if (!container) return;

  container.innerHTML = items.map(h => `
    <div class="historial-item">
      <div style="display:flex;gap:8px;align-items:center">
        ${fmt.estatusBadge(h.estatus_anterior || 'abierto')}
        <span>→</span>
        ${fmt.estatusBadge(h.estatus_nuevo)}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
        ${h.usuario_nombre} · ${fmt.tiempoRelativo(h.created_at)}
        ${h.comentario ? `<br><em>${h.comentario}</em>` : ''}
      </div>
    </div>`
  ).join('') || '<p style="color:var(--text-muted)">Sin cambios de estatus</p>';
}

// ─── Documentos ───────────────────────────────────────────────────────────────
function renderDocumentos(docs) {
  const container = document.getElementById('documentos-list');
  if (!container) return;

  if (!docs.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center">Sin documentos adjuntos</p>';
    return;
  }

  container.innerHTML = docs.map(d => `
    <div class="documento-item">
      <span class="documento-item__nombre">📎 ${d.nombre}</span>
      <button class="btn btn-ghost btn-sm" onclick="descargarDocumento('${d.id}')">Ver</button>
    </div>`
  ).join('');
}

// ─── Inicializar eventos ──────────────────────────────────────────────────────
function inicializarEventos() {
  // Cambiar estatus
  document.getElementById('btn-cambiar-estatus')?.addEventListener('click', () => {
    modal.open('modal-estatus');
  });

  // Asignar abogado
  document.getElementById('btn-asignar-abogado')?.addEventListener('click', async () => {
    await cargarAbogadosModal();
    modal.open('modal-abogado');
  });

  // Cerrar expediente
  document.getElementById('btn-cerrar-expediente')?.addEventListener('click', async () => {
    await cargarMotivosCierre();
    modal.open('modal-cierre');
  });

  // Botones de estatus en el modal
  document.querySelectorAll('[data-nuevo-estatus]').forEach(btn => {
    btn.addEventListener('click', () => cambiarEstatus(btn.dataset.nuevoEstatus));
  });

  // Confirmar cierre
  document.getElementById('btn-confirmar-cierre')?.addEventListener('click', cerrarExpediente);

  // Comentario en bitácora
  document.getElementById('btn-agregar-comentario')?.addEventListener('click', agregarComentario);
  document.getElementById('nuevo-comentario')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) agregarComentario();
  });

  // Upload de documento
  document.getElementById('btn-subir-doc')?.addEventListener('click', () => {
    document.getElementById('input-file')?.click();
  });
  document.getElementById('input-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) subirDocumento(file);
  });

  // Botón asignar desde panel derecho (sin abogado)
  document.getElementById('btn-asignar-abogado-2')?.addEventListener('click', async () => {
    await cargarAbogadosModal();
    modal.open('modal-abogado');
  });

  // Reasignar
  document.getElementById('btn-reasignar')?.addEventListener('click', async () => {
    await cargarAbogadosModal();
    modal.open('modal-abogado');
  });

  // Cuestionario
  document.getElementById('btn-editar-cuestionario')?.addEventListener('click', abrirModalCuestionario);
  document.getElementById('btn-guardar-cuestionario')?.addEventListener('click', guardarCuestionario);

  // Vehículo
  document.getElementById('btn-editar-vehiculo')?.addEventListener('click', abrirModalVehiculo);

  // Editar datos del siniestro
  document.getElementById('btn-editar-siniestro')?.addEventListener('click', abrirModalSiniestro);

  // Editar conductor
  document.getElementById('btn-editar-conductor')?.addEventListener('click', abrirModalConductor);

  // Cambio de empresa → refrescar convenios en el modal de siniestro
  document.getElementById('edit-empresa-id')?.addEventListener('change', async (e) => {
    const empId = e.target.value;
    const sel = document.getElementById('edit-convenio-id');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Sin convenio —</option>';
    if (!empId) return;
    try {
      const convenios = await catalogosService.getConvenios(empId);
      convenios.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nombre;
        sel.appendChild(opt);
      });
    } catch { /* silencioso */ }
  });
}

// ─── Acciones ─────────────────────────────────────────────────────────────────
async function cambiarEstatus(nuevoEstatus) {
  const comentario = document.getElementById('comentario-estatus')?.value || '';
  try {
    await asistenciasService.cambiarEstatus(expedienteId, nuevoEstatus, comentario);
    toast.success(`Estatus actualizado a "${nuevoEstatus}"`);
    modal.close('modal-estatus');
    await cargarExpediente();
  } catch (err) {
    toast.error(err.message || 'Error al cambiar estatus');
  }
}

// ─── Sección Vehículo ─────────────────────────────────────────────────────────
function renderSeccionVehiculo(veh) {
  const cont = document.getElementById('vehiculo-datos');
  if (!cont) return;

  if (!veh || !Object.values(veh).some(v => v)) {
    cont.innerHTML = `
      <div style="text-align:center;padding:20px 0;color:#94a3b8">
        <div style="font-size:28px;margin-bottom:6px">🚗</div>
        <div style="font-size:13px">Sin datos del vehículo registrados</div>
      </div>`;
    return;
  }

  const row = (label, val) => val
    ? `<div class="data-field">
         <div class="data-field__label">${label}</div>
         <div class="data-field__value">${escDetalle(String(val))}</div>
       </div>`
    : '';

  cont.innerHTML = `<div class="data-grid">
    ${row('Marca',   veh.marca)}
    ${row('Modelo',  veh.modelo)}
    ${row('Año',     veh.anio)}
    ${row('Color',   veh.color)}
    ${row('Placas',  veh.placas)}
    ${row('VIN',     veh.vin)}
  </div>`;
}

function abrirModalVehiculo() {
  const veh = expediente?.datos_vehiculo || {};
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  set('veh-marca',  veh.marca);
  set('veh-modelo', veh.modelo);
  set('veh-anio',   veh.anio);
  set('veh-color',  veh.color);
  set('veh-placas', veh.placas);
  set('veh-vin',    veh.vin);
  modal.open('modal-vehiculo');
}

async function guardarVehiculo() {
  const get = id => document.getElementById(id)?.value?.trim() || null;
  const anio = parseInt(document.getElementById('veh-anio')?.value) || null;
  const datos_vehiculo = {
    marca:  get('veh-marca'),
    modelo: get('veh-modelo'),
    anio,
    color:  get('veh-color'),
    placas: get('veh-placas'),
    vin:    get('veh-vin'),
  };
  try {
    await asistenciasService.actualizar(expedienteId, { datos_vehiculo });
    toast.success('Datos del vehículo guardados');
    modal.close('modal-vehiculo');
    await cargarExpediente();
  } catch (err) {
    toast.error(err.message || 'Error al guardar vehículo');
  }
}

// ─── Modal: Editar datos del siniestro ───────────────────────────────────────
async function abrirModalSiniestro() {
  if (!expediente) return;
  const e = expediente;

  // Poblar empresas
  const selEmp = document.getElementById('edit-empresa-id');
  selEmp.innerHTML = '<option value="">— Sin empresa —</option>';
  try {
    const empresas = await catalogosService.getEmpresas();
    empresas.forEach(emp => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = emp.razon_social || emp.nombre_comercial;
      if (emp.id === e.empresa_id) opt.selected = true;
      selEmp.appendChild(opt);
    });
  } catch { /* silencioso */ }

  // Poblar convenios si hay empresa
  const selConv = document.getElementById('edit-convenio-id');
  selConv.innerHTML = '<option value="">— Sin convenio —</option>';
  if (e.empresa_id) {
    try {
      const convenios = await catalogosService.getConvenios(e.empresa_id);
      convenios.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nombre;
        if (c.id === e.convenio_id) opt.selected = true;
        selConv.appendChild(opt);
      });
    } catch { /* silencioso */ }
  }

  // Poblar subtipos del tipo del expediente
  const selSub = document.getElementById('edit-subtipo-id');
  selSub.innerHTML = '<option value="">— Sin subtipo —</option>';
  if (e.tipo_id) {
    try {
      const subtipos = await catalogosService.getSubtipos(e.tipo_id);
      subtipos.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.nombre;
        if (s.id === e.subtipo_id) opt.selected = true;
        selSub.appendChild(opt);
      });
    } catch { /* silencioso */ }
  }

  // Rellenar campos de texto
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('edit-siniestro-ref',    e.siniestro_ref);
  set('edit-ajustador-nombre', e.ajustador_nombre);
  set('edit-ajustador-tel',    e.ajustador_tel);
  set('edit-ubicacion',        e.ubicacion);
  set('edit-descripcion',      e.descripcion);

  modal.open('modal-editar-siniestro');
}

async function guardarSiniestro() {
  const get = id => document.getElementById(id)?.value?.trim() || null;
  const payload = {
    siniestro_ref:    get('edit-siniestro-ref'),
    empresa_id:       get('edit-empresa-id')       || null,
    convenio_id:      get('edit-convenio-id')      || null,
    subtipo_id:       get('edit-subtipo-id')       || null,
    ajustador_nombre: get('edit-ajustador-nombre'),
    ajustador_tel:    get('edit-ajustador-tel'),
    ubicacion:        get('edit-ubicacion'),
    descripcion:      get('edit-descripcion'),
  };
  try {
    await asistenciasService.actualizar(expedienteId, payload);
    toast.success('Datos del siniestro actualizados');
    modal.close('modal-editar-siniestro');
    await cargarExpediente();
  } catch (err) {
    toast.error(err.message || 'Error al guardar');
  }
}

// ─── Modal: Editar conductor / asegurado ─────────────────────────────────────
function abrirModalConductor() {
  if (!expediente) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('edit-conductor-nombre', expediente.conductor_nombre);
  set('edit-conductor-tel',    expediente.conductor_tel);
  modal.open('modal-editar-conductor');
}

async function guardarConductor() {
  const nombre = document.getElementById('edit-conductor-nombre')?.value.trim();
  const tel    = document.getElementById('edit-conductor-tel')?.value.trim();
  if (!nombre || !tel) {
    toast.warning('Nombre y teléfono son obligatorios');
    return;
  }
  try {
    await asistenciasService.actualizar(expedienteId, { conductor_nombre: nombre, conductor_tel: tel });
    toast.success('Datos del conductor actualizados');
    modal.close('modal-editar-conductor');
    await cargarExpediente();
  } catch (err) {
    toast.error(err.message || 'Error al guardar');
  }
}

// ─── Estado del modal de asignación ──────────────────────────────────────────
const asig = {
  especializados: [],
  todos:          [],
  segmento:       'especializados',
  busqueda:       '',
};

async function cargarAbogadosModal() {
  const list = document.getElementById('lista-abogados');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8">Cargando proveedores…</div>';

  asig.busqueda = '';
  const inputBuscar = document.getElementById('asig-buscar');
  if (inputBuscar) inputBuscar.value = '';

  try {
    const tipoId = expediente?.tipo_id;

    const [resEsp, resTod] = await Promise.all([
      tipoId
        ? proveedoresService.listar({ tipo_id: tipoId, limit: 200 })
        : Promise.resolve({ data: [] }),
      proveedoresService.listar({ limit: 200 }),
    ]);

    asig.especializados = (resEsp.data || []).sort(ordenarPorCarga);
    asig.todos          = (resTod.data  || []).sort(ordenarPorCarga);

    const segEl = document.getElementById('asig-segment');
    if (!asig.especializados.length) {
      // Sin especializados → mostrar todos directamente sin el segmento
      asig.segmento = 'todos';
      if (segEl) segEl.style.display = 'none';
    } else {
      asig.segmento = 'especializados';
      if (segEl) segEl.style.display = '';
      document.getElementById('seg-btn-esp')?.classList.add('active');
      document.getElementById('seg-btn-todos')?.classList.remove('active');
    }

    renderProveedoresModal();

  } catch {
    if (list) list.innerHTML = '<div style="color:#dc2626;text-align:center;padding:24px;font-size:13px">Error al cargar proveedores</div>';
    toast.error('Error al cargar proveedores');
  }
}

function ordenarPorCarga(a, b) {
  const prioridad = { vigente: 0, por_vencer: 1, incompleto: 2, vencido: 3, suspendido: 4 };
  const pa = prioridad[a.estatus_expediente] ?? 2;
  const pb = prioridad[b.estatus_expediente] ?? 2;
  if (pa !== pb) return pa - pb;
  return (parseInt(a.casos_activos) || 0) - (parseInt(b.casos_activos) || 0);
}

function renderProveedoresModal() {
  const list = document.getElementById('lista-abogados');
  if (!list) return;

  const fuente = asig.segmento === 'especializados' ? asig.especializados : asig.todos;
  const q      = asig.busqueda.toLowerCase();
  const rows   = q ? fuente.filter(p => p.nombre?.toLowerCase().includes(q)) : fuente;

  if (!rows.length) {
    list.innerHTML = `<div style="text-align:center;padding:28px;color:#94a3b8;font-size:13px">
      <div style="font-size:28px;margin-bottom:6px">${q ? '🔍' : '⚖️'}</div>
      ${q ? 'Sin coincidencias. Intenta con otro nombre.' : 'Sin proveedores disponibles en este segmento.'}
    </div>`;
    return;
  }

  list.innerHTML = rows.map(p => {
    const casos     = parseInt(p.casos_activos) || 0;
    const estExp    = p.estatus_expediente || 'incompleto';
    const bloqueado = estExp === 'vencido' || estExp === 'suspendido';
    const porVencer = estExp === 'por_vencer';
    const claseCarga = casos >= 8 ? 'alta' : casos >= 5 ? 'media' : 'normal';
    const labelCarga = casos >= 8 ? `🔴 ${casos} casos` : casos >= 5 ? `🟡 ${casos} casos` : `🟢 ${casos} caso${casos === 1 ? '' : 's'}`;
    const inicial    = (p.nombre || '?').charAt(0).toUpperCase();
    const warningHtml = bloqueado
      ? `<div style="font-size:10px;color:#dc2626;font-weight:700;margin-top:2px">🚫 Exp. ${estExp} — no asignable</div>`
      : porVencer
        ? `<div style="font-size:10px;color:#d97706;font-weight:600;margin-top:2px">⚠️ Expediente por vencer: ${(p.fecha_vencimiento_expediente||'').slice(0,10)}</div>`
        : '';
    const onclick = bloqueado ? '' : `onclick="asignarAbogado('${p.id}')"`;
    return `
      <div class="abogado-card ${bloqueado ? 'abogado-card--bloqueado' : ''} ${porVencer ? 'abogado-card--por-vencer' : ''}"
           ${onclick}>
        <div class="abogado-avatar">${inicial}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escDetalle(p.nombre)}</div>
          ${p.email ? `<div style="font-size:11px;color:#64748b">${escDetalle(p.email)}</div>` : ''}
          ${warningHtml}
        </div>
        <span class="carga-pill carga-pill--${claseCarga}">${labelCarga}</span>
      </div>`;
  }).join('');
}

function filtrarProveedoresModal(valor) {
  asig.busqueda = (valor || '').trim();
  renderProveedoresModal();
}

function cambiarSegmento(seg) {
  asig.segmento = seg;
  document.getElementById('seg-btn-esp')?.classList.toggle('active',   seg === 'especializados');
  document.getElementById('seg-btn-todos')?.classList.toggle('active', seg === 'todos');
  renderProveedoresModal();
}

function escDetalle(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function asignarAbogado(proveedorId) {
  try {
    await asistenciasService.asignarProveedor(expedienteId, proveedorId);
    toast.success('Proveedor asignado correctamente');
    modal.close('modal-abogado');
    await cargarExpediente();
  } catch (err) {
    toast.error(err.message || 'Error al asignar proveedor');
  }
}

async function cargarMotivosCierre() {
  try {
    const motivos = await catalogosService.getMotivosCierre();
    const select  = document.getElementById('motivo_cierre_id');
    if (!select) return;
    select.innerHTML = '<option value="">— Seleccionar motivo —</option>' +
      motivos.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
  } catch { /* silencioso */ }
}

async function cerrarExpediente() {
  const motivo_cierre_id = document.getElementById('motivo_cierre_id')?.value;
  const notas_cierre     = document.getElementById('notas_cierre')?.value;
  const resultado        = document.getElementById('input-resultado')?.value;

  if (!motivo_cierre_id) {
    toast.warning('Selecciona el motivo de cierre');
    return;
  }

  try {
    await asistenciasService.cerrar(expedienteId, { motivo_cierre_id, notas_cierre, resultado });
    toast.success('Expediente cerrado correctamente');
    modal.close('modal-cierre');
    await cargarExpediente();
  } catch (err) {
    toast.error(err.message || 'Error al cerrar el expediente');
  }
}

async function agregarComentario() {
  const input = document.getElementById('nuevo-comentario');
  const texto = input?.value.trim();
  if (!texto) { toast.warning('Escribe un comentario'); return; }

  try {
    await asistenciasService.agregarComentario(expedienteId, texto);
    toast.success('Comentario registrado');
    if (input) input.value = '';
    await cargarExpediente();
  } catch (err) {
    toast.error(err.message || 'Error al registrar comentario');
  }
}

async function subirDocumento(file) {
  const tipo_doc = document.getElementById('tipo-doc-select')?.value || '';
  try {
    await asistenciasService.subirDocumento(expedienteId, file, tipo_doc);
    toast.success(`"${file.name}" subido correctamente`);
    await cargarExpediente();
  } catch (err) {
    toast.error(err.message || 'Error al subir el documento');
  }
}

async function descargarDocumento(docId) {
  try {
    const { url } = await asistenciasService.getUrlDocumento(expedienteId, docId);
    window.open(url, '_blank');
  } catch (err) {
    toast.error('No se pudo obtener el documento');
  }
}

// ─── Cuestionario dinámico ────────────────────────────────────────────────────

// Estado local del cuestionario en esta vista
const cq = { formularioId: null, esquema: null };

/**
 * Muestra las respuestas guardadas en modo lectura.
 * Si no hay respuestas muestra el estado vacío.
 */
async function renderCuestionario(e) {
  const container = document.getElementById('cuestionario-respuestas');
  if (!container) return;

  const respuestas = e.respuestas || [];

  // Sin respuestas: estado vacío
  if (!respuestas.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:20px 0;color:#94a3b8">
        <div style="font-size:28px;margin-bottom:6px">📝</div>
        <div style="font-size:13px">Sin respuestas registradas</div>
        <div style="font-size:12px;margin-top:4px">Usa el botón <strong>Completar / editar</strong> para llenar el cuestionario.</div>
      </div>`;
    return;
  }

  // Tomar el primer registro de respuestas (el más reciente o el único)
  const registro = respuestas[0];
  cq.formularioId = registro.formulario_id;

  // Cargar el esquema del formulario para mostrar los labels correctos
  let esquema = null;
  try {
    const f = await catalogosService.getFormulario(registro.formulario_id);
    esquema  = f?.esquema;
    cq.esquema = esquema;
  } catch (err) {
    console.warn('No se pudo cargar el esquema del formulario', err);
  }

  const vals = registro.respuestas || {};

  if (!esquema?.secciones) {
    // Sin esquema: mostrar respuestas en modo genérico clave-valor
    const items = Object.entries(vals);
    if (!items.length) {
      container.innerHTML = '<p style="color:#94a3b8;font-size:12px;text-align:center;padding:16px">Sin datos registrados</p>';
      return;
    }
    container.innerHTML = `<div class="data-grid">` +
      items.map(([k, v]) => `
        <div class="data-field">
          <div class="data-field__label" style="font-size:11px">${k}</div>
          <div class="data-field__value" style="font-size:13px">${Array.isArray(v) ? v.join(', ') : v}</div>
        </div>`
      ).join('') + `</div>`;
    return;
  }

  // Con esquema: renderizar sección por sección con los valores guardados
  container.innerHTML = esquema.secciones.map(sec => {
    const campos = sec.campos.map(c => {
      const val = vals[c.id];
      const display = Array.isArray(val) ? val.join(', ') : (val !== undefined && val !== null && val !== '' ? val : '—');
      const isBool  = c.tipo === 'boolean';
      const boolTxt = isBool ? (val ? '✅ Sí' : '✗ No') : null;
      return `
        <div class="data-field">
          <div class="data-field__label" style="font-size:11px">${c.label}</div>
          <div class="data-field__value" style="font-size:13px;font-weight:${val ? '600' : '400'};color:${val ? '#0f172a' : '#94a3b8'}">
            ${isBool ? boolTxt : display}
          </div>
        </div>`;
    }).join('');

    return `
      <div style="margin-bottom:14px">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #f1f5f9">
          ${sec.titulo}
        </div>
        <div class="data-grid">${campos}</div>
      </div>`;
  }).join('');

  // Mostrar fecha de última actualización si existe
  if (registro.updated_at || registro.created_at) {
    const fecha = registro.updated_at || registro.created_at;
    container.insertAdjacentHTML('beforeend', `
      <div style="font-size:11px;color:#94a3b8;margin-top:8px;text-align:right">
        Última actualización: ${fmt.fechaHora(fecha)}
      </div>`);
  }
}

/**
 * Abre el modal con el formulario dinámico pre-rellenado con las respuestas existentes.
 */
async function abrirModalCuestionario() {
  const formContainer = document.getElementById('modal-cuestionario-form');
  if (formContainer) formContainer.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8">Cargando formulario…</div>';

  modal.open('modal-cuestionario');

  try {
    // Determinar formulario_id: usar el guardado o buscar por tipo+subtipo
    let formularioId = cq.formularioId;
    let esquema      = cq.esquema;

    if (!formularioId && expediente?.tipo_id) {
      const formularios = await catalogosService.getFormularios(
        expediente.tipo_id,
        expediente.subtipo_id || ''
      );
      if (formularios?.length) {
        formularioId  = formularios[0].id;
        esquema       = formularios[0].esquema;
        cq.formularioId = formularioId;
        cq.esquema      = esquema;
      }
    }

    if (!esquema?.secciones) {
      formContainer.innerHTML = `
        <div style="text-align:center;padding:40px;color:#94a3b8">
          <div style="font-size:32px;margin-bottom:8px">⚠️</div>
          <div style="font-size:14px;font-weight:600;color:#64748b">Sin cuestionario configurado</div>
          <div style="font-size:13px;margin-top:6px">No hay un formulario activo para este tipo de asistencia.</div>
        </div>`;
      document.getElementById('btn-guardar-cuestionario').style.display = 'none';
      return;
    }

    document.getElementById('btn-guardar-cuestionario').style.display = 'inline-flex';

    // Obtener valores guardados actuales
    const respuestas  = expediente?.respuestas || [];
    const valoresActuales = respuestas.find(r => r.formulario_id === formularioId)?.respuestas || {};

    // Actualizar título del modal
    const tituloModal = document.getElementById('modal-cuestionario-titulo');
    if (tituloModal) tituloModal.textContent = `Cuestionario — ${expediente?.tipo_nombre || 'Caso'}`;

    // Renderizar formulario con valores pre-rellenados
    formContainer.innerHTML = esquema.secciones.map(sec => `
      <div style="margin-bottom:20px">
        <div class="form-section__title">${sec.titulo}</div>
        <div class="form-grid">
          ${sec.campos.map(c => renderCampoCuestionario(c, valoresActuales[c.id])).join('')}
        </div>
      </div>`
    ).join('');

  } catch (err) {
    console.error('Error cargando cuestionario:', err);
    if (formContainer) formContainer.innerHTML = '<div style="text-align:center;padding:32px;color:#dc2626;font-size:13px">Error al cargar el formulario</div>';
  }
}

/**
 * Renderiza un campo del cuestionario con su valor pre-rellenado.
 */
function renderCampoCuestionario(campo, valor) {
  const req = campo.requerido ? '<span style="color:var(--danger)">*</span>' : '';
  const id  = `cq_${campo.id}`;
  const v   = valor ?? '';

  if (campo.tipo === 'texto' || campo.tipo === 'hora') {
    return `<div class="form-group">
      <label for="${id}">${campo.label} ${req}</label>
      <input type="text" id="${id}" name="${campo.id}" value="${escHtml(String(v))}"
        maxlength="${campo.maxLength || 255}" class="form-control">
    </div>`;
  }
  if (campo.tipo === 'fecha') {
    // Si el label menciona "hora", usamos datetime-local
    const esDT   = /hora/i.test(campo.label);
    const inputT = esDT ? 'datetime-local' : 'date';
    // Normalizar el valor almacenado al formato que espera cada input
    let valFecha = String(v || '');
    if (esDT && valFecha && !valFecha.includes('T')) {
      valFecha = valFecha.slice(0, 10) + 'T00:00';   // "2026-04-23" → "2026-04-23T00:00"
    }
    if (!esDT && valFecha && valFecha.includes('T')) {
      valFecha = valFecha.slice(0, 10);               // quitar la hora si no se necesita
    }
    return `<div class="form-group">
      <label for="${id}">${campo.label} ${req}</label>
      <input type="${inputT}" id="${id}" name="${campo.id}" value="${escHtml(valFecha)}" class="form-control">
    </div>`;
  }
  if (campo.tipo === 'numero') {
    return `<div class="form-group">
      <label for="${id}">${campo.label} ${req}</label>
      <input type="number" id="${id}" name="${campo.id}" value="${escHtml(String(v))}"
        min="${campo.min || ''}" max="${campo.max || ''}" class="form-control">
    </div>`;
  }
  if (campo.tipo === 'boolean') {
    return `<div class="form-group form-group--checkbox">
      <label><input type="checkbox" id="${id}" name="${campo.id}" ${v ? 'checked' : ''}> ${campo.label}</label>
    </div>`;
  }
  if (campo.tipo === 'select') {
    const opts = campo.opciones.map(o =>
      `<option value="${escHtml(o)}" ${o === v ? 'selected' : ''}>${escHtml(o)}</option>`
    ).join('');
    return `<div class="form-group">
      <label for="${id}">${campo.label} ${req}</label>
      <select id="${id}" name="${campo.id}" class="form-control">
        <option value="">— Seleccionar —</option>${opts}
      </select>
    </div>`;
  }
  if (campo.tipo === 'checkboxes') {
    const seleccionados = Array.isArray(v) ? v : [];
    return `<div class="form-group form-group--full">
      <label>${campo.label} ${req}</label>
      <div class="checkbox-group">
        ${campo.opciones.map(o => `
          <label class="checkbox-item">
            <input type="checkbox" name="${campo.id}" value="${escHtml(o)}" ${seleccionados.includes(o) ? 'checked' : ''}>
            ${escHtml(o)}
          </label>`).join('')}
      </div>
    </div>`;
  }
  if (campo.tipo === 'textarea') {
    return `<div class="form-group form-group--full">
      <label for="${id}">${campo.label} ${req}</label>
      <textarea id="${id}" name="${campo.id}" rows="3" maxlength="${campo.maxLength || 2000}"
        class="form-control">${escHtml(String(v))}</textarea>
    </div>`;
  }
  return '';
}

/**
 * Recolecta los valores del formulario del modal y los guarda.
 */
async function guardarCuestionario() {
  if (!cq.formularioId) {
    toast.warning('No hay formulario configurado para este caso');
    return;
  }

  const formContainer = document.getElementById('modal-cuestionario-form');
  const respuestas    = {};

  formContainer?.querySelectorAll('[name]').forEach(el => {
    const key = el.name;
    if (el.type === 'checkbox') {
      if (el.value === 'on' || el.value === '') {
        // boolean simple
        respuestas[key] = el.checked;
      } else {
        // checkboxes múltiples
        if (!respuestas[key]) respuestas[key] = [];
        if (el.checked) respuestas[key].push(el.value);
      }
    } else if (el.value !== '') {
      respuestas[key] = el.value;
    }
  });

  const btn = document.getElementById('btn-guardar-cuestionario');
  btn.disabled    = true;
  btn.textContent = 'Guardando…';

  try {
    await asistenciasService.guardarRespuestas(expedienteId, cq.formularioId, respuestas);
    toast.success('Cuestionario guardado correctamente');
    modal.close('modal-cuestionario');
    await cargarExpediente();   // refresca todo, incluyendo la sección de respuestas
  } catch (err) {
    toast.error(err.message || 'Error al guardar el cuestionario');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Guardar respuestas';
  }
}

/** Escapa HTML para evitar XSS en los values del formulario */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '—';
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

window.asignarAbogado          = asignarAbogado;
window.filtrarProveedoresModal = filtrarProveedoresModal;
window.cambiarSegmento         = cambiarSegmento;
window.descargarDocumento      = descargarDocumento;
window.guardarSiniestro        = guardarSiniestro;
window.guardarConductor        = guardarConductor;
window.guardarVehiculo         = guardarVehiculo;
