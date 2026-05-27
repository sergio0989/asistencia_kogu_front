'use strict';
/**
 * nuevo-caso.js — Stepper de apertura de expediente (4 pasos).
 * Paso 1: Canal + Tipo + Captura rápida
 * Paso 2: Cuestionario dinámico legal
 * Paso 3: Confirmación y folio generado
 *
 * Depende de: api.js, asistencias.service.js, catalogos.service.js,
 *             fmt, toast, modal
 */

const nc = {
  pasoActual:   1,
  totalPasos:   3,
  tipoId:       null,
  tipoClave:    null,
  subtipoId:    null,
  formularioId: null,
  expedienteId: null,
  folio:        null,
  canales:      ['llamada', 'web', 'whatsapp', 'interno'],
};

document.addEventListener('DOMContentLoaded', async () => {
  await cargarCatalogos();
  inicializarEventos();
  irAPaso(1);
});

// ─── Cargar catálogos ─────────────────────────────────────────────────────────
async function cargarCatalogos() {
  try {
    const tipos = await catalogosService.getTipos();
    renderTipos(tipos);

    const empresas = await catalogosService.getEmpresas();
    renderSelect('empresa_id', empresas, 'id', 'razon_social', '— Sin empresa —');

  } catch (err) {
    toast.error('Error al cargar catálogos');
  }
}

function renderTipos(tipos) {
  const container = document.getElementById('tipos-container');
  if (!container) return;

  container.innerHTML = tipos.map(t => {
    const activo  = t.activo;
    const icono   = t.icono || 'file';
    return `
      <div class="tipo-card ${!activo ? 'tipo-card--disabled' : ''}"
           data-tipo-id="${t.id}" data-tipo-clave="${t.clave}"
           onclick="${activo ? `seleccionarTipo('${t.id}','${t.clave}')` : ''}">
        <div class="tipo-card__icon" style="color:${t.color || 'var(--primary)'}">
          <i data-lucide="${icono}"></i>
        </div>
        <div class="tipo-card__nombre">${t.nombre}</div>
        ${!activo ? '<div class="tipo-card__badge">Fase 2</div>' : ''}
      </div>`;
  }).join('');

  // Re-renderiza íconos Lucide si está disponible
  if (window.lucide) lucide.createIcons();
}

