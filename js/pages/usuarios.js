'use strict';
/**
 * usuarios.js — Gestión completa de usuarios del sistema.
 * Depende de: api.js, usuarios.service.js, catalogos.service.js, fmt, toast, modal, table
 */

const state = { page: 1, limit: 15, filtros: {}, editandoId: null, resetUserId: null };

// KA-F-08: crear, editar, restablecer contraseña y activar/desactivar son
// admin-only en el backend. El supervisor llega a esta pantalla (GET /usuarios
// es admin/supervisor) y hasta ahora veía los cuatro botones, que fallaban
// siempre con 403. Conserva la lectura; las acciones no se le muestran.
const PUEDE_ESCRIBIR = permisos.puedeAccion('usuariosEscribir');

// KA-F-01: el markup traía las casillas de rol escritas a mano y le faltaban
// `promotor` y `agente`. Como al guardar el backend REEMPLAZA el conjunto
// completo de roles, editarle el teléfono a un ['operador','promotor'] lo
// dejaba en ['operador'] — perdía la promotoría sin que nadie se enterara. Y si
// solo tenía 'promotor', el front exigía "al menos un rol" y quedaba ineditable.
// La fuente de verdad pasa a ser GET /catalogos/roles.
//
// Reserva por si el catálogo no se puede leer: la página es visible para
// supervisor/operador, pero /catalogos/roles es admin-only y les responde 403.
// Incluye los siete roles, así que el fallo original no vuelve ni en ese caso.
const ROLES_RESERVA = [
  { clave: 'admin',      nombre: 'Administrador' },
  { clave: 'supervisor', nombre: 'Supervisor' },
  { clave: 'operador',   nombre: 'Operador' },
  { clave: 'abogado',    nombre: 'Abogado' },
  { clave: 'cabina',     nombre: 'Cabina' },
  { clave: 'promotor',   nombre: 'Promotor' },
  { clave: 'agente',     nombre: 'Agente' },
];

document.addEventListener('DOMContentLoaded', async () => {
  await cargarRoles();
  await cargarUsuarios();

  // Filtros con debounce
  let timer;
  document.getElementById('filtro-buscar')?.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.filtros.buscar = e.target.value.trim(); state.page = 1; cargarUsuarios(); }, 350);
  });
  document.getElementById('filtro-rol')?.addEventListener('change', e => {
    state.filtros.rol = e.target.value; state.page = 1; cargarUsuarios();
  });
  document.getElementById('filtro-activo')?.addEventListener('change', e => {
    state.filtros.activo = e.target.value; state.page = 1; cargarUsuarios();
  });
  document.getElementById('btn-limpiar')?.addEventListener('click', limpiarFiltros);
  const btnNuevo = document.getElementById('btn-nuevo-usuario');
  if (PUEDE_ESCRIBIR) btnNuevo?.addEventListener('click', abrirModalCrear);
  else if (btnNuevo) btnNuevo.style.display = 'none';
  document.getElementById('btn-guardar-usuario')?.addEventListener('click', guardarUsuario);
  document.getElementById('btn-confirmar-reset')?.addEventListener('click', confirmarReset);
});

// ─── Cargar lista ─────────────────────────────────────────────────────────────
async function cargarUsuarios() {
  table.showSkeleton('#tabla-usuarios-body', 7, 8);
  try {
    const result = await usuariosService.listar({
      ...state.filtros, page: state.page, limit: state.limit,
    });
    const rows = result?.data || [];
    const meta = result?.meta || { total: rows.length, page: 1, limit: state.limit, pages: 1 };

    renderFilas(rows);
    document.getElementById('contador-usuarios').textContent =
      `${meta.total} usuario${meta.total !== 1 ? 's' : ''}`;
    table.renderPagination('#paginacion', meta, p => { state.page = p; cargarUsuarios(); });
  } catch (err) {
    toast.error('Error al cargar usuarios');
    console.error(err);
  }
}

