/**
 * modal.js — Helpers para abrir/cerrar modales Bootstrap-compatible.
 * Usa la clase .modal-backdrop y .modal--open del styles.css del proyecto.
 */

const modal = {

  open(id) {
    const el = document.getElementById(id);
    if (!el) return;

    // Cerrar cualquier modal activo antes de abrir uno nuevo
    document.querySelectorAll('.modal-backdrop.modal--open').forEach(m => {
      if (m.id !== id) m.classList.remove('modal--open');
    });

    el.style.display = 'flex';   // fallback por si el CSS no lo maneja
    el.classList.add('modal--open');
    document.body.style.overflow = 'hidden';

    // Cerrar con Escape
    const handler = (e) => {
      if (e.key === 'Escape') { modal.close(id); document.removeEventListener('keydown', handler); }
    };
    document.addEventListener('keydown', handler);

    // Cerrar al click en backdrop
    el.addEventListener('click', function onBackdrop(e) {
      if (e.target === el) { modal.close(id); el.removeEventListener('click', onBackdrop); }
    });
  },

  close(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('modal--open');
    el.style.display = 'none';
    document.body.style.overflow = '';
  },

  closeAll() {
    document.querySelectorAll('.modal-backdrop.modal--open').forEach(el => {
      el.classList.remove('modal--open');
      el.style.display = 'none';
    });
    document.body.style.overflow = '';
  },

  // Inyecta contenido dinámico en un modal existente
  setTitle(id, title) {
    const el = document.querySelector(`#${id} .modal-title`);
    if (el) el.textContent = title;
  },

  setBody(id, html) {
    // Inyector genérico: recibe HTML ya construido. La sanitización de los
    // datos dinámicos es responsabilidad de quien arma `html` (con fmt.esc).
    const el = document.querySelector(`#${id} .modal-body`);
    if (el) el.innerHTML = html;
  },

  // Confirmar acción (modal genérico reutilizable)
  confirm(message, onConfirm, { title = '¿Confirmar acción?', danger = false } = {}) {
    let overlay = document.getElementById('_confirm-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = '_confirm-modal';
      overlay.className = 'modal-backdrop';
      // estático: el título y el mensaje se inyectan con textContent (abajo), no aquí.
      overlay.innerHTML = `
        <div class="modal-box" style="max-width:420px">
          <div class="modal-header">
            <h3 class="modal-title" id="_confirm-title"></h3>
            <button class="modal-close" onclick="modal.close('_confirm-modal')">&times;</button>
          </div>
          <div class="modal-body">
            <p id="_confirm-msg" style="margin:0;color:var(--text-secondary)"></p>
          </div>
          <div class="modal-footer" style="display:flex;gap:8px;justify-content:flex-end;padding:16px 24px">
            <button class="btn btn-ghost" onclick="modal.close('_confirm-modal')">Cancelar</button>
            <button id="_confirm-ok" class="btn btn-primary">Confirmar</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }

    document.getElementById('_confirm-title').textContent = title;
    document.getElementById('_confirm-msg').textContent   = message;
    const btn = document.getElementById('_confirm-ok');
    btn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    btn.onclick = () => { modal.close('_confirm-modal'); onConfirm(); };
    modal.open('_confirm-modal');
  },
};

window.modal = modal;
