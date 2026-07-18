/**
 * oportunidades.service.js — Pipeline de oportunidades + cotizaciones (Promotoría P2).
 * Depende de: api.js
 * Contrato: módulo API src/modules/oportunidades (B2-04), colección Postman "Promotoría P2".
 */

const oportunidadesService = {

  // ── Oportunidades ──────────────────────────────────────────────────────────

  async listar(filtros = {}) {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') params.append(k, v);
    });
    const qs = params.toString();
    return api.get(`/oportunidades${qs ? '?' + qs : ''}`);
  },

  async obtener(id) {
    return api.get(`/oportunidades/${id}`);
  },

  async crear(data) {
    return api.post('/oportunidades', data);
  },

  async actualizar(id, data) {
    return api.patch(`/oportunidades/${id}`, data);
  },

  /** Cambio de estatus validado por la máquina. perdida/no_califica → motivo; recontacto → fecha. */
  async cambiarEstatus(id, { estatus, motivo_perdida, fecha_recontacto } = {}) {
    const body = { estatus };
    if (motivo_perdida)   body.motivo_perdida   = motivo_perdida;
    if (fecha_recontacto) body.fecha_recontacto = fecha_recontacto;
    return api.post(`/oportunidades/${id}/estatus`, body);
  },

  /** Convierte (en_emision → ganada) creando la póliza. Devuelve { oportunidad, poliza }. */
  async convertir(id, data) {
    return api.post(`/oportunidades/${id}/convertir`, data);
  },

  async getKpis() {
    return api.get('/oportunidades/kpis');
  },

  async getRecontactos(dias) {
    const qs = dias != null && dias !== '' ? `?dias=${dias}` : '';
    return api.get(`/oportunidades/recontactos${qs}`);
  },

  // ── Cotizaciones (sub-recurso) ─────────────────────────────────────────────

  async crearCotizacion(oportunidadId, data) {
    return api.post(`/oportunidades/${oportunidadId}/cotizaciones`, data);
  },

  async actualizarCotizacion(oportunidadId, cotizacionId, data) {
    return api.patch(`/oportunidades/${oportunidadId}/cotizaciones/${cotizacionId}`, data);
  },

  async seleccionarCotizacion(oportunidadId, cotizacionId) {
    return api.post(`/oportunidades/${oportunidadId}/cotizaciones/${cotizacionId}/seleccionar`);
  },

  async eliminarCotizacion(oportunidadId, cotizacionId) {
    return api.del(`/oportunidades/${oportunidadId}/cotizaciones/${cotizacionId}`);
  },

  async subirDocumentoCotizacion(oportunidadId, cotizacionId, file, tipo_doc = '') {
    const form = new FormData();
    form.append('archivo', file);
    if (tipo_doc) form.append('tipo_doc', tipo_doc);
    return api.postFormData(`/oportunidades/${oportunidadId}/cotizaciones/${cotizacionId}/documentos`, form);
  },

  async getUrlDocumentoCotizacion(oportunidadId, cotizacionId, docId) {
    return api.get(`/oportunidades/${oportunidadId}/cotizaciones/${cotizacionId}/documentos/${docId}/url`);
  },
};

window.oportunidadesService = oportunidadesService;
