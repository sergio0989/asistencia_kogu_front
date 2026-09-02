'use strict';
/**
 * picker.js — Modal de búsqueda reutilizable (Bf-07).
 *
 * Reemplaza a los `<select>` que se llenaban descargando la tabla entera
 * (`limit: 500`), un patrón que rompía en silencio: el backend topa `limit` en
 * 100, respondía 422 y el `catch` vacío dejaba el select sin opciones y sin
 * error visible.
 *
 * Aquí la búsqueda es SIEMPRE contra el servidor, paginada de 20 en 20, y los
 * errores se pintan dentro del modal con un botón de reintento. Nunca se traga
 * una excepción.
 *
 * Uso directo:
 *   picker.open({
 *     titulo:      'Seleccionar cliente',
 *     placeholder: 'Nombre, RFC o teléfono…',
 *     buscar:      (q, page) => clientesService.listar({ buscar: q, page, limit: 20 }),
 *     item:        c => ({ id: c.id, titulo: c.nombre, sub: c.telefono }),
 *     onSelect:    c => { ... },
 *   });
 *
 * Atajo declarativo (input readonly + hidden + botón):
 *   picker.bind({ inputId:'p-cliente-label', hiddenId:'p-cliente', botonId:'p-cliente-btn', ...opciones });
 *
 * Depende de: modal.js (backdrop), format.js (fmt.esc).
 */

