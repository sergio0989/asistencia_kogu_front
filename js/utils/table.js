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
            ${emptyMessage}
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = rows.map((row, idx) => {
      const cells = columns.map(col => {
        const value = col.render ? col.render(row) : (row[col.key] ?? '—');
        return `<td>${value}</td>`;
      }).join('');
      return `<tr data-id="${row.id || idx}">${cells}</tr>`;
    }).join('');
  },

  /**
   * Renderiza controles de paginación.
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

    let html = `<span class="pagination-info">Mostrando ${from}–${to} de ${total}</span>`;
    html += `<div class="pagination-controls">`;

    // Anterior
    html += `<button class="btn-page ${page <= 1 ? 'disabled' : ''}"
      ${page <= 1 ? 'disabled' : `onclick="(${onPage.toString()})(${page - 1})"`}>
      &#8249;
    </button>`;

    // Páginas
    const delta = 2;
    const range = [];
    for (let i = Math.max(1, page - delta); i <= Math.min(pages, page + delta); i++) {
      range.push(i);
    }
    if (range[0] > 1)     { html += `<button class="btn-page" onclick="(${onPage.toString()})(1)">1</button>`; if (range[0] > 2) html += `<span class="pagination-ellipsis">…</span>`; }
    range.forEach(p => {
      html += `<button class="btn-page ${p === page ? 'active' : ''}" onclick="(${onPage.toString()})(${p})">${p}</button>`;
    });
    if (range[range.length - 1] < pages) { if (range[range.length - 1] < pages - 1) html += `<span class="pagination-ellipsis">…</span>`; html += `<button class="btn-page" onclick="(${onPage.toString()})(${pages})">${pages}</button>`; }

    // Siguiente
    html += `<button class="btn-page ${page >= pages ? 'disabled' : ''}"
      ${page >= pages ? 'disabled' : `onclick="(${onPage.toString()})(${page + 1})"`}>
      &#8250;
    </button>`;

    html += `</div>`;
    container.innerHTML = html;
  },

  // Muestra skeleton loader mientras carga
  showSkeleton(tbodySelector, cols = 5, rows = 8) {
    const tbody = document.querySelector(tbodySelector);
    if (!tbody) return;
    tbody.innerHTML = Array.from({ length: rows }).map(() =>
      `<tr class="skeleton-row">${Array.from({ length: cols }).map(() =>
        `<td><div class="skeleton-line"></div></td>`
      ).join('')}</tr>`
    ).join('');
  },
};

window.table = table;
