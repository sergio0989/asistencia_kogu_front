/**
 * config.js — Configuración global del frontend.
 * Debe ser el PRIMER script que se cargue en todas las páginas.
 */

// ── Ambientes disponibles ──────────────────────────────────────────────────────
window.AMBIENTES = {
  qa:          { label: 'QA',          url: 'https://asistencia-kogu.onrender.com/api/v1' },
  produccion:  { label: 'Producción',  url: 'https://api.kogu.mx/api/v1' },
  local:       { label: 'Local (dev)', url: 'http://localhost:3000/api/v1' },
};

// ── Ambiente activo — se lee de localStorage, default: qa ────────────────────
const _ambienteGuardado = localStorage.getItem('kogu_ambiente') || 'qa';
window.AMBIENTE_ACTIVO  = window.AMBIENTES[_ambienteGuardado] ? _ambienteGuardado : 'qa';
window.API_BASE_URL     = window.AMBIENTES[window.AMBIENTE_ACTIVO].url;

/** Cambia el ambiente activo y actualiza API_BASE_URL en tiempo real. */
window.setAmbiente = function (clave) {
  if (!window.AMBIENTES[clave]) return;
  window.AMBIENTE_ACTIVO = clave;
  window.API_BASE_URL    = window.AMBIENTES[clave].url;
  localStorage.setItem('kogu_ambiente', clave);
};
