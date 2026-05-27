/**
 * format.js — Helpers de presentación para la UI.
 */

const fmt = {

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

  badgeHtml(text, cssClass) {
    return `<span class="badge ${cssClass}">${text}</span>`;
  },

  urgenciaBadge(nivel) {
    const u = fmt.urgencia(nivel);
    return fmt.badgeHtml(u.label, u.class);
  },

  estatusBadge(estatus_operativo) {
    const e = fmt.estatus(estatus_operativo);
    return fmt.badgeHtml(e.label, e.class);
  },
};

window.fmt = fmt;
