'use strict';
/**
 * nuevo-caso.js — Stepper de apertura de expediente (4 pasos).
 * Paso 1: Canal + Tipo + Captura rápida
 * Paso 2: Cuestionario dinámico legal
 * Paso 3: Confirmación y folio generado
 *
 * Depende de: api.js, asistencias.service.js, catalogos.service.js,
 *             fmt, toast, modal, formRenderer
 */

const nc = {
  pasoActual:   1,
  totalPasos:   3,
  tipoId:       null,
  tipoClave:    null,
  subtipoId:    null,
  formularioId: null,
  expedienteId: null,
  tipoIdCreado: null,
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

  // t.id / t.clave son del catálogo (controlados) → tal cual en onclick;
  // en atributos y texto se escapan junto al resto de datos.
  container.innerHTML = tipos.map(t => {
    const activo  = t.activo;
    const icono   = t.icono || 'file';
    return `
      <div class="tipo-card ${!activo ? 'tipo-card--disabled' : ''}"
           data-tipo-id="${fmt.esc(t.id)}" data-tipo-clave="${fmt.esc(t.clave)}"
           onclick="${activo ? `seleccionarTipo('${t.id}','${t.clave}')` : ''}">
        <div class="tipo-card__icon" style="color:${fmt.esc(t.color || 'var(--primary)')}">
          <i data-lucide="${fmt.esc(icono)}"></i>
        </div>
        <div class="tipo-card__nombre">${fmt.esc(t.nombre)}</div>
        ${!activo ? '<div class="tipo-card__badge">Fase 2</div>' : ''}
      </div>`;
  }).join('');

  // Re-renderiza íconos Lucide si está disponible
  if (window.lucide) lucide.createIcons();
}

