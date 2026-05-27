/**
 * auth.service.js — Servicio de autenticación.
 * Depende de: api.js
 */

const authService = {

  async login(email, password) {
    const res = await fetch(`${window.API_BASE_URL || 'http://localhost:3000/api/v1'}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error?.message || 'Credenciales incorrectas');
    }

    const { accessToken, refreshToken, user } = json.data;
    api.saveTokens(accessToken, refreshToken);
    sessionStorage.setItem('user', JSON.stringify(user));
    return user;
  },

  async logout() {
    try {
      const refreshToken = api.getRefreshToken();
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch { /* ignora errores de red en logout */ }
    api.clearTokens();
    window.location.href = '/index.html';
  },

  async getMe() {
    return api.get('/auth/me');
  },

  getUser() {
    const raw = sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  },

  isAuthenticated() {
    return !!api.getToken();
  },

  hasRole(role) {
    const user = this.getUser();
    return user?.roles?.includes(role) ?? false;
  },

  hasAnyRole(...roles) {
    const user = this.getUser();
    return roles.some(r => user?.roles?.includes(r));
  },
};

window.authService = authService;
