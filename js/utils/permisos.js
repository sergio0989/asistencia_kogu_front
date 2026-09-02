'use strict';
/**
 * permisos.js — Qué puede hacer el usuario de la sesión (Bf-10).
 *
 * El front decidía qué mostrar con listas de roles escritas a mano en cada
 * pantalla, y esas listas no coincidían con lo que el backend permite. Salía mal
 * de las dos formas posibles: botones ofrecidos a quien recibe 403, y
 * funcionalidad escondida a quien sí tiene permiso (el rol `abogado` no llegaba
 * a ninguna pantalla).
 *
 * Aquí vive una sola copia de la matriz, derivada de las rutas del backend. El
 * criterio es: si el backend lo va a rechazar con 403, no se muestra. Un botón
 * que siempre falla es peor que un botón ausente.
 *
 * Esto es presentación, no seguridad: quien manda sigue siendo el API. Sirve
 * para no ofrecer lo que se va a negar.
 *
 * Depende de: nada (lee sessionStorage directamente, como sidebar.js).
 */

const permisos = (() => {

  // ── Matriz, tal como está en las rutas del backend ────────────────────────
  const M = {
    // Expedientes
    asistenciasVer:        ['admin', 'supervisor', 'operador', 'abogado', 'cabina'],
    asistenciasCrear:      ['admin', 'supervisor', 'operador', 'cabina'],
    asistenciasEditar:     ['admin', 'supervisor', 'operador'],
    asistenciasEstatus:    ['admin', 'supervisor', 'operador'],
    asistenciasAsignar:    ['admin', 'supervisor'],
    asistenciasCerrar:     ['admin', 'supervisor'],
    asistenciasComentar:   ['admin', 'supervisor', 'operador', 'abogado'],
    asistenciasKpis:       ['admin', 'supervisor', 'operador'],

    // Usuarios
    usuariosVer:           ['admin', 'supervisor'],
    usuariosEscribir:      ['admin'],

    // Proveedores
    proveedoresVer:        ['admin', 'supervisor', 'operador'],
    proveedoresEscribir:   ['admin', 'supervisor'],

    // Empresas (mismo criterio que proveedores)
    catalogosVer:          ['admin', 'supervisor', 'operador'],
    catalogosEscribir:     ['admin', 'supervisor'],

    // Tipos de servicio: la pantalla se apoya en /subtipos/admin y
    // /formularios/admin (admin+supervisor), y TODA su escritura —tipos y
    // subtipos— es admin-only. Por eso no comparte los roles de empresas.
    tiposVer:              ['admin', 'supervisor'],
    tiposEscribir:         ['admin'],

    // Promotoría
    agentesVer:            ['admin', 'supervisor', 'promotor', 'agente'],
    agentesEscribir:       ['admin', 'supervisor'],
    comercialVer:          ['admin', 'supervisor', 'operador', 'agente', 'promotor'],
  };

  function rolesUsuario() {
    try {
      const u = JSON.parse(sessionStorage.getItem('user') || 'null');
      return Array.isArray(u?.roles) ? u.roles : [];
    } catch { return []; }
  }

  /** ¿El usuario tiene alguno de estos roles? */
  function puede(...roles) {
    const propios = rolesUsuario();
    const pedidos = roles.flat();
    return pedidos.some((r) => propios.includes(r));
  }

  /** Igual que `puede`, pero por nombre de acción de la matriz. */
  function puedeAccion(accion) {
    const roles = M[accion];
    if (!roles) {
      console.error(`permisos: acción desconocida "${accion}"`);
      return false;
    }
    return puede(roles);
  }

  /**
   * Oculta los elementos indicados si el usuario no tiene la acción.
   * Se usa para no repetir el mismo `if (…) el.style.display='none'`.
   */
  function ocultarSiNoPuede(accion, ...ids) {
    if (puedeAccion(accion)) return;
    ids.flat().forEach((id) => {
      const el = typeof id === 'string' ? document.getElementById(id) : id;
      if (el) el.style.display = 'none';
    });
  }

  return { puede, puedeAccion, ocultarSiNoPuede, roles: rolesUsuario, MATRIZ: M };
})();

window.permisos = permisos;
