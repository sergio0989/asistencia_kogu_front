/**
 * sidebar.js — Componente de navegación compartido.
 * Inyecta el sidebar en #sidebar-placeholder y marca el enlace activo
 * según window.location.pathname.
 *
 * Uso en HTML:
 *   <aside class="sidebar" id="sidebar-placeholder"></aside>
 *   <script src="/js/components/sidebar.js"></script>
 *
 * Nota: auth.guard.js se encarga de poblar #user-name, #user-role y #btn-logout.
 */

(function () {
  const NAV_LINKS = [
    // [href, etiqueta, grupo]
    ['/dashboard.html',                    '📊 Dashboard',           'operacion'],
    ['/bandeja.html',                      '📋 Bandeja de casos',    'operacion'],
    ['/nuevo-caso.html',                   '➕ Nuevo caso',          'operacion'],
    ['/usuarios/lista.html',               '👥 Usuarios',            'gestion'],
    ['/catalogos/proveedores.html',        '⚖️ Proveedores',        'gestion'],
    ['/catalogos/empresas.html',           '🏢 Empresas',            'gestion'],
    ['/catalogos/tipos-asistencia.html',   '🗂️ Tipos de servicio', 'gestion'],
  ];

  function esActivo(href) {
    const path = window.location.pathname;
    // Coincidencia exacta o coincidencia de ruta sin el leading slash de distintos servidores
    return path === href || path.endsWith(href);
  }

  function renderLinks(grupo) {
    return NAV_LINKS
      .filter(([, , g]) => g === grupo)
      .map(([href, label]) => {
        const activo = esActivo(href) ? ' active' : '';
        return `<a href="${href}" class="nav-link${activo}">${label}</a>`;
      })
      .join('\n        ');
  }

  const html = `
    <div class="brand-kicker">Kogu · Asistencias</div>
    <div class="brand-title">Asistencia<br>Legal</div>
    <p class="brand-text">Plataforma de gestión de asistencias derivadas de siniestros automotrices.</p>
    <nav>
      <div class="nav-section">
        <div class="nav-title">Operación</div>
        ${renderLinks('operacion')}
      </div>
      <div class="nav-section">
        <div class="nav-title">Gestión</div>
        ${renderLinks('gestion')}
      </div>
      <div class="nav-section">
        <div class="nav-title">Cuenta</div>
        <a href="#" class="nav-link" id="btn-logout">🚪 Cerrar sesión</a>
      </div>
    </nav>
    <div class="context-card" style="margin-top:auto">
      <div class="label">Usuario</div>
      <div class="value" id="user-name">—</div>
      <div class="sub" id="user-role">—</div>
    </div>`;

  // Inyectar en el placeholder (el script se carga al final del body, el elemento ya existe)
  const placeholder = document.getElementById('sidebar-placeholder');
  if (placeholder) {
    placeholder.innerHTML = html;
  }
})();
