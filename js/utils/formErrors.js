'use strict';
/**
 * formErrors.js — Traduce el 422 del API (details de Joi) a mensajes por campo
 * en el formulario. Reusa el patrón de toast para el resumen.
 *
 * Uso en el catch de un "guardar":
 *   formErrors.limpiar();
 *   ...
 *   catch (err) { if (!formErrors.aplicar(err, MAPA)) toast.error(err.message); }
 *
 * MAPA: { campo_del_api: 'id-del-input' }
 */
(function () {
  function limpiar(scope) {
    (scope || document).querySelectorAll('.field-error').forEach(e => e.remove());
  }

  function aplicar(err, mapa = {}) {
    if (!err || err.status !== 422 || !Array.isArray(err.details) || !err.details.length) return false;
    let pintados = 0;
    err.details.forEach(d => {
      const raiz    = String(d.field || '').split('.')[0];
      const inputId = mapa[d.field] || mapa[raiz];
      const input   = inputId && document.getElementById(inputId);
      if (input) {
        const grupo = input.closest('.form-group') || input.parentElement;
        let er = grupo.querySelector('.field-error');
        if (!er) {
          er = document.createElement('div');
          er.className = 'field-error';
          er.style.cssText = 'color:#dc2626;font-size:11px;margin-top:4px';
          grupo.appendChild(er);
        }
        er.textContent = d.message;   // textContent → seguro (no innerHTML)
        pintados++;
      }
    });
    toast.error(pintados ? 'Revisa los campos marcados' : err.details.map(d => d.message).join('. '));
    return true;
  }

  window.formErrors = { limpiar, aplicar };
})();
