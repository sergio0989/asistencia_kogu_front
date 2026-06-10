/**
 * agentes.service.js — Agentes de la promotoría (P1, CRUD mínimo + documentos).
 * Depende de: api.js
 */

const agentesService = {

  async listar(filtros = {}) {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') params.append(k, v);
    });
    const qs = params.toString();
    return api.get(`/agentes${qs ? '?' + qs : ''}`);
  },

  async crear(data) {
    return api.post('/agentes', data);
  },

  async actualizar(id, data) {
    return api.patch(`/agentes/${id}`, data);
  },

  async getDocumentos(id) {
    return api.get(`/agentes/${id}/documentos`);
  },

  async subirDocumento(id, file, { tipo_doc = '', fecha_vencimiento = '' } = {}) {
    const form = new FormData();
    form.append('archivo', file);
    if (tipo_doc)          form.append('tipo_doc', tipo_doc);
    if (fecha_vencimiento) form.append('fecha_vencimiento', fecha_vencimiento);
    return api.postFormData(`/agentes/${id}/documentos`, form);
  },
};

window.agentesService = agentesService;
