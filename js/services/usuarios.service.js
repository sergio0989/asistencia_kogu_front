'use strict';
/**
 * usuarios.service.js — CRUD de usuarios del sistema.
 * Depende de: api.js
 */

const usuariosService = {

  async listar(filtros = {}) {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') params.append(k, v);
    });
    const qs = params.toString();
    return api.get(`/usuarios${qs ? '?' + qs : ''}`);
  },

  async obtener(id) {
    return api.get(`/usuarios/${id}`);
  },

  async crear(data) {
    return api.post('/usuarios', data);
  },

  async actualizar(id, data) {
    return api.patch(`/usuarios/${id}`, data);
  },

  async resetPassword(id, password_nueva) {
    return api.post(`/usuarios/${id}/reset-password`, { password_nueva });
  },

  async cambiarPasswordPropia(password_actual, password_nueva) {
    return api.post('/usuarios/me/password', { password_actual, password_nueva });
  },
};

window.usuariosService = usuariosService;
