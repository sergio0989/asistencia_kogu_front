/**
 * sidebar.js — Componente de navegación compartido.
 * Inyecta el sidebar en #sidebar-placeholder y marca el enlace activo
 * según window.location.pathname.
 *
 * Visibilidad por rol: cada enlace lleva EXACTAMENTE los roles que el backend
 * admite en el GET de esa pantalla (Bf-10, matriz §1). El scoping de datos lo
 * sigue haciendo el API; aquí solo se ocultan enlaces que darían 403.
 *
 * Las listas salen de `permisos.MATRIZ` para no volver a tener dos copias que
 * se desincronizan — que es justo lo que pasaba: `OPERATIVOS` dejaba fuera al
 * abogado (se quedaba sin ninguna pantalla) y a la vez ofrecía Usuarios al
 * operador y a cabina, que reciben 403.
 *
 * Nota: auth.guard.js puebla #user-name, #user-role y #btn-logout.
 */

(function () {
  const M = window.permisos?.MATRIZ || {};

  // [href, etiqueta, grupo, rolesPermitidos?] — sin rolesPermitidos = visible a todos
  const NAV_LINKS = [
    // El Dashboard operativo consume /asistencias/kpis y /proveedores.
    ['/dashboard.html',                    '📊 Dashboard',          'operacion',  M.asistenciasKpis],
    // El abogado SÍ lista expedientes (ve los de su proveedor)…
    ['/bandeja.html',                      '📋 Bandeja de casos',   'operacion',  M.asistenciasVer],
    // …pero no puede crearlos.
    ['/nuevo-caso.html',                   '➕ Nuevo caso',         'operacion',  M.asistenciasCrear],

    ['/comercial/dashboard.html',          '📈 Panel comercial',    'promotoria', M.comercialVer],
    ['/comercial/pipeline.html',           '🗂️ Pipeline',          'promotoria', M.comercialVer],
    ['/comercial/clientes.html',           '🧑‍💼 Clientes',         'promotoria', M.comercialVer],
    ['/comercial/polizas.html',            '📑 Pólizas',            'promotoria', M.comercialVer],
    ['/comercial/renovaciones.html',       '🔁 Renovaciones',       'promotoria', M.comercialVer],
    // B2-07: el agente lista su propio equipo, así que también ve la pantalla.
    ['/comercial/agentes.html',            '🎫 Agentes',            'promotoria', M.agentesVer],

    ['/usuarios/lista.html',               '👥 Usuarios',           'gestion',    M.usuariosVer],
    ['/catalogos/proveedores.html',        '⚖️ Proveedores',       'gestion',    M.proveedoresVer],
    ['/catalogos/empresas.html',           '🏢 Empresas',           'gestion',    M.catalogosVer],
    ['/catalogos/tipos-asistencia.html',   '🗂️ Tipos de servicio', 'gestion',    M.tiposVer],
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
