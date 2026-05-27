/**
 * api.js — Wrapper base para todas las llamadas al backend.
 *
 * - Agrega Authorization: Bearer automáticamente
 * - Si recibe 401, intenta renovar el token con /auth/refresh
 * - Si el refresh falla, redirige al login
 * - Expone: get, post, put, patch, del, postFormData
 */

const API_BASE = window.API_BASE_URL || 'http://localhost:3000/api/v1';

// ─── Helpers internos ─────────────────────────────────────────────────────────

function getToken() {
  return sessionStorage.getItem('access_token');
}

function getRefreshToken() {
  return sessionStorage.getItem('refresh_token');
}

function saveTokens(accessToken, refreshToken) {
  sessionStorage.setItem('access_token', accessToken);
  if (refreshToken) sessionStorage.setItem('refresh_token', refreshToken);
}

function clearTokens() {
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('refresh_token');
  sessionStorage.removeItem('user');
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.success && data.data?.accessToken) {
      saveTokens(data.data.accessToken, data.data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function redirectToLogin() {
  clearTokens();
  window.location.href = '/index.html';
}

// ─── Request base ─────────────────────────────────────────────────────────────

async function request(method, path, body = null, isFormData = false, retry = true) {
  const token = getToken();

  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch (err) {
    throw new ApiError('No se pudo conectar con el servidor. Verifica tu conexión.', 0, 'NETWORK_ERROR');
  }

  // Token expirado → intentar refresh una vez
  if (res.status === 401 && retry) {
    const renewed = await refreshAccessToken();
    if (renewed) return request(method, path, body, isFormData, false);
    redirectToLogin();
    return;
  }

  // Sin contenido
  if (res.status === 204) return null;

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg  = json?.error?.message || json?.message || `Error ${res.status}`;
    const code = json?.error?.code    || 'UNKNOWN_ERROR';
    throw new ApiError(msg, res.status, code, json?.error?.details);
  }

  // Respuestas paginadas: preservar { data, meta } completo
  // Respuestas simples: devolver solo json.data
  if (json?.data !== undefined && json?.meta !== undefined) return json;
  if (json?.data !== undefined) return json.data;
  return json;
}

// ─── Clase de error enriquecida ───────────────────────────────────────────────

class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name    = 'ApiError';
    this.status  = status;
    this.code    = code;
    this.details = details || [];
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

const api = {
  get:          (path)              => request('GET',    path),
  post:         (path, body)        => request('POST',   path, body),
  put:          (path, body)        => request('PUT',    path, body),
  patch:        (path, body)        => request('PATCH',  path, body),
  del:          (path)              => request('DELETE', path),
  postFormData: (path, formData)    => request('POST',   path, formData, true),

  // Helpers de token (para uso desde auth.service)
  getToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
  redirectToLogin,
  ApiError,
};

window.api = api;
