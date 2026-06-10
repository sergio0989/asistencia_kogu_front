'use strict';
/**
 * auth.js — Lógica del login (index.html)
 * Depende de: api.js, auth.service.js, toast.js
 */

document.addEventListener('DOMContentLoaded', () => {

  // Si ya está autenticado, redirigir directo al dashboard
  if (sessionStorage.getItem('access_token')) {
    window.location.href = '/dashboard.html';
    return;
  }

  // ── Selector de ambiente ───────────────────────────────────────────────────
  const selectAmbiente = document.getElementById('select-ambiente');
  const ambienteUrlEl  = document.getElementById('ambiente-url');

  if (selectAmbiente && window.AMBIENTES) {
    // estático: window.AMBIENTES es config local (config.js), no dato de API.
    // Aun así se escapan clave/label por robustez ante cambios de config.
    selectAmbiente.innerHTML = Object.entries(window.AMBIENTES)
      .map(([clave, cfg]) =>
        `<option value="${fmt.esc(clave)}" ${clave === window.AMBIENTE_ACTIVO ? 'selected' : ''}>${fmt.esc(cfg.label)}</option>`
      ).join('');

    // Mostrar URL actual
    const actualizarUrlPreview = () => {
      if (ambienteUrlEl) ambienteUrlEl.textContent = window.API_BASE_URL;
    };
    actualizarUrlPreview();

    // Cambio de ambiente
    selectAmbiente.addEventListener('change', () => {
      window.setAmbiente(selectAmbiente.value);
      actualizarUrlPreview();
    });
  }

  const form    = document.getElementById('login-form');
  const emailEl = document.getElementById('email');
  const passEl  = document.getElementById('password');
  const btnEl   = document.getElementById('btn-login');
  const errEl   = document.getElementById('login-error');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(true);
    hideError();

    const email    = emailEl.value.trim();
    const password = passEl.value;

    if (!email || !password) {
      showError('Ingresa tu correo y contraseña.');
      setLoading(false);
      return;
    }

    try {
      await authService.login(email, password);
      // Redirigir al dashboard
      window.location.href = '/dashboard.html';
    } catch (err) {
      showError(err.message || 'Credenciales incorrectas. Intenta de nuevo.');
      setLoading(false);
    }
  });

  // Enter en el campo de password
  passEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') form.dispatchEvent(new Event('submit'));
  });

  function setLoading(loading) {
    if (!btnEl) return;
    btnEl.disabled = loading;
    // estático: dos textos fijos del botón
    btnEl.innerHTML = loading
      ? '<span style="opacity:.7">Ingresando…</span>'
      : 'Ingresar al sistema';
  }

  function showError(msg) {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }

  function hideError() {
    if (!errEl) return;
    errEl.textContent = '';
    errEl.style.display = 'none';
  }
});
