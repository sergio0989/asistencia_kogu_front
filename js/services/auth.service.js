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
    // El login no trae la ubicación comercial; /auth/me sí (B2-06).
    await this.cargarPerfilComercial();
    return this.getUser();
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

  // ── Ubicación comercial del usuario (Bf-07 §7.1 / backend B2-06) ──────────
  //
  // `GET /auth/me` devuelve agente_id, agente_padre_id y promotoria_id, que es
  // lo que decide qué pickers mostrar al dar de alta una póliza u oportunidad.
  // Ojo con la semántica: salen del ALCANCE comercial, no de la existencia de
  // fila en `agentes`. Un admin o supervisor CON fila los recibe en null, y un
  // promotor solo recibe promotoria_id. Sirven para esta decisión de UI, no
  // como "la ficha de agente del usuario".

  async cargarPerfilComercial() {
    try {
      const me = await api.get('/auth/me');
      const user = {
        ...(this.getUser() || {}),
        agente_id:       me?.agente_id ?? null,
        agente_padre_id: me?.agente_padre_id ?? null,
        promotoria_id:   me?.promotoria_id ?? null,
      };
      sessionStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (err) {
      // Sin perfil no se puede decidir la UI por rol: se avisa y se cae al
      // caso más restrictivo (ver `perfilComercial`).
      console.error('No se pudo cargar el perfil comercial (/auth/me)', err);
      return this.getUser();
    }
  },

  /** Igual que el anterior, pero sin volver a pedirlo si ya está en sesión. */
  async asegurarPerfilComercial() {
    const user = this.getUser();
    if (user && 'agente_id' in user) return user;
    return this.cargarPerfilComercial();
  },

  /**
   * 'subagente'   → agente_padre_id != null
   * 'agente_raiz' → agente_id != null y sin padre
   * 'elevado'     → ambos null: admin/supervisor/operador o promotor
   */
  perfilComercial() {
    const u = this.getUser() || {};
    if (u.agente_padre_id) return 'subagente';
    if (u.agente_id)       return 'agente_raiz';
    return 'elevado';
  },

  esSubagente()  { return this.perfilComercial() === 'subagente'; },
  esAgenteRaiz() { return this.perfilComercial() === 'agente_raiz'; },
  /** Solo los roles sin cartera propia eligen a qué agente se asigna. */
  puedeElegirAgente() { return this.perfilComercial() === 'elevado'; },

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
