/**
 * format.js — Helpers de presentación para la UI.
 */

const fmt = {

  /**
   * Escapa una cadena para interpolarla de forma segura en innerHTML,
   * incluyendo dentro de atributos (" y '). Es la ÚNICA función de escape
   * del proyecto: todo dato de la API o input del usuario que se inserte en
   * un template string destinado a innerHTML debe pasar por aquí.
   */
  esc(v) {
    return String(v ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  },

  fecha(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  },

  fechaHora(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },

  tiempoRelativo(isoString) {
    if (!isoString) return '—';
    const diff = Date.now() - new Date(isoString).getTime();
    const min  = Math.floor(diff / 60000);
    const hrs  = Math.floor(min  / 60);
    const dias = Math.floor(hrs  / 24);
    if (min  < 1)   return 'hace un momento';
    if (min  < 60)  return `hace ${min} min`;
    if (hrs  < 24)  return `hace ${hrs} h`;
    if (dias < 30)  return `hace ${dias} día${dias > 1 ? 's' : ''}`;
    return fmt.fecha(isoString);
  },

  urgencia(nivel) {
    const map = {
      critico: { label: 'CRÍTICO',  class: 'badge-danger'  },
      alto:    { label: 'ALTO',     class: 'badge-warning' },
      medio:   { label: 'MEDIO',    class: 'badge-info'    },
      bajo:    { label: 'BAJO',     class: 'badge-success' },
    };
    return map[nivel] || { label: nivel?.toUpperCase() || '—', class: 'badge-secondary' };
  },

  estatus(estatus_operativo) {
    const map = {
      abierto:        { label: 'Abierto',          class: 'badge-info'    },
      asignado:       { label: 'Asignado',         class: 'badge-primary' },
      en_proceso:     { label: 'En proceso',       class: 'badge-warning' },
      pendiente_doc:  { label: 'Pend. documentos', class: 'badge-warning' },
      pendiente_pago: { label: 'Pend. pago',       class: 'badge-warning' },
      cerrado:        { label: 'Cerrado',          class: 'badge-success' },
      archivado:      { label: 'Archivado',        class: 'badge-secondary'},
      anulado:        { label: 'Anulado',          class: 'badge-danger'  },
    };
    return map[estatus_operativo] || { label: estatus_operativo || '—', class: 'badge-secondary' };
  },

  canal(canal_origen) {
    const map = {
      agente:   { label: 'Agente',   icon: '🎫' },
      llamada:  { label: 'Llamada',  icon: '📞' },
      web:      { label: 'Web',      icon: '🌐' },
      whatsapp: { label: 'WhatsApp', icon: '💬' },
      interno:  { label: 'Interno',  icon: '🏢' },
      api:      { label: 'API',      icon: '⚡' },
    };
    return map[canal_origen] || { label: canal_origen || '—', icon: '❓' };
  },

  telefono(tel) {
    if (!tel) return '—';
    const digits = tel.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
    }
    return tel;
  },

  folio(folio) {
    return folio || '—';
  },

  // Moneda MXN (Bf-04). Los montos del API llegan como string ("12500.00").
  moneda(v) {
    const n = Number(v);
    if (v === null || v === undefined || v === '' || Number.isNaN(n)) return '—';
    return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  },

  badgeHtml(text, cssClass) {
    // `text` puede ser un valor crudo de la API (fallback de los mapas de
    // estatus/canal/urgencia) → se escapa. `cssClass` siempre es una clase
    // interna estática.
    return `<span class="badge ${cssClass}">${fmt.esc(text)}</span>`;
  },

  urgenciaBadge(nivel) {
    const u = fmt.urgencia(nivel);
    return fmt.badgeHtml(u.label, u.class);
  },

  estatusBadge(estatus_operativo) {
    const e = fmt.estatus(estatus_operativo);
    return fmt.badgeHtml(e.label, e.class);
  },

  // ── Promotoría (Bf-04) ──────────────────────────────────────────────────────
  estadoCliente(estado) {
    const map = {
      prospecto: { label: 'Prospecto', class: 'badge-info'      },
      cliente:   { label: 'Cliente',   class: 'badge-success'   },
      inactivo:  { label: 'Inactivo',  class: 'badge-secondary' },
    };
    return map[estado] || { label: estado || '—', class: 'badge-secondary' };
  },

  estadoClienteBadge(estado) {
    const e = fmt.estadoCliente(estado);
    return fmt.badgeHtml(e.label, e.class);
  },

  // Estatus de póliza (incluye los calculados por_renovar/vencida).
  estatusPoliza(estatus) {
    const map = {
      vigente:     { label: 'Vigente',     class: 'badge-success'   },
      por_renovar: { label: 'Por renovar', class: 'badge-warning'   },
      vencida:     { label: 'Vencida',     class: 'badge-danger'    },
      renovada:    { label: 'Renovada',    class: 'badge-info'      },
      cancelada:   { label: 'Cancelada',   class: 'badge-secondary' },
    };
    return map[estatus] || { label: estatus || '—', class: 'badge-secondary' };
  },

  estatusPolizaBadge(estatus) {
    const e = fmt.estatusPoliza(estatus);
    return fmt.badgeHtml(e.label, e.class);
  },

  // ── Promotoría P2 (Bf-05) ─────────────────────────────────────────────────
  // Máquina de estatus del pipeline (contexto 'oportunidad'). El label real lo
  // trae el API en estatus_nombre; el mapa es fallback + clase de color.
  estatusOportunidad(estatus) {
    const map = {
      primer_contacto:       { label: 'Primer contacto', class: 'badge-info'      },
      calificado:            { label: 'Calificado',      class: 'badge-primary'   },
      en_cotizacion:         { label: 'En cotización',   class: 'badge-warning'   },
      cotizado:              { label: 'Cotizado',        class: 'badge-warning'   },
      en_emision:            { label: 'En emisión',      class: 'badge-primary'   },
      ganada:                { label: 'Ganada',          class: 'badge-success'   },
      perdida:               { label: 'Perdida',         class: 'badge-danger'    },
      no_califica:           { label: 'No califica',     class: 'badge-secondary' },
      recontacto_programado: { label: 'Recontacto',      class: 'badge-warning'   },
    };
    return map[estatus] || { label: estatus || '—', class: 'badge-secondary' };
  },

  estatusOportunidadBadge(estatus, labelOverride) {
    const e = fmt.estatusOportunidad(estatus);
    return fmt.badgeHtml(labelOverride || e.label, e.class);
  },
};

window.fmt = fmt;
