/**
 * polizas.service.js — Pólizas, recibos y renovaciones (Promotoría P1).
 * Depende de: api.js
 */

const polizasService = {

  async listar(filtros = {}) {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') params.append(k, v);
    });
    const qs = params.toString();
    return api.get(`/polizas${qs ? '?' + qs : ''}`);
  },

  async obtener(id) {
    return api.get(`/polizas/${id}`);
  },

  async crear(data) {
    return api.post('/polizas', data);
  },

  async actualizar(id, data) {
    return api.patch(`/polizas/${id}`, data);
  },

  async renovar(id, data) {
    return api.post(`/polizas/${id}/renovar`, data);
  },

  async cancelar(id, motivo) {
    return api.post(`/polizas/${id}/cancelar`, { motivo });
  },

  async pagarRecibo(poliza_id, recibo_id, pagado_at) {
    return api.post(`/polizas/${poliza_id}/recibos/${recibo_id}/pagar`, pagado_at ? { pagado_at } : {});
  },

  async crearEndoso(poliza_id, { tipo, descripcion, fecha }, file = null) {
    const form = new FormData();
    form.append('tipo', tipo);
    form.append('descripcion', descripcion);
    if (fecha) form.append('fecha', fecha);
    if (file)  form.append('archivo', file);
    return api.postFormData(`/polizas/${poliza_id}/endosos`, form);
  },

  async subirDocumento(id, file, tipo_doc = '') {
    const form = new FormData();
    form.append('archivo', file);
    if (tipo_doc) form.append('tipo_doc', tipo_doc);
    return api.postFormData(`/polizas/${id}/documentos`, form);
  },

  async getUrlDocumento(poliza_id, doc_id) {
    return api.get(`/polizas/${poliza_id}/documentos/${doc_id}/url`);
  },

  async bandejaRenovaciones() {
    return api.get('/polizas/bandeja-renovaciones');
  },

  async getKpis() {
    return api.get('/polizas/kpis');
  },
};

window.polizasService = polizasService;