// ─── Renderizar filas ─────────────────────────────────────────────────────────
function renderFilas(rows) {
  const tbody = document.querySelector('#tabla-usuarios-body');
  if (!tbody) return;
  if (!rows.length) {
    // estático: estado vacío
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8">
      No se encontraron usuarios con los filtros seleccionados.</td></tr>`;
    return;
  }
  // u.id: UUID propio → tal cual en onclick. Demás datos de API escapados.
  tbody.innerHTML = rows.map(u => {
    const rolesHtml = (u.roles || []).map(r => `<span class="role-chip role-${fmt.esc(r)}">${fmt.esc(r)}</span>`).join(' ');
    const estado    = u.activo
      ? '<span><span class="status-dot dot-active"></span>Activo</span>'
      : '<span style="color:#94a3b8"><span class="status-dot dot-inactive"></span>Inactivo</span>';
    const inicial   = (u.nombre || '?').charAt(0).toUpperCase();
    // El nombre va también dentro de un string JS en onclick: primero se escapa
    // para JS (comilla simple) y luego para HTML (fmt.esc) por el doble contexto.
    const nombreJs  = fmt.esc(String(u.nombre ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
    return `
      <tr data-id="${fmt.esc(u.id)}">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="user-avatar">${fmt.esc(inicial)}</div>
            <strong>${fmt.esc(u.nombre)}</strong>
          </div>
        </td>
        <td style="color:#475569">${fmt.esc(u.email)}</td>
        <td style="color:#475569">${u.telefono ? fmt.esc(fmt.telefono(u.telefono)) : '—'}</td>
        <td>${rolesHtml || '—'}</td>
        <td>${estado}</td>
        <td style="color:#94a3b8;font-size:12px">${fmt.fecha(u.created_at)}</td>
        <td style="text-align:center">
          ${PUEDE_ESCRIBIR ? `<div style="display:flex;gap:6px;justify-content:center">
            <button class="btn btn-ghost btn-sm" onclick="abrirModalEditar('${u.id}')" title="Editar">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="abrirModalReset('${u.id}','${nombreJs}')  " title="Restablecer contraseña">🔑</button>
            <button class="btn btn-ghost btn-sm" onclick="toggleActivo('${u.id}',${u.activo})" title="${u.activo ? 'Desactivar' : 'Activar'}">
              ${u.activo ? '🔴' : '🟢'}
            </button>
          </div>` : '<span style="color:#cbd5e1">—</span>'}
        </td>
      </tr>`;
  }).join('');
}

// ─── Abrir modal crear ────────────────────────────────────────────────────────
function abrirModalCrear() {
  state.editandoId = null;
  limpiarForm();
  document.getElementById('modal-usuario-titulo').textContent = 'Nuevo usuario';
  document.getElementById('grupo-password').style.display = 'block';
  document.getElementById('grupo-activo').style.display   = 'none';
  document.getElementById('u-password').required = true;
  modal.open('modal-usuario');
}

// ─── Abrir modal editar ───────────────────────────────────────────────────────
async function abrirModalEditar(id) {
  try {
    const u = await usuariosService.obtener(id);
    state.editandoId = id;
    document.getElementById('modal-usuario-titulo').textContent = 'Editar usuario';
    document.getElementById('u-nombre').value   = u.nombre   || '';
    document.getElementById('u-email').value    = u.email    || '';
    document.getElementById('u-telefono').value = u.telefono || '';
    document.getElementById('u-email').disabled = true;   // no se puede cambiar email
    document.getElementById('grupo-password').style.display = 'none';
    document.getElementById('grupo-activo').style.display   = 'block';
    document.getElementById('u-activo').checked = u.activo;
    document.getElementById('u-password').required = false;

    // Marcar roles actuales
    document.querySelectorAll('#roles-checkboxes input[type=checkbox]').forEach(cb => {
      cb.checked = (u.roles || []).includes(cb.value);
    });
    modal.open('modal-usuario');
  } catch (err) {
    toast.error('Error al cargar el usuario');
  }
}

// ─── Guardar (crear o editar) ─────────────────────────────────────────────────
async function guardarUsuario() {
  const nombre   = document.getElementById('u-nombre').value.trim();
  const email    = document.getElementById('u-email').value.trim();
  const telefono = document.getElementById('u-telefono').value.trim();
  const password = document.getElementById('u-password').value;
  const activo   = document.getElementById('u-activo')?.checked;
  const roles    = [...document.querySelectorAll('#roles-checkboxes input:checked')].map(cb => cb.value);

  if (!nombre || !email) { toast.warning('Nombre y email son obligatorios'); return; }
  if (!roles.length)      { toast.warning('Selecciona al menos un rol'); return; }
  if (!state.editandoId && !password) { toast.warning('La contraseña es obligatoria'); return; }

  const btn = document.getElementById('btn-guardar-usuario');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    if (state.editandoId) {
      const data = { nombre, telefono: telefono || null, roles, activo };
      await usuariosService.actualizar(state.editandoId, data);
      toast.success('Usuario actualizado');
    } else {
      await usuariosService.crear({ nombre, email, telefono: telefono || undefined, password, roles });
      toast.success('Usuario creado correctamente');
    }
    modal.close('modal-usuario');
    limpiarForm();
    await cargarUsuarios();
  } catch (err) {
    toast.error(err.message || 'Error al guardar el usuario');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

// ─── Reset de contraseña ──────────────────────────────────────────────────────
function abrirModalReset(id, nombre) {
  state.resetUserId = id;
  document.getElementById('reset-user-nombre').textContent = nombre;
  document.getElementById('reset-password').value = '';
  modal.open('modal-reset-password');
}

async function confirmarReset() {
  const pass = document.getElementById('reset-password').value;
  if (!pass || pass.length < 8) { toast.warning('La contraseña debe tener al menos 8 caracteres'); return; }
  try {
    await usuariosService.resetPassword(state.resetUserId, pass);
    toast.success('Contraseña restablecida correctamente');
    modal.close('modal-reset-password');
  } catch (err) {
    toast.error(err.message || 'Error al restablecer contraseña');
  }
}

// ─── Activar / Desactivar ─────────────────────────────────────────────────────
async function toggleActivo(id, activo) {
  const accion = activo ? 'desactivar' : 'activar';
  modal.confirm(`¿Deseas ${accion} este usuario?`, async () => {
    try {
      await usuariosService.actualizar(id, { activo: !activo });
      toast.success(`Usuario ${accion === 'activar' ? 'activado' : 'desactivado'}`);
      await cargarUsuarios();
    } catch (err) {
      toast.error(err.message || 'Error al actualizar el usuario');
    }
  }, { danger: activo });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function limpiarFiltros() {
  state.filtros = {}; state.page = 1;
  ['filtro-buscar','filtro-rol','filtro-activo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  cargarUsuarios();
}

// ─── Catálogo de roles ────────────────────────────────────────────────────────
async function cargarRoles() {
  let roles;
  try {
    roles = await catalogosService.getRoles();
  } catch (err) {
    // 403 es esperable para supervisor/operador: se cae a la reserva sin ruido.
    console.error('No se pudo cargar el catálogo de roles', err);
    if (err?.status !== 403) toast.error('No se pudo cargar el catálogo de roles');
  }
  if (!Array.isArray(roles) || !roles.length) roles = ROLES_RESERVA;

  const etiqueta = (r) => r.nombre || r.clave;

  // Filtro del listado
  const filtro = document.getElementById('filtro-rol');
  if (filtro) {
    filtro.innerHTML = '<option value="">Todos los roles</option>' +
      roles.map(r => `<option value="${fmt.esc(r.clave)}">${fmt.esc(etiqueta(r))}</option>`).join('');
  }

  // Casillas del modal de alta/edición
  const cont = document.getElementById('roles-checkboxes');
  if (cont) {
    cont.innerHTML = roles.map(r => `
      <label class="checkbox-item">
        <input type="checkbox" name="roles" value="${fmt.esc(r.clave)}"> ${fmt.esc(etiqueta(r))}
      </label>`).join('');
  }
}

function limpiarForm() {
  ['u-nombre','u-email','u-telefono','u-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.disabled = false; }
  });
  document.querySelectorAll('#roles-checkboxes input').forEach(cb => cb.checked = false);
}

window.abrirModalEditar = abrirModalEditar;
window.abrirModalReset  = abrirModalReset;
window.toggleActivo     = toggleActivo;
