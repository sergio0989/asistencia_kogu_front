/**
 * clientes.service.js — Cartera de clientes (Promotoría P1).
 * Depende de: api.js
 */

const clientesService = {

  async listar(filtros = {}) {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') params.append(k, v);
    });
    const qs = params.toString();
    return api.get(`/clientes${qs ? '?' + qs : ''}`);
  },

  async obtener(id) {
    return api.get(`/clientes/${id}`);
  },

  async vista360(id) {
    return api.get(`/clientes/${id}/vista360`);
  },

  async crear(data) {
    return api.post('/clientes', data);
  },

  async actualizar(id, data) {
    return api.patch(`/clientes/${id}`, data);
  },

  async subirDocumento(id, file, tipo_doc = '') {
    const form = new FormData();
    form.append('archivo', file);
    if (tipo_doc) form.append('tipo_doc', tipo_doc);
    return api.postFormData(`/clientes/${id}/documentos`, form);
  },

  async getUrlDocumento(cliente_id, doc_id) {
    return api.get(`/clientes/${cliente_id}/documentos/${doc_id}/url`);
  },
};

window.clientesService = clientesService;
