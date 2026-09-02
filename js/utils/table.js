/**
 * table.js — Helper para renderizar tablas dinámicas con paginación.
 * Uso:
 *   table.render('#mi-tabla', columns, rows);
 *   table.renderPagination('#paginacion', meta, onPageChange);
 */

const table = {

  /**
   * Renderiza filas dentro de un <tbody>.
   * @param {string} tbodySelector  - Selector CSS del tbody
   * @param {Array}  columns        - [{ key, label, render }]
   * @param {Array}  rows           - Array de objetos de datos
   * @param {string} emptyMessage   - Mensaje cuando no hay datos
   */
  render(tbodySelector, columns, rows, emptyMessage = 'No hay registros para mostrar') {
    const tbody = document.querySelector(tbodySelector);
    if (!tbody) return;

    if (!rows || rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${columns.length}" style="text-align:center;padding:40px;color:var(--text-muted)">
            ${fmt.esc(emptyMessage)}
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = rows.map((row, idx) => {
      const cells = columns.map(col => {
        // Con col.render() el HTML lo arma (y escapa) el llamador; sin render
        // se interpola el dato crudo de la API → se escapa aquí.
        const value = col.render ? col.render(row) : fmt.esc(row[col.key] ?? '—');
        return `<td>${value}</td>`;
      }).join('');
      return `<tr data-id="${fmt.esc(row.id || idx)}">${cells}</tr>`;
    }).join('');
  },

  /**
   * Renderiza controles de paginación.
   *
   * KA-F-02: antes cada botón llevaba `onclick="(${onPage.toString()})(n)"`, es
   * decir el callback serializado dentro del atributo. Al evaluarse en ámbito
   * global perdía el closure, así que un callback que capturara variables
   * locales —como el de Empresas y Proveedores, que usa `rows`, parámetro de
   * `renderTabla`— reventaba con ReferenceError en consola: la tabla no
   * cambiaba y no había ni toast ni indicio visual.
   *
   * Ahora los botones solo llevan `data-page` y un único listener delegado en
   * el contenedor llama a `onPage` POR REFERENCIA, conservando su closure
   * (mismo patrón que la delegación de js/utils/picker.js). De paso deja de
   * romper la minificación y de necesitar 'unsafe-inline' en la CSP.
   *
   * @param {string}   containerSelector
   * @param {object}   meta   - { total, page, limit, pages }
   * @param {Function} onPage - callback(pageNumber)
   */
  renderPagination(containerSelector, meta, onPage) {
    const container = document.querySelector(containerSelector);
    if (!container || !meta) return;

    const { total, page, limit, pages } = meta;
    const from = ((page - 1) * limit) + 1;
    const to   = Math.min(page * limit, total);

    const btn = (etiqueta, destino, { activo = false, deshabilitado = false } = {}) =>
      `<button class="btn-page ${activo ? 'active' : ''} ${deshabilitado ? 'disabled' : ''}"
        ${deshabilitado ? 'disabled' : `data-page="${destino}"`}>${etiqueta}</button>`;

    let html = `<span class="pagination-info">Mostrando ${from}–${to} de ${total}</span>`;
    html += `<div class="pagination-controls">`;

    html += btn('&#8249;', page - 1, { deshabilitado: page <= 1 });

    const delta = 2;
    const range = [];
    for (let i = Math.max(1, page - delta); i <= Math.min(pages, page + delta); i++) {
      range.push(i);
    }
    if (range[0] > 1) {
      html += btn(1, 1);
      if (range[0] > 2) html += `<span class="pagination-ellipsis">…</span>`;
    }
    range.forEach((p) => { html += btn(p, p, { activo: p === page }); });
    if (range[range.length - 1] < pages) {
      if (range[range.length - 1] < pages - 1) html += `<span class="pagination-ellipsis">…</span>`;
      html += btn(pages, pages);
    }

    html += btn('&#8250;', page + 1, { deshabilitado: page >= pages });

    html += `</div>`;
    container.innerHTML = html; // estático: solo números de página y controles

    // Un solo listener por contenedor. Se reemplaza en cada render (la función
    // cambia con cada `onPage`), por eso se guarda para poder retirarlo.
    if (container._onPageClick) {
      container.removeEventListener('click', container._onPageClick);
    }
    container._onPageClick = (e) => {
      const boton = e.target.closest('[data-page]');
      if (!boton || !container.contains(boton)) return;
      const destino = parseInt(boton.dataset.page, 10);
      if (Number.isNaN(destino) || destino < 1 || destino > pages || destino === page) return;
      if (typeof onPage === 'function') onPage(destino);
    };
    container.addEventListener('click', container._onPageClick);
  },

  // Muestra skeleton loader mientras carga
  showSkeleton(tbodySelector, cols = 5, rows = 8) {
    const tbody = document.querySelector(tbodySelector);
    if (!tbody) return;
    // estático: solo placeholders de carga
    tbody.innerHTML = Array.from({ length: rows }).map(() =>
      `<tr class="skeleton-row">${Array.from({ length: cols }).map(() =>
        `<td><div class="skeleton-line"></div></td>`
      ).join('')}</tr>`
    ).join('');
  },
};

window.table = table;