function renderSelect(id, items, valueKey, labelKey, placeholder = '— Seleccionar —') {
  const el = document.getElementById(id);
  if (!el) return;
  // Caso especial: se escapan tanto los values como los labels de las options.
  el.innerHTML = `<option value="">${fmt.esc(placeholder)}</option>` +
    items.map(i => `<option value="${fmt.esc(i[valueKey])}">${fmt.esc(i[labelKey])}</option>`).join('');
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
    // KA-F-05: esto llamaba a crearExpediente() SIEMPRE. Avanzar, retroceder y
    // volver a avanzar creaba un segundo expediente: quedaban huérfanos en la
    // bandeja y se quemaban folios del contador atómico. Si ya existe, se
    // actualiza en vez de crear otro.
    const ok = nc.expedienteId ? await actualizarExpediente() : await crearExpediente();
    if (!ok) return;
    await cargarFormularioDinamico();
    irAPaso(2);
  } else if (nc.pasoActual === 2) {
    // KA-F-10: antes se tragaba el error y avanzaba igual mostrando
    // "expediente creado", así que el usuario creía que había guardado el
    // cuestionario. Si falla, se queda en el paso 2.
    const ok = await guardarFormulario();
    if (!ok) return;
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
// Valida el paso 1 y arma el cuerpo. Devuelve null si algo falta (ya avisó).
function validarYArmarDatos() {
  const canal   = document.querySelector('[data-canal].active')?.dataset.canal;
  const urgencia = document.querySelector('[data-urgencia].active')?.dataset.urgencia || 'medio';

  if (!canal) {
    toast.warning('Selecciona el canal de apertura');
    return null;
  }
  if (!nc.tipoId) {
    toast.warning('Selecciona el tipo de asistencia');
    return null;
  }

  const nombre = document.getElementById('conductor_nombre')?.value.trim();
  const tel    = document.getElementById('conductor_tel')?.value.trim();
  const ubic   = document.getElementById('ubicacion')?.value.trim();

  if (!nombre || !tel || !ubic) {
    toast.warning('Completa los campos obligatorios: conductor, teléfono y ubicación');
    return null;
  }

  // Validar subtipo si la sección está visible
  const subtiposSection = document.getElementById('subtipos-section');
  const subtiposVisibles = subtiposSection?.style.display !== 'none';
  if (subtiposVisibles && !nc.subtipoId) {
    toast.warning('Selecciona la clasificación del caso');
    return null;
  }

  return {
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
}

async function crearExpediente() {
  const data = validarYArmarDatos();
  if (!data) return false;

  try {
    document.getElementById('btn-siguiente').disabled = true;
    document.getElementById('btn-siguiente').textContent = 'Creando…';

    const expediente = await asistenciasService.crear(data);
    nc.expedienteId  = expediente.id;
    nc.folio         = expediente.folio;
    nc.tipoIdCreado  = data.tipo_id;   // PATCH no puede cambiarlo (ver abajo)

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

// Segunda pasada por el paso 1 (el usuario retrocedió y volvió a avanzar): el
// expediente ya existe, así que se actualiza en vez de crear otro.
//
// `PATCH /asistencias/:id` no acepta `canal_origen` ni `tipo_id` — el tipo
// determina el cuestionario y el folio ya emitido, y no se puede reescribir.
// Si el usuario lo cambió, se le dice en claro en vez de dejar que la pantalla
// y el expediente digan cosas distintas.
async function actualizarExpediente() {
  const data = validarYArmarDatos();
  if (!data) return false;

  if (nc.tipoIdCreado && data.tipo_id !== nc.tipoIdCreado) {
    toast.warning(
      `El tipo de asistencia no se puede cambiar en el expediente ${nc.folio}, que ya está creado. ` +
      'Cancela y abre uno nuevo si necesitas otro tipo.',
    );
    return false;
  }

  // Solo lo que el backend admite actualizar.
  const editables = {
    subtipo_id:       data.subtipo_id,
    conductor_nombre: data.conductor_nombre,
    conductor_tel:    data.conductor_tel,
    ubicacion:        data.ubicacion,
    nivel_urgencia:   data.nivel_urgencia,
    siniestro_ref:    data.siniestro_ref,
    ajustador_nombre: data.ajustador_nombre,
    ajustador_tel:    data.ajustador_tel,
    empresa_id:       data.empresa_id,
    convenio_id:      data.convenio_id,
    descripcion:      data.descripcion,
  };
  const vehiculo = leerDatosVehiculo();
  if (vehiculo) editables.datos_vehiculo = vehiculo;

  const btn = document.getElementById('btn-siguiente');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
    await asistenciasService.actualizar(nc.expedienteId, editables);
    toast.success(`Expediente ${nc.folio} actualizado`);
    return true;
  } catch (err) {
    console.error('No se pudo actualizar el expediente', err);
    toast.error(err.message || 'No se pudo actualizar el expediente');
    return false;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar y continuar →'; }
  }
}

// ─── Paso 2: Formulario dinámico ─────────────────────────────────────────────
async function cargarFormularioDinamico() {
  const container = document.getElementById('formulario-dinamico');
  // estático: estado de carga
  if (container) container.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8">Cargando formulario…</div>';

  try {
    // Pasa subtipo_id si fue seleccionado, para cargar el cuestionario más específico
    const formularios = await catalogosService.getFormularios(nc.tipoId, nc.subtipoId || '');

    if (!formularios?.length) {
      // estático: sin cuestionario
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
    // Renderer compartido (Bf-05): mismo formato de secciones/campos.
    formRenderer.render(container, esquema);

  } catch (err) {
    console.error('Error cargando formulario:', err);
    // estático: mensaje de error fijo
    if (container) container.innerHTML = '<div style="text-align:center;padding:32px;color:#dc2626;font-size:13px">Error al cargar el formulario</div>';
  }
}

async function guardarFormulario() {
  // Sin cuestionario que guardar el paso no aporta nada: se deja avanzar.
  if (!nc.formularioId || !nc.expedienteId) return true;

  const container = document.getElementById('formulario-dinamico');
  if (!container) return true;
  const respuestas = formRenderer.recolectar(container);

  try {
    await asistenciasService.guardarRespuestas(nc.expedienteId, nc.formularioId, respuestas);
    return true;
  } catch (err) {
    console.error('No se guardaron las respuestas del cuestionario', err);
    toast.error(err.message || 'No se pudo guardar el cuestionario. Revisa los datos e inténtalo de nuevo.');
    return false;
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
  container.innerHTML   = ''; // reset (cadena vacía, sin datos)

  try {
    const subtipos = await catalogosService.getSubtipos(tipo_id);
    if (!subtipos?.length) return;  // sin subtipos → no se muestra la sección

    section.style.display = 'block';
    // s.id: UUID propio → tal cual en onclick; nombre/descripción escapados.
    container.innerHTML = subtipos.map(s => `
      <div class="tipo-card" data-subtipo-id="${fmt.esc(s.id)}"
           onclick="seleccionarSubtipo('${s.id}')">
        <div class="tipo-card__nombre" style="font-size:13px">${fmt.esc(s.nombre)}</div>
        ${s.descripcion ? `<div style="font-size:11px;color:#64748b;margin-top:4px">${fmt.esc(s.descripcion)}</div>` : ''}
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
