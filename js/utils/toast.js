/**
 * toast.js — Notificaciones tipo toast.
 * Uso: toast.success('Expediente creado') / toast.error('Error al guardar')
 */

(function () {
  // Inyecta el contenedor una sola vez
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px',
      'z-index:9999', 'display:flex', 'flex-direction:column',
      'gap:10px', 'pointer-events:none',
    ].join(';');
    document.body.appendChild(container);
  }

  const ICONS = {
    success: '✅',
    error:   '❌',
    warning: '⚠️',
    info:    'ℹ️',
  };

  const COLORS = {
    success: '#166534',
    error:   '#991B1B',
    warning: '#92400E',
    info:    '#1E3A5F',
  };

  const BG = {
    success: '#DCFCE7',
    error:   '#FEE2E2',
    warning: '#FEF9C3',
    info:    '#DBEAFE',
  };

  function show(message, type = 'info', duration = 3500) {
    const t = document.createElement('div');
    t.style.cssText = [
      `background:${BG[type]}`,
      `color:${COLORS[type]}`,
      'padding:12px 18px',
      'border-radius:8px',
      `border-left:4px solid ${COLORS[type]}`,
      'font-family:Arial,sans-serif',
      'font-size:13px',
      'font-weight:600',
      'max-width:340px',
      'pointer-events:auto',
      'box-shadow:0 4px 12px rgba(0,0,0,0.15)',
      'opacity:0',
      'transform:translateX(20px)',
      'transition:all 0.25s ease',
      'cursor:pointer',
    ].join(';');

    // `message` suele ser texto fijo, pero también mensajes de error de la API:
    // se escapa. El ícono y &nbsp; son estáticos.
    t.innerHTML = `${ICONS[type]} &nbsp;${fmt.esc(message)}`;
    t.onclick = () => remove(t);
    container.appendChild(t);

    // Animación de entrada
    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translateX(0)';
    });

    // Auto-dismiss
    const timer = setTimeout(() => remove(t), duration);
    t._timer = timer;
  }

  function remove(el) {
    clearTimeout(el._timer);
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 260);
  }

  window.toast = {
    success: (msg, dur) => show(msg, 'success', dur),
    error:   (msg, dur) => show(msg, 'error',   dur || 5000),
    warning: (msg, dur) => show(msg, 'warning', dur),
    info:    (msg, dur) => show(msg, 'info',    dur),
  };
})();
