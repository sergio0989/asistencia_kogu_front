'use strict';
/**
 * nueva-oportunidad.js — Alta de oportunidad (stepper 3 pasos, Promotoría P2).
 * Espejo de nuevo-caso.js. El cuestionario del ramo usa formRenderer (Bf-05).
 * Depende de: api.js, oportunidades.service.js, catalogos.service.js,
 *             clientes.service.js, agentes.service.js, auth.service.js,
 *             fmt, toast, formErrors, formRenderer.
 */

const PUEDE_AGENTES = authService.hasAnyRole('admin', 'supervisor', 'operador', 'promotor');

const no = {
  paso:  1,
  mode:  'existente',      // 'existente' | 'prospecto'
  canal: null,
  ramoId: null,
  formularioCargadoParaRamo: null,
  oportunidadId: null,
  folio: null,
};

// Mapa 422 → input. Los campos del prospecto llegan anidados (prospecto.<campo>).
const MAPA = {
  ramo_id: 'o-ramo', cliente_id: 'o-cliente-buscar', agente_id: 'o-agente',
  promotoria_id: 'o-promotoria',
  vencimiento_poliza_actual: 'o-vencimiento', aseguradora_actual: 'o-aseguradora-actual',
  notas: 'o-notas',
  'prospecto.nombre': 'o-nombre', 'prospecto.tipo_persona': 'o-tipo-persona',
  'prospecto.rfc': 'o-rfc', 'prospecto.telefono': 'o-telefono', 'prospecto.email': 'o-email',
  'prospecto.origen_contacto': 'o-origen', 'prospecto.notas': 'o-notas',
  'prospecto.aviso_privacidad_version': 'o-aviso-version',
  'prospecto.consentimiento_canal': 'o-consent-canal',
  prospecto: 'o-nombre',
};

document.addEventListener('DOMContentLoaded', async () => {
  // La ubicación comercial decide qué pickers se muestran (§7.1).
  await authService.asegurarPerfilComercial();
  perfil = authService.perfilComercial();

  await Promise.all([cargarRamos(), montarPickerAgente(), cargarPromotorias()]);

  // Canal chips
  document.querySelectorAll('[data-canal]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-canal]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      no.canal = chip.dataset.canal;
    });
  });

  // Tabs de modo cliente
  document.querySelectorAll('[data-mode]').forEach(tab => {
    tab.addEventListener('click', () => seleccionarModo(tab.dataset.mode));
  });

  document.getElementById('o-ramo')?.addEventListener('change', e => { no.ramoId = e.target.value; });

  montarPickerCliente();

  document.getElementById('btn-siguiente')?.addEventListener('click', avanzarAPaso2);
  document.getElementById('btn-anterior')?.addEventListener('click', () => irAPaso(1));
  document.getElementById('btn-crear')?.addEventListener('click', crearOportunidad);
  document.getElementById('btn-ir-pipeline')?.addEventListener('click', () => { window.location.href = '/comercial/pipeline.html'; });
  document.getElementById('btn-ir-detalle')?.addEventListener('click', () => {
    if (no.oportunidadId) window.location.href = `/comercial/oportunidad.html?id=${no.oportunidadId}`;
  });

  irAPaso(1);
});

// ─── Catálogos ──────────────────────────────────────────────────────────────
async function cargarRamos() {
  try {
    const ramos = await catalogosService.getRamos() || [];
    document.getElementById('o-ramo').innerHTML =
      '<option value="">— Seleccionar ramo —</option>' +
      ramos.map(r => `<option value="${fmt.esc(r.id)}">${fmt.esc(r.nombre)}</option>`).join('');
  } catch { toast.error('No se pudieron cargar los ramos'); }
}

// Bf-07: agente y cliente dejan de volcarse/buscarse a mano y pasan al picker,
// que trae debounce, paginación y errores visibles.
let pkAgente     = null;
let pkCliente    = null;
let pkSubagente  = null;
// 'elevado' | 'agente_raiz' | 'subagente' (§7.1)
let perfil = 'elevado';

