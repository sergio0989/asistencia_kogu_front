/**
 * catalogos.service.js — Catálogos del sistema.
 * Depende de: api.js
 */

const catalogosService = {

  // ── TIPOS DE ASISTENCIA ──────────────────────────────────────────────────

  /** Consulta pública: solo activos */
  async getTipos() {
    return api.get('/catalogos/tipos');
  },

  /** Admin: todos (activos e inactivos) */
  async getTiposAdmin() {
    return api.get('/catalogos/tipos?activo=false');
  },

  async crearTipo(data) {
    return api.post('/catalogos/tipos', data);
  },

  async actualizarTipo(id, data) {
    return api.patch(`/catalogos/tipos/${id}`, data);
  },

  // ── SUBTIPOS ─────────────────────────────────────────────────────────────

  /** Consulta pública: solo activos */
  async getSubtipos(tipo_id) {
    return api.get(`/catalogos/tipos/${tipo_id}/subtipos`);
  },

  /** Admin: todos (activos e inactivos) */
  async getSubtiposAdmin(tipo_id) {
    return api.get(`/catalogos/tipos/${tipo_id}/subtipos/admin`);
  },

  async crearSubtipo(tipo_id, data) {
    return api.post(`/catalogos/tipos/${tipo_id}/subtipos`, data);
  },

  async actualizarSubtipo(id, data) {
    return api.patch(`/catalogos/subtipos/${id}`, data);
  },

  // ── FORMULARIOS / CUESTIONARIOS ──────────────────────────────────────────

  /** Consulta pública: activos para tipo+subtipo */
  async getFormularios(tipo_id, subtipo_id = '') {
    const qs = subtipo_id ? `?tipo_id=${tipo_id}&subtipo_id=${subtipo_id}` : `?tipo_id=${tipo_id}`;
    return api.get(`/catalogos/formularios${qs}`);
  },

  /** Admin: todos los formularios de un tipo (activos e inactivos) */
  async getFormulariosAdmin(tipo_id) {
    return api.get(`/catalogos/tipos/${tipo_id}/formularios/admin`);
  },

  async getFormulario(id) {
    return api.get(`/catalogos/formularios/${id}`);
  },

  async crearFormulario(data) {
    return api.post('/catalogos/formularios', data);
  },

  async actualizarFormulario(id, data) {
    return api.patch(`/catalogos/formularios/${id}`, data);
  },

  // ── EMPRESAS / ASEGURADORAS ──────────────────────────────────────────────

  async getEmpresas() {
    return api.get('/catalogos/empresas');
  },

  async getEmpresasStats({ fechaDesde = '', fechaHasta = '' } = {}) {
    const qs = new URLSearchParams();
    if (fechaDesde) qs.set('fecha_desde', fechaDesde);
    if (fechaHasta) qs.set('fecha_hasta', fechaHasta);
    const q = qs.toString();
    return api.get(`/catalogos/empresas/stats${q ? '?' + q : ''}`);
  },

  async getEmpresa(id) {
    return api.get(`/catalogos/empresas/${id}`);
  },

  async crearEmpresa(data) {
    return api.post('/catalogos/empresas', data);
  },

  async actualizarEmpresa(id, data) {
    return api.patch(`/catalogos/empresas/${id}`, data);
  },

  async getConvenios(empresa_id) {
    return api.get(`/catalogos/empresas/${empresa_id}/convenios`);
  },

  // ── OTROS ────────────────────────────────────────────────────────────────

  async getMotivosCierre(tipo_id = '') {
    const qs = tipo_id ? `?tipo_id=${tipo_id}` : '';
    return api.get(`/catalogos/motivos-cierre${qs}`);
  },
};

window.catalogosService = catalogosService;
