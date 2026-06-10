/**
 * auth.guard.js — Protege todas las páginas excepto el login.
 * Incluir en TODAS las páginas excepto index.html.
 *
 * Si no hay token: redirige a /index.html
 * Si hay token:    inyecta el nombre del usuario en el header
 */

(function () {
  const token = sessionStorage.getItem('access_token');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  // Inyectar nombre del usuario en el header cuando el DOM esté listo
  document.addEventListener('DOMContentLoaded', () => {
    const raw  = sessionStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;

    // Nombre en el header
    const nameEl = document.getElementById('user-name');
    if (nameEl && user) nameEl.textContent = user.nombre || user.email;

    // Rol
    const roleEl = document.getElementById('user-role');
    if (roleEl && user?.roles?.[0]) {
      const roleLabels = {
        admin:      'Administrador',
        supervisor: 'Supervisor',
        operador:   'Operador',
        cabina:     'Cabina',
        abogado:    'Abogado',
        promotor:   'Promotor',
        agente:     'Agente',
      };
      roleEl.textContent = roleLabels[user.roles[0]] || user.roles[0];
    }

    // Botón de logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.authService) {
          authService.logout();
        } else {
          sessionStorage.clear();
          window.location.href = '/index.html';
        }
      });
    }

    // Avatar con inicial
    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl && user?.nombre) {
      avatarEl.textContent = user.nombre.charAt(0).toUpperCase();
    }
  });
})();