// §7.1: el reparto agente/sub-agente lo decide el backend según quién crea el
// trato. Solo se piden los dos pickers a quien puede elegirlos — y `GET
// /agentes` solo admite admin/supervisor/promotor, así que un rol `agente` ni
// siquiera podría alimentarlos.
function montarPickerAgente() {
  if (!PUEDE_AGENTES) {
    const aviso = document.getElementById('o-aviso-asignacion');
    const txt   = document.getElementById('o-aviso-asignacion-txt');
    if (aviso && txt) {
      txt.textContent = perfil === 'subagente'
        ? 'Se registrará a tu nombre como sub-agente, con tu agente titular en la oportunidad.'
        : 'La oportunidad se registrará a tu nombre.';
      aviso.style.display = '';
    }
    return;
  }

  pkAgente = picker.bind({
    inputId:     'o-agente-label', hiddenId: 'o-agente',
    botonId:     'o-agente-btn',   limpiarId: 'o-agente-clear',
    titulo:      'Seleccionar agente',
    placeholder: 'Nombre, RFC o correo…',
    vacio:       'Escribe para buscar agentes.',
    buscar:      (q, page) => agentesService.listar({ buscar: q, page, limit: 20, solo_raiz: true }),
    item:        a => ({ id: a.id, titulo: a.nombre, sub: a.email || a.rfc || '—' }),
    onSelect:    () => { pkSubagente?.set('', ''); habilitarSubagente(true); },
  });
  document.getElementById('grupo-agente').style.display = '';
  document.getElementById('o-agente-clear')?.addEventListener('click', () => {
    pkSubagente?.set('', ''); habilitarSubagente(false);
  });

  pkSubagente = picker.bind({
    inputId:     'o-subagente-label', hiddenId: 'o-subagente',
    botonId:     'o-subagente-btn',   limpiarId: 'o-subagente-clear',
    titulo:      'Seleccionar sub-agente',
    placeholder: 'Nombre, RFC o correo…',
    vacio:       'Escribe para buscar sub-agentes.',
    buscar:      (q, page) => agentesService.listar({
      buscar: q, page, limit: 20, agente_padre_id: document.getElementById('o-agente').value || undefined,
    }),
    item:        a => ({ id: a.id, titulo: a.nombre, sub: a.email || a.rfc || '—' }),
  });
  document.getElementById('grupo-subagente').style.display = '';
  habilitarSubagente(false);
}

function habilitarSubagente(on) {
  pkSubagente?.habilitar(on);
  const input = document.getElementById('o-subagente-label');
  if (input) input.placeholder = on ? 'Buscar sub-agente…' : 'Elige primero un agente';
}

function montarPickerCliente() {
  pkCliente = picker.bind({
    inputId:     'o-cliente-buscar', hiddenId: 'o-cliente-id',
    botonId:     'o-cliente-btn',    limpiarId: 'o-cliente-clear',
    titulo:      'Seleccionar cliente',
    placeholder: 'Nombre, teléfono o RFC…',
    vacio:       'Escribe para buscar en la cartera.',
    buscar:      (q, page) => clientesService.listar({ buscar: q, page, limit: 20 }),
    item:        c => ({
      id:     c.id,
      titulo: c.nombre,
      sub:    `${c.telefono ? fmt.telefono(c.telefono) : 's/tel'} · ${c.estado || '—'}`,
    }),
    onSelect: () => {
      // estático: confirmación fija, sin dato interpolado.
      document.getElementById('o-cliente-resultados').innerHTML =
        '<div style="color:#166534;font-size:12px;padding:6px 2px">✓ Cliente seleccionado</div>';
    },
  });

  document.getElementById('o-cliente-clear')?.addEventListener('click', () => {
    document.getElementById('o-cliente-resultados').innerHTML = '';
  });
}

async function cargarPromotorias() {
  if (!PUEDE_AGENTES) return;  // agente/promotor: el API fuerza su promotoría
  try {
    const proms = await catalogosService.getPromotorias() || [];
    if (proms.length) {
      document.getElementById('o-promotoria').innerHTML =
        proms.map(p => `<option value="${fmt.esc(p.id)}">${fmt.esc(p.nombre)}</option>`).join('');
      no._tienePromotorias = proms.length;
    }
  } catch { /* admin sin promotorías visibles: usa lo que mande el form */ }
}

// ─── Modo cliente ───────────────────────────────────────────────────────────
function seleccionarModo(mode) {
  no.mode = mode;
  document.querySelectorAll('[data-mode]').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  document.getElementById('mode-existente').style.display = mode === 'existente' ? '' : 'none';
  document.getElementById('mode-prospecto').style.display = mode === 'prospecto' ? '' : 'none';
  // La promotoría solo aplica al crear prospecto nuevo (y solo para roles elevados).
  const showProm = mode === 'prospecto' && PUEDE_AGENTES && no._tienePromotorias > 0;
  document.getElementById('grupo-promotoria').style.display = showProm ? '' : 'none';
}

// ─── Navegación ─────────────────────────────────────────────────────────────
function irAPaso(paso) {
  no.paso = paso;
  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.toggle('step--active',    i + 1 === paso);
    el.classList.toggle('step--completed', i + 1 < paso);
  });
  document.querySelectorAll('[data-paso]').forEach(panel => {
    panel.style.display = parseInt(panel.dataset.paso) === paso ? 'block' : 'none';
  });
}

