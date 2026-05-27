/**
 * asistencias.service.js — Todas las operaciones sobre expedientes.
 * Depende de: api.js
 */

const asistenciasService = {

  // ─── Listado con filtros ────────────────────────────────────────────────────
  async listar(filtros = {}) {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') params.append(k, v);
    });
    const qs = params.toString();
    return api.get(`/asistencias${qs ? '?' + qs : ''}`);
  },

  // ─── Detalle completo ───────────────────────────────────────────────────────
  async obtener(id) {
    return api.get(`/asistencias/${id}`);
  },

  // ─── Crear expediente ───────────────────────────────────────────────────────
  async crear(data) {
    return api.post('/asistencias', data);
  },

  // ─── Actualizar campos ──────────────────────────────────────────────────────
  async actualizar(id, data) {
    return api.patch(`/asistencias/${id}`, data);
  },

  // ─── Cambiar estatus ────────────────────────────────────────────────────────
  async cambiarEstatus(id, estatus_operativo, comentario = '') {
    return api.post(`/asistencias/${id}/estatus`, { estatus_operativo, comentario });
  },

  // ─── Asignar abogado ────────────────────────────────────────────────────────
  async asignarAbogado(id, abogado_id) {
    return api.post(`/asistencias/${id}/abogado`, { abogado_id });
  },

  // ─── Cerrar expediente ──────────────────────────────────────────────────────
  async cerrar(id, { motivo_cierre_id, notas_cierre, resultado }) {
    return api.post(`/asistencias/${id}/cerrar`, { motivo_cierre_id, notas_cierre, resultado });
  },

  // ─── Agregar comentario ─────────────────────────────────────────────────────
  async agregarComentario(id, comentario) {
    return api.post(`/asistencias/${id}/comentario`, { comentario });
  },

  // ─── Subir documento ────────────────────────────────────────────────────────
  async subirDocumento(id, file, tipo_doc = '') {
    const form = new FormData();
    form.append('archivo', file);
    if (tipo_doc) form.append('tipo_doc', tipo_doc);
    return api.postFormData(`/asistencias/${id}/documentos`, form);
  },

  // ─── URL presignada de documento ────────────────────────────────────────────
  async getUrlDocumento(asistencia_id, doc_id) {
    return api.get(`/asistencias/${asistencia_id}/documentos/${doc_id}/url`);
  },

  // ─── Guardar respuestas del formulario dinámico ─────────────────────────────
  async guardarRespuestas(id, formulario_id, respuestas) {
    return api.put(`/asistencias/${id}/formularios/${formulario_id}`, respuestas);
  },

  // ─── KPIs ejecutivos ────────────────────────────────────────────────────────
  async getKpis() {
    return api.get('/asistencias/kpis');
  },
};

window.asistenciasService = asistenciasService;
