/**
 * sidebar.js — Componente de navegación compartido.
 * Inyecta el sidebar en #sidebar-placeholder y marca el enlace activo
 * según window.location.pathname.
 *
 * Visibilidad por rol (Bf-04): los roles operativos (admin/supervisor/operador/
 * cabina) ven todo; los roles comerciales puros (agente/promotor, sin rol
 * operativo) ven solo Dashboard + la sección Promotoría. El scoping de datos lo
 * hace el API; aquí solo se ocultan enlaces.
 *
 * Nota: auth.guard.js puebla #user-name, #user-role y #btn-logout.
 */

(function () {
  const OPERATIVOS = ['admin', 'supervisor', 'operador', 'cabina'];
  // Roles con acceso comercial (el API hace el scoping). Excluye cabina y
  // abogado: el backend les devuelve 403, así que tampoco ven los enlaces.
  const COMERCIAL = ['admin', 'supervisor', 'operador', 'agente', 'promotor'];

  // [href, etiqueta, grupo, rolesPermitidos?] — sin rolesPermitidos = visible a todos
  const NAV_LINKS = [
    ['/dashboard.html',                    '📊 Dashboard',          'operacion'],
    ['/bandeja.html',                      '📋 Bandeja de casos',   'operacion',  OPERATIVOS],
    ['/nuevo-caso.html',                   '➕ Nuevo caso',         'operacion',  OPERATIVOS],

    ['/comercial/pipeline.html',           '🗂️ Pipeline',          'promotoria', COMERCIAL],
    ['/comercial/clientes.html',           '🧑‍💼 Clientes',         'promotoria', COMERCIAL],
    ['/comercial/polizas.html',            '📑 Pólizas',            'promotoria', COMERCIAL],
    ['/comercial/renovaciones.html',       '🔁 Renovaciones',       'promotoria', COMERCIAL],
    ['/comercial/agentes.html',            '🎫 Agentes',            'promotoria', ['admin', 'supervisor', 'promotor']],

    ['/usuarios/lista.html',               '👥 Usuarios',           'gestion',    OPERATIVOS],
    ['/catalogos/proveedores.html',        '⚖️ Proveedores',       'gestion',    OPERATIVOS],
    ['/catalogos/empresas.html',           '🏢 Empresas',           'gestion',    OPERATIVOS],
    ['/catalogos/tipos-asistencia.html',   '🗂️ Tipos de servicio', 'gestion',    OPERATIVOS],
  ];

  function getRoles() {
    try {
      const u = JSON.parse(sessionStorage.getItem('user') || 'null');
      return Array.isArray(u?.roles) ? u.roles : [];
    } catch { return []; }
  }
  const roles = getRoles();

  function visible(permitidos) {
    return !permitidos || permitidos.some(r => roles.includes(r));
  }

  function esActivo(href) {
    const path = window.location.pathname;
    return path === href || path.endsWith(href);
  }

  // Enlaces visibles de un grupo (hrefs/labels son estáticos hardcodeados).
  function renderLinks(grupo) {
    return NAV_LINKS
      .filter(([, , g, perm]) => g === grupo && visible(perm))
      .map(([href, label]) => {
        const activo = esActivo(href) ? ' active' : '';
        return `<a href="${href}" class="nav-link${activo}">${label}</a>`;
      })
      .join('\n        ');
  }

  // Una sección solo se dibuja si tiene enlaces visibles.
  function renderSeccion(titulo, grupo) {
    const links = renderLinks(grupo);
    if (!links.trim()) return '';
    return `
      <div class="nav-section">
        <div class="nav-title">${titulo}</div>
        ${links}
      </div>`;
  }

  const html = `
    <div class="brand-kicker">Kogu · Asistencias</div>
    <div class="brand-title">Asistencia<br>Legal</div>
    <p class="brand-text">Plataforma de gestión de asistencias derivadas de siniestros automotrices.</p>
    <nav>
      ${renderSeccion('Operación',  'operacion')}
      ${renderSeccion('Promotoría', 'promotoria')}
      ${renderSeccion('Gestión',    'gestion')}
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

  const placeholder = document.getElementById('sidebar-placeholder');
  if (placeholder) {
    placeholder.innerHTML = html; // estático: NAV_LINKS y textos hardcodeados (user-name/role los llena auth.guard via textContent)
  }
})();