async function avanzarAPaso2() {
  formErrors.limpiar();
  if (!no.canal)   { toast.warning('Selecciona el canal de contacto'); return; }
  if (!no.ramoId)  { toast.warning('Selecciona el ramo'); return; }

  if (no.mode === 'existente') {
    if (!document.getElementById('o-cliente-id').value) {
      toast.warning('Busca y selecciona un cliente existente'); return;
    }
  } else {
    if (!document.getElementById('o-nombre').value.trim()) { toast.warning('El nombre del prospecto es obligatorio'); return; }
    const aviso = document.getElementById('o-aviso-version').value.trim();
    const canal = document.getElementById('o-consent-canal').value;
    if (!aviso || !canal) { toast.warning('El consentimiento DP-07 (versión del aviso y canal) es obligatorio'); return; }
  }

  await cargarCuestionario();
  irAPaso(2);
}

async function cargarCuestionario() {
  const container = document.getElementById('formulario-dinamico');
  if (no.formularioCargadoParaRamo === no.ramoId) return;  // ya cargado para este ramo
  container.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8">Cargando cuestionario…</div>';
  try {
    const formularios = await catalogosService.getFormulariosPromotoria(no.ramoId) || [];
    if (!formularios.length) {
      container.removeAttribute('data-form-renderer');
      container.innerHTML = `
        <div style="text-align:center;padding:40px;color:#94a3b8">
          <div style="font-size:32px;margin-bottom:8px">📋</div>
          <div style="font-size:14px;font-weight:600;color:#64748b">Sin cuestionario configurado para este ramo</div>
          <div style="font-size:13px;margin-top:6px">Puedes continuar; se completará más adelante desde el detalle.</div>
        </div>`;
    } else {
      formRenderer.render(container, formularios[0].esquema);
    }
    no.formularioCargadoParaRamo = no.ramoId;
  } catch (err) {
    console.error('Error cargando cuestionario:', err);
    container.innerHTML = '<div style="text-align:center;padding:32px;color:#dc2626;font-size:13px">Error al cargar el cuestionario</div>';
  }
}

// ─── Crear (POST /oportunidades con respuestas) ─────────────────────────────
async function crearOportunidad() {
  formErrors.limpiar();

  const data = {
    ramo_id:      no.ramoId,
    canal_origen: no.canal,
  };
  const venc = document.getElementById('o-vencimiento').value;
  const aseg = document.getElementById('o-aseguradora-actual').value.trim();
  const notas = document.getElementById('o-notas').value.trim();
  if (venc)  data.vencimiento_poliza_actual = venc;
  if (aseg)  data.aseguradora_actual = aseg;
  if (notas) data.notas = notas;

  if (PUEDE_AGENTES) {
    const sub = document.getElementById('o-subagente').value;
    if (sub) data.subagente_id = sub;
    const ag = document.getElementById('o-agente').value;
    if (ag) data.agente_id = ag;
  }

  if (no.mode === 'existente') {
    data.cliente_id = document.getElementById('o-cliente-id').value;
  } else {
    data.prospecto = {
      nombre:                   document.getElementById('o-nombre').value.trim(),
      tipo_persona:             document.getElementById('o-tipo-persona').value,
      rfc:                      document.getElementById('o-rfc').value.trim() || undefined,
      telefono:                 document.getElementById('o-telefono').value.trim() || undefined,
      email:                    document.getElementById('o-email').value.trim() || undefined,
      origen_contacto:          document.getElementById('o-origen').value.trim() || undefined,
      aviso_privacidad_version: document.getElementById('o-aviso-version').value.trim(),
      consentimiento_canal:     document.getElementById('o-consent-canal').value,
    };
    if (PUEDE_AGENTES) {
      const prom = document.getElementById('o-promotoria').value;
      if (prom) data.promotoria_id = prom;
    }
  }

  // Respuestas del cuestionario del ramo (JSON recogido por formRenderer).
  const container = document.getElementById('formulario-dinamico');
  const respuestas = formRenderer.recolectar(container);
  if (Object.keys(respuestas).length) data.respuestas = respuestas;

  const btn = document.getElementById('btn-crear');
  btn.disabled = true; btn.textContent = 'Creando…';
  try {
    const op = await oportunidadesService.crear(data);
    no.oportunidadId = op.id;
    no.folio = op.folio;
    document.getElementById('folio-preview').textContent = op.folio || '—';
    document.getElementById('folio-final').textContent   = op.folio || '—';
    irAPaso(3);
    toast.success(`Oportunidad ${op.folio || ''} creada`);
  } catch (err) {
    if (err.status === 403) {
      toast.error('No tienes acceso para crear esta oportunidad');
      setTimeout(() => { window.location.href = '/comercial/pipeline.html'; }, 1200);
      return;
    }
    // Los campos con error viven en el Paso 1 → regresar para mostrarlos.
    irAPaso(1);
    if (!formErrors.aplicar(err, MAPA)) toast.error(err.message || 'Error al crear la oportunidad');
  } finally {
    btn.disabled = false; btn.textContent = 'Crear oportunidad →';
  }
}