function renderSelect(id, items, valueKey, labelKey, placeholder = '— Seleccionar —') {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<option value="">${placeholder}</option>` +
    items.map(i => `<option value="${i[valueKey]}">${i[labelKey]}</option>`).join('');
}

// ─── Eventos ──────────────────────────────────────────────────────────────────
function inicializarEventos() {
  // Canal chips
  document.querySelectorAll('[data-canal]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-canal]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // Urgencia auto-preview
  document.querySelectorAll('[data-urgencia]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-urgencia]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      actualizarPreviewUrgencia(btn.dataset.urgencia);
    });
  });

  // Cambio de empresa → cargar convenios
  document.getElementById('empresa_id')?.addEventListener('change', async (e) => {
    if (!e.target.value) return;
    try {
      const convenios = await catalogosService.getConvenios(e.target.value);
      renderSelect('convenio_id', convenios, 'id', 'nombre', '— Sin convenio —');
    } catch { /* silencioso */ }
  });

  // Botones de navegación del stepper
  document.getElementById('btn-siguiente')?.addEventListener('click', () => avanzarPaso());
  document.getElementById('btn-anterior')?.addEventListener('click', () => retrocederPaso());
  document.getElementById('btn-finalizar')?.addEventListener('click', () => finalizarCaso());
  document.getElementById('btn-ir-bandeja')?.addEventListener('click', () => {
    window.location.href = '/bandeja.html';
  });
  document.getElementById('btn-ir-detalle')?.addEventListener('click', () => {
    window.location.href = `/detalle.html?id=${nc.expedienteId}`;
  });
}

// ─── Navegación del stepper ───────────────────────────────────────────────────
async function avanzarPaso() {
  if (nc.pasoActual === 1) {
    const valido = await crearExpediente();
    if (!valido) return;
    await cargarFormularioDinamico();
    irAPaso(2);
  } else if (nc.pasoActual === 2) {
    await guardarFormulario();
    irAPaso(3);
  }
}

function retrocederPaso() {
  if (nc.pasoActual > 1) irAPaso(nc.pasoActual - 1);
}

function irAPaso(paso) {
  nc.pasoActual = paso;

  // Actualizar indicadores visuales
  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.toggle('step--active',    i + 1 === paso);
    el.classList.toggle('step--completed', i + 1 < paso);
  });

  // Mostrar panel correcto
  document.querySelectorAll('[data-paso]').forEach(panel => {
    panel.style.display = parseInt(panel.dataset.paso) === paso ? 'block' : 'none';
  });

  // Botones
  const btnAnterior  = document.getElementById('btn-anterior');
  const btnSiguiente = document.getElementById('btn-siguiente');
  const btnFinalizar = document.getElementById('btn-finalizar');
  const btnAcciones  = document.getElementById('btn-acciones-final');

  if (btnAnterior)  btnAnterior.style.display  = paso > 1 && paso < nc.totalPasos ? 'inline-flex' : 'none';
  if (btnSiguiente) btnSiguiente.style.display = paso < nc.totalPasos - 1 ? 'inline-flex' : 'none';
  if (btnFinalizar) btnFinalizar.style.display = paso === nc.totalPasos - 1 ? 'inline-flex' : 'none';
  if (btnAcciones)  btnAcciones.style.display  = paso === nc.totalPasos ? 'flex' : 'none';
}

// ─── Paso 1: Crear expediente ─────────────────────────────────────────────────
async function crearExpediente() {
  const canal   = document.querySelector('[data-canal].active')?.dataset.canal;
  const urgencia = document.querySelector('[data-urgencia].active')?.dataset.urgencia || 'medio';

  if (!canal) {
    toast.warning('Selecciona el canal de apertura');
    return false;
  }
  if (!nc.tipoId) {
    toast.warning('Selecciona el tipo de asistencia');
    return false;
  }

  const nombre = document.getElementById('conductor_nombre')?.value.trim();
  const tel    = document.getElementById('conductor_tel')?.value.trim();
  const ubic   = document.getElementById('ubicacion')?.value.trim();

  if (!nombre || !tel || !ubic) {
    toast.warning('Completa los campos obligatorios: conductor, teléfono y ubicación');
    return false;
  }

  // Validar subtipo si la sección está visible
  const subtiposSection = document.getElementById('subtipos-section');
  const subtiposVisibles = subtiposSection?.style.display !== 'none';
  if (subtiposVisibles && !nc.subtipoId) {
    toast.warning('Selecciona la clasificación del caso');
    return false;
  }

  const data = {
    canal_origen:     canal,
    tipo_id:          nc.tipoId,
    subtipo_id:       nc.subtipoId || undefined,
    conductor_nombre: nombre,
    conductor_tel:    tel,
    ubicacion:        ubic,
    nivel_urgencia:   urgencia,
    siniestro_ref:    document.getElementById('siniestro_ref')?.value.trim()   || undefined,
    ajustador_nombre: document.getElementById('ajustador_nombre')?.value.trim() || undefined,
    ajustador_tel:    document.getElementById('ajustador_tel')?.value.trim()   || undefined,
    empresa_id:       document.getElementById('empresa_id')?.value             || undefined,
    convenio_id:      document.getElementById('convenio_id')?.value            || undefined,
    descripcion:      document.getElementById('descripcion')?.value.trim()     || undefined,
  };

  try {
    document.getElementById('btn-siguiente').disabled = true;
    document.getElementById('btn-siguiente').textContent = 'Creando…';

    const expediente = await asistenciasService.crear(data);
    nc.expedienteId  = expediente.id;
    nc.folio         = expediente.folio;

    // Guardar datos del vehículo si se capturaron (PATCH separado)
    const vehiculo = leerDatosVehiculo();
    if (vehiculo) {
      try {
        await asistenciasService.actualizar(expediente.id, { datos_vehiculo: vehiculo });
      } catch (errVeh) {
        console.warn('No se guardaron datos del vehículo:', errVeh.message);
      }
    }

    // Mostrar folio confirmado en paso 2
    const folioEl = document.getElementById('folio-confirmado');
    if (folioEl) folioEl.textContent = expediente.folio;

    toast.success(`Expediente ${expediente.folio} creado`);
    return true;

  } catch (err) {
    toast.error(err.message || 'Error al crear el expediente');
    return false;
  } finally {
    const btn = document.getElementById('btn-siguiente');
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar y continuar →'; }
  }
}

// ─── Paso 2: Formulario dinámico ─────────────────────────────────────────────
async function cargarFormularioDinamico() {
  const container = document.getElementById('formulario-dinamico');
  if (container) container.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8">Cargando formulario…</div>';

  try {
    // Pasa subtipo_id si fue seleccionado, para cargar el cuestionario más específico
    const formularios = await catalogosService.getFormularios(nc.tipoId, nc.subtipoId || '');

    if (!formularios?.length) {
      if (container) container.innerHTML = `
        <div style="text-align:center;padding:40px;color:#94a3b8">
          <div style="font-size:32px;margin-bottom:8px">📋</div>
          <div style="font-size:14px;font-weight:600;color:#64748b">Sin cuestionario configurado</div>
          <div style="font-size:13px;margin-top:6px">Puedes continuar y completar el detalle más adelante desde el expediente.</div>
        </div>`;
      return;
    }

    nc.formularioId = formularios[0].id;
    const esquema   = formularios[0].esquema;
    renderFormularioDinamico(esquema);

  } catch (err) {
    console.error('Error cargando formulario:', err);
    if (container) container.innerHTML = '<div style="text-align:center;padding:32px;color:#dc2626;font-size:13px">Error al cargar el formulario</div>';
  }
}

function renderFormularioDinamico(esquema) {
  const container = document.getElementById('formulario-dinamico');
  if (!container || !esquema?.secciones) return;

  container.innerHTML = esquema.secciones.map(sec => `
    <div class="form-section">
      <h4 class="form-section__title">${sec.titulo}</h4>
      <div class="form-grid">
        ${sec.campos.map(campo => renderCampo(campo)).join('')}
      </div>
    </div>`
  ).join('');
}

function renderCampo(campo) {
  const req  = campo.requerido ? '<span style="color:var(--danger)">*</span>' : '';
  const id   = `campo_${campo.id}`;

  // Atributo condicional: el campo se oculta por defecto si depende de otro
  const condicional = campo.condicional;
  const esCondicional = !!condicional;
  const wrapStyle   = esCondicional ? 'display:none' : '';
  const wrapData    = esCondicional
    ? `data-cond-campo="${condicional.campo}" data-cond-valor="${condicional.valor}"`
    : '';

  let inner = '';

  if (campo.tipo === 'texto' || campo.tipo === 'hora') {
    inner = `<label for="${id}">${campo.label} ${req}</label>
      <input type="text" id="${id}" name="${campo.id}" maxlength="${campo.maxLength || 255}"
        ${campo.requerido && !esCondicional ? 'required' : ''} class="form-control">`;
  }
  else if (campo.tipo === 'fecha') {
    // Si el label menciona "hora" usamos datetime-local; si no, solo date
    const inputType = /hora/i.test(campo.label) ? 'datetime-local' : 'date';
    inner = `<label for="${id}">${campo.label} ${req}</label>
      <input type="${inputType}" id="${id}" name="${campo.id}" class="form-control">`;
  }
  else if (campo.tipo === 'numero') {
    inner = `<label for="${id}">${campo.label} ${req}</label>
      <input type="number" id="${id}" name="${campo.id}"
        min="${campo.min || ''}" max="${campo.max || ''}" class="form-control">`;
  }
  else if (campo.tipo === 'boolean') {
    inner = `<label style="flex-direction:row;align-items:center;gap:8px;cursor:pointer">
      <input type="checkbox" id="${id}" name="${campo.id}"> ${campo.label}</label>`;
  }
  else if (campo.tipo === 'select') {
    inner = `<label for="${id}">${campo.label} ${req}</label>
      <select id="${id}" name="${campo.id}" class="form-control"
              onchange="evaluarCondicionales(this)">
        <option value="">— Seleccionar —</option>
        ${campo.opciones.map(o => `<option value="${o}">${o}</option>`).join('')}
      </select>`;
  }
  else if (campo.tipo === 'checkboxes') {
    return `<div class="form-group form-group--full" style="${wrapStyle}" ${wrapData} data-campo-wrap="${campo.id}">
      <label>${campo.label} ${req}</label>
      <div class="checkbox-group">
        ${campo.opciones.map(o => `
          <label class="checkbox-item">
            <input type="checkbox" name="${campo.id}" value="${o}"> ${o}
          </label>`).join('')}
      </div>
    </div>`;
  }
  else if (campo.tipo === 'textarea') {
    return `<div class="form-group form-group--full" style="${wrapStyle}" ${wrapData} data-campo-wrap="${campo.id}">
      <label for="${id}">${campo.label} ${req}</label>
      <textarea id="${id}" name="${campo.id}" rows="3" maxlength="${campo.maxLength || 2000}"
        class="form-control"></textarea>
    </div>`;
  }

  if (!inner) return '';
  return `<div class="form-group" style="${wrapStyle}" ${wrapData} data-campo-wrap="${campo.id}">
    ${inner}
  </div>`;
}

/**
 * Evalúa los campos condicionales después de que un select cambia su valor.
 * Busca todos los wrappers con data-cond-campo=<name> y los muestra/oculta.
 */
function evaluarCondicionales(selectEl) {
  const nombreCampo = selectEl.name;
  const valorActual = selectEl.value;
  const container   = document.getElementById('formulario-dinamico');
  if (!container) return;

  container.querySelectorAll(`[data-cond-campo="${nombreCampo}"]`).forEach(wrap => {
    const valorEsperado = wrap.dataset.condValor;
    const visible = valorActual === valorEsperado;
    wrap.style.display = visible ? '' : 'none';
    // Limpiar valor cuando se oculta para no enviar datos fantasma
    if (!visible) {
      wrap.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.type === 'checkbox') el.checked = false;
        else el.value = '';
      });
    }
  });
}

window.evaluarCondicionales = evaluarCondicionales;

async function guardarFormulario() {
  if (!nc.formularioId || !nc.expedienteId) return;

  const respuestas = {};
  const container  = document.getElementById('formulario-dinamico');
  if (!container) return;

  container.querySelectorAll('[name]').forEach(el => {
    // Ignorar campos dentro de un wrapper condicional que está oculto
    const wrap = el.closest('[data-campo-wrap]');
    if (wrap && wrap.style.display === 'none') return;

    if (el.type === 'checkbox') {
      if (!respuestas[el.name]) respuestas[el.name] = [];
      if (el.checked) respuestas[el.name].push(el.value || true);
    } else if (el.value) {
      respuestas[el.name] = el.value;
    }
  });

  try {
    await asistenciasService.guardarRespuestas(nc.expedienteId, nc.formularioId, respuestas);
  } catch (err) {
    console.warn('No se guardaron respuestas:', err.message);
  }
}

// ─── Paso 3: Finalizar ────────────────────────────────────────────────────────
function finalizarCaso() {
  irAPaso(3);
  const folioFinal = document.getElementById('folio-final');
  if (folioFinal) folioFinal.textContent = nc.folio;
}

// ─── Preview de urgencia ──────────────────────────────────────────────────────
function actualizarPreviewUrgencia(nivel) {
  const preview = document.getElementById('urgencia-preview');
  if (!preview) return;
  const u = fmt.urgencia(nivel);
  preview.innerHTML = fmt.badgeHtml(u.label, u.class);
}

// ─── Seleccionar tipo ─────────────────────────────────────────────────────────
async function seleccionarTipo(id, clave) {
  nc.tipoId    = id;
  nc.tipoClave = clave;
  nc.subtipoId = null;  // reset al cambiar tipo

  document.querySelectorAll('.tipo-card').forEach(c => c.classList.remove('tipo-card--selected'));
  document.querySelector(`[data-tipo-id="${id}"]`)?.classList.add('tipo-card--selected');

  await cargarSubtipos(id);
}

// ─── Subtipos dinámicos ───────────────────────────────────────────────────────
async function cargarSubtipos(tipo_id) {
  const section   = document.getElementById('subtipos-section');
  const container = document.getElementById('subtipos-container');
  if (!section || !container) return;

  section.style.display = 'none';
  container.innerHTML   = '';

  try {
    const subtipos = await catalogosService.getSubtipos(tipo_id);
    if (!subtipos?.length) return;  // sin subtipos → no se muestra la sección

    section.style.display = 'block';
    container.innerHTML = subtipos.map(s => `
      <div class="tipo-card" data-subtipo-id="${s.id}"
           onclick="seleccionarSubtipo('${s.id}')">
        <div class="tipo-card__nombre" style="font-size:13px">${s.nombre}</div>
        ${s.descripcion ? `<div style="font-size:11px;color:#64748b;margin-top:4px">${s.descripcion}</div>` : ''}
      </div>`
    ).join('');

  } catch (err) {
    console.error('Error cargando subtipos:', err);
  }
}

function seleccionarSubtipo(id) {
  nc.subtipoId = id;
  document.querySelectorAll('[data-subtipo-id]').forEach(c => c.classList.remove('tipo-card--selected'));
  document.querySelector(`[data-subtipo-id="${id}"]`)?.classList.add('tipo-card--selected');
}

// ─── Vehículo (sección colapsable en Paso 1) ─────────────────────────────────
function toggleVehiculo() {
  const form = document.getElementById('veh-form');
  const icon = document.getElementById('veh-toggle-icon');
  if (!form) return;
  const abierto = form.style.display !== 'none';
  form.style.display = abierto ? 'none' : '';
  icon.textContent   = abierto ? '＋ Agregar' : '— Ocultar';
}

/** Recoge los datos del vehículo si la sección está abierta y tiene algún valor. */
function leerDatosVehiculo() {
  const form = document.getElementById('veh-form');
  if (!form || form.style.display === 'none') return null;

  const marca  = document.getElementById('veh-marca')?.value.trim()  || null;
  const modelo = document.getElementById('veh-modelo')?.value.trim() || null;
  const anioRaw = document.getElementById('veh-anio')?.value;
  const anio   = anioRaw ? (parseInt(anioRaw) || null) : null;
  const color  = document.getElementById('veh-color')?.value.trim()  || null;
  const placas = document.getElementById('veh-placas')?.value.trim() || null;
  const vin    = document.getElementById('veh-vin')?.value.trim()    || null;

  // Solo retorna el objeto si al menos un campo tiene valor
  if (!marca && !modelo && !anio && !color && !placas && !vin) return null;
  return { marca, modelo, anio, color, placas, vin };
}

window.seleccionarTipo    = seleccionarTipo;
window.seleccionarSubtipo = seleccionarSubtipo;
window.irAPaso            = irAPaso;
window.toggleVehiculo     = toggleVehiculo;
