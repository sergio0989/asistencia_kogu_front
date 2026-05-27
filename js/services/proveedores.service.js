'use strict';
/* global api */

const proveedoresService = (() => {

  // ─── Listado con filtros ─────────────────────────────────────────────────────
  // api.get desenvuelve json.data → recibimos { data: [...], meta: {...} }
  // Devolvemos el objeto completo para que el caller acceda a .data y .meta
  async function listar(params = {}) {
    const qs = new URLSearchParams();
    if (params.buscar)              qs.set('buscar', params.buscar);
    if (params.estatus_expediente)  qs.set('estatus_expediente', params.estatus_expediente);
    if (params.tipo_id)             qs.set('tipo_id', params.tipo_id);
    if (params.todos)               qs.set('todos', '1');
    if (params.page)                qs.set('page', params.page);
    if (params.limit)               qs.set('limit', params.limit);
    const q = qs.toString();
    return await api.get(`/proveedores${q ? '?' + q : ''}`);
  }

  // ─── Detalle completo ────────────────────────────────────────────────────────
  async function obtener(id) {
    return await api.get(`/proveedores/${id}`);
  }

  // ─── Crear ───────────────────────────────────────────────────────────────────
  async function crear(data) {
    return await api.post('/proveedores', data);
  }

  // ─── Actualizar generales ─────────────────────────────────────────────────────
  async function actualizar(id, data) {
    return await api.patch(`/proveedores/${id}`, data);
  }

  // ─── Sincronizar servicios ───────────────────────────────────────────────────
  async function sincronizarServicios(id, servicios) {
    return await api.put(`/proveedores/${id}/servicios`, { servicios });
  }

  // ─── Sincronizar zonas ───────────────────────────────────────────────────────
  async function sincronizarZonas(id, zonas) {
    return await api.put(`/proveedores/${id}/zonas`, { zonas });
  }

  // ─── Subir documento ─────────────────────────────────────────────────────────
  async function subirDocumento(id, formData) {
    return await api.postFormData(`/proveedores/${id}/documentos`, formData);
  }

  // ─── URL de documento ────────────────────────────────────────────────────────
  async function getUrlDocumento(provId, docId) {
    return await api.get(`/proveedores/${provId}/documentos/${docId}/url`);
  }

  return {
    listar, obtener, crear, actualizar,
    sincronizarServicios, sincronizarZonas,
    subirDocumento, getUrlDocumento,
  };
})();