const picker = (() => {

  const MODAL_ID    = '_picker-modal';
  const DEBOUNCE_MS = 300;   // el `limit` lo fija cada `buscar` (20 por página)

  const st = {
    opts:     null,
    q:        '',
    page:     1,
    pages:    1,
    filas:    [],   // registros crudos, en orden de render
    activo:   -1,   // índice resaltado para ↑/↓ + Enter
    token:    0,    // secuenciación: solo la última búsqueda pinta (KA-F-13)
    timer:    null,
    cargando: false,
  };

  const $ = (id) => document.getElementById(id);

  // ─── DOM del modal (se crea una sola vez) ───────────────────────────────────
  function ensureDom() {
    let ov = $(MODAL_ID);
    if (ov) return ov;

    ov = document.createElement('div');
    ov.id        = MODAL_ID;
    ov.className = 'modal-backdrop';
    ov.style.display = 'none';
    // Por encima del modal que pueda estar abierto debajo (alta de póliza).
    ov.style.zIndex  = '1300';
    // estático: la estructura no interpola datos; título y placeholder se
    // asignan con textContent/setAttribute más abajo.
    ov.innerHTML = `
      <div class="modal-box picker-box" role="dialog" aria-modal="true" aria-labelledby="_picker-title">
        <div class="modal-header">
          <h3 class="modal-title" id="_picker-title"></h3>
          <button type="button" class="modal-close" id="_picker-close" aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal-body">
          <input type="text" id="_picker-input" class="form-control" autocomplete="off"
                 role="combobox" aria-expanded="true" aria-controls="_picker-list">
          <div id="_picker-list" class="picker-list" role="listbox" aria-label="Resultados"></div>
        </div>
      </div>`;
    document.body.appendChild(ov);

    $('_picker-close').addEventListener('click', cerrar);
    $('_picker-input').addEventListener('input', onInput);

    // Delegación: filas, "Cargar más" y "Reintentar".
    $('_picker-list').addEventListener('click', (e) => {
      const fila = e.target.closest('[data-idx]');
      if (fila) { elegir(parseInt(fila.dataset.idx, 10)); return; }
      if (e.target.closest('[data-accion="mas"]'))       { buscar(st.q, st.page + 1); return; }
      if (e.target.closest('[data-accion="reintentar"]')) { buscar(st.q, st.page); }
    });

    return ov;
  }

  // ─── Teclado ────────────────────────────────────────────────────────────────
  // En captura: el modal de abajo (abierto con modal.open) registra su propio
  // handler de Escape en `document`. Sin capturar y frenar la propagación, un
  // Esc dentro del picker cerraría también el formulario de atrás y se perdería
  // lo capturado.
  function onKeydown(e) {
    const ov = $(MODAL_ID);
    if (!ov || ov.style.display === 'none') return;

    if (e.key === 'Escape')    { e.stopPropagation(); cerrar(); return; }
    if (e.key === 'ArrowDown') { e.stopPropagation(); e.preventDefault(); mover(1);  return; }
    if (e.key === 'ArrowUp')   { e.stopPropagation(); e.preventDefault(); mover(-1); return; }
    if (e.key === 'Enter') {
      e.stopPropagation(); e.preventDefault();
      if (st.activo >= 0) elegir(st.activo);
    }
  }

  function mover(delta) {
    if (!st.filas.length) return;
    st.activo = Math.max(0, Math.min(st.filas.length - 1, st.activo + delta));
    marcarActivo();
  }

  function marcarActivo() {
    const cont = $('_picker-list');
    if (!cont) return;
    cont.querySelectorAll('[data-idx]').forEach((el) => {
      const on = parseInt(el.dataset.idx, 10) === st.activo;
      el.classList.toggle('picker-item--activo', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) el.scrollIntoView({ block: 'nearest' });
    });
  }

  // ─── Búsqueda ───────────────────────────────────────────────────────────────
  function onInput(e) {
    const q = e.target.value.trim();
    clearTimeout(st.timer);
    st.timer = setTimeout(() => buscar(q, 1), DEBOUNCE_MS);
  }

  async function buscar(q, page) {
    const cont = $('_picker-list');
    if (!cont || !st.opts) return;

    st.q = q;
    st.page = page;
    st.cargando = true;

    // Cada búsqueda lleva token: si vuelve una respuesta que ya no es la
    // última (el usuario siguió tecleando), se descarta en vez de pintarla.
    const miToken = ++st.token;

    if (page === 1) pintarEstado('Buscando…');

    try {
      const res  = await st.opts.buscar(q, page);
      if (miToken !== st.token) return;   // llegó tarde: la descartamos

      const rows = res?.data || [];
      const meta = res?.meta || { page, pages: 1 };
      st.pages   = meta.pages || 1;
      st.filas   = page === 1 ? rows : st.filas.concat(rows);
      st.activo  = st.filas.length ? 0 : -1;
      render();
    } catch (err) {
      if (miToken !== st.token) return;
      // El bug que originó Bf-07 fue un error tragado: aquí se ve siempre.
      console.error('picker: error al buscar', err);
      pintarError(err?.message || 'No se pudo completar la búsqueda.');
    } finally {
      if (miToken === st.token) st.cargando = false;
    }
  }

  function pintarEstado(texto) {
    // estático salvo `texto`, que se escapa.
    $('_picker-list').innerHTML =
      `<div class="picker-msg">${fmt.esc(texto)}</div>`;
  }

  function pintarError(mensaje) {
    $('_picker-list').innerHTML = `
      <div class="picker-msg picker-msg--error">
        <div>${fmt.esc(mensaje)}</div>
        <button type="button" class="btn btn-ghost btn-sm" data-accion="reintentar"
                style="margin-top:8px">Reintentar</button>
      </div>`;
  }

  function render() {
    const cont = $('_picker-list');

    if (!st.filas.length) {
      cont.innerHTML = st.q
        ? `<div class="picker-msg">Sin resultados para «${fmt.esc(st.q)}»</div>`
        : `<div class="picker-msg">${fmt.esc(st.opts.vacio || 'Escribe para buscar.')}</div>`;
      return;
    }

    const filas = st.filas.map((row, i) => {
      const it = st.opts.item(row) || {};
      return `
        <div class="picker-item" role="option" aria-selected="false" data-idx="${i}">
          <div class="picker-item__t">${fmt.esc(it.titulo ?? '')}</div>
          ${it.sub ? `<div class="picker-item__s">${fmt.esc(it.sub)}</div>` : ''}
        </div>`;
    }).join('');

    const mas = st.page < st.pages
      ? `<button type="button" class="btn btn-ghost btn-sm picker-mas" data-accion="mas">
           Cargar más (${fmt.esc(st.page)} de ${fmt.esc(st.pages)})
         </button>`
      : '';

    cont.innerHTML = filas + mas;
    marcarActivo();
  }

  function elegir(idx) {
    const row = st.filas[idx];
    if (!row) return;
    const onSelect = st.opts.onSelect;
    cerrar();
    if (onSelect) onSelect(row);
  }

  // ─── Abrir / cerrar ─────────────────────────────────────────────────────────
  function open(opts) {
    if (typeof opts?.buscar !== 'function' || typeof opts?.item !== 'function') {
      console.error('picker.open requiere `buscar` e `item`');
      return;
    }
    ensureDom();

    st.opts   = opts;
    st.q      = '';
    st.page   = 1;
    st.pages  = 1;
    st.filas  = [];
    st.activo = -1;
    st.token++;                       // invalida respuestas de una apertura previa
    clearTimeout(st.timer);

    $('_picker-title').textContent = opts.titulo || 'Seleccionar';
    const input = $('_picker-input');
    input.value = '';
    input.setAttribute('placeholder', opts.placeholder || 'Buscar…');

    document.addEventListener('keydown', onKeydown, true);
    modal.open(MODAL_ID);
    input.focus();

    // Primera página sin término: da contexto en vez de un modal en blanco.
    buscar('', 1);
  }

  function cerrar() {
    clearTimeout(st.timer);
    st.token++;                       // descarta lo que esté en vuelo
    document.removeEventListener('keydown', onKeydown, true);
    modal.close(MODAL_ID);

    // modal.close libera el scroll del body; si quedó un modal abierto detrás
    // (el alta de póliza, p. ej.) hay que volver a bloquearlo.
    const otroAbierto = Array.from(document.querySelectorAll('.modal-backdrop'))
      .some((el) => el.id !== MODAL_ID && el.style.display !== 'none');
    if (otroAbierto) document.body.style.overflow = 'hidden';
  }

  // ─── Atajo declarativo ──────────────────────────────────────────────────────
  /**
   * Enlaza un trío input readonly + hidden + botón. El hidden guarda el id y
   * dispara `change`, para que los listeners existentes de los filtros sigan
   * funcionando sin tocarlos.
   *
   * Opcional: `limpiarId` (botón que borra la selección) y `etiqueta(row)`
   * para el texto que se muestra (por defecto, el `titulo` de `item`).
   */
  function bind({ inputId, hiddenId, botonId, limpiarId, etiqueta, onSelect, ...opciones }) {
    const input  = $(inputId);
    const hidden = $(hiddenId);
    const boton  = $(botonId);
    if (!input || !hidden) {
      console.error(`picker.bind: falta #${inputId} o #${hiddenId}`);
      return null;
    }

    input.readOnly = true;
    if (!input.placeholder) input.placeholder = opciones.placeholder || 'Buscar…';

    const abrir = () => open({
      ...opciones,
      onSelect: (row) => {
        const it = opciones.item(row) || {};
        hidden.value = it.id ?? '';
        input.value  = etiqueta ? etiqueta(row) : (it.titulo ?? '');
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
        if (onSelect) onSelect(row);
      },
    });

    // Solo click y teclado: enganchar también `focus` abría el modal dos veces
    // (en un input readonly el foco precede al click).
    input.addEventListener('click', abrir);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
    });
    if (boton) boton.addEventListener('click', abrir);

    const limpiar = () => {
      hidden.value = '';
      input.value  = '';
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    };
    if (limpiarId) $(limpiarId)?.addEventListener('click', limpiar);

    // Handle para que la página pueda prellenar o limpiar por código.
    return {
      abrir,
      limpiar,
      set(id, label) {
        hidden.value = id ?? '';
        input.value  = label ?? '';
      },
      habilitar(on) {
        input.disabled = !on;
        if (boton) boton.disabled = !on;
      },
    };
  }

  return { open, bind, cerrar };
})();

window.picker = picker;
