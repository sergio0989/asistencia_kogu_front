'use strict';
/**
 * formRenderer.js — Renderer compartido de cuestionarios dinámicos.
 *
 * El esquema JSON (secciones/campos) es el mismo formato para asistencias
 * (nuevo-caso) y promotoría (nueva-oportunidad). Extraído de nuevo-caso.js
 * (Bf-05, decisión 1) sin cambiar el comportamiento.
 *
 * API:
 *   formRenderer.render(container, esquema)      → pinta el formulario
 *   formRenderer.recolectar(container)           → { name: valor|[valores] }
 *   formRenderer.evaluarCondicionales(selectEl)  → muestra/oculta condicionales
 *
 * Sanitización (Bf-03): todo dato del esquema (labels, opciones, valores en
 * atributos) pasa por fmt.esc(). El `container` se marca con
 * [data-form-renderer] para acotar el alcance de los condicionales.
 */
(function () {

  function render(container, esquema) {
    if (!container || !esquema?.secciones) return;
    container.setAttribute('data-form-renderer', '');
    // Esquema JSON configurable (API): se escapan títulos, labels y opciones.
    container.innerHTML = esquema.secciones.map(sec => `
      <div class="form-section">
        <h4 class="form-section__title">${fmt.esc(sec.titulo)}</h4>
        <div class="form-grid">
          ${sec.campos.map(campo => renderCampo(campo)).join('')}
        </div>
      </div>`
    ).join('');
  }

  function renderCampo(campo) {
    // Datos del esquema JSON (configurable vía API) → todo escapado: labels,
    // opciones y los valores que van dentro de atributos (id/name/data-*/maxlength).
    const req   = campo.requerido ? '<span style="color:var(--danger)">*</span>' : '';
    const id    = `campo_${campo.id}`;
    const idA   = fmt.esc(id);
    const nameA = fmt.esc(campo.id);
    const label = fmt.esc(campo.label);

    // Atributo condicional: el campo se oculta por defecto si depende de otro
    const condicional = campo.condicional;
    const esCondicional = !!condicional;
    const wrapStyle   = esCondicional ? 'display:none' : '';
    const wrapData    = esCondicional
      ? `data-cond-campo="${fmt.esc(condicional.campo)}" data-cond-valor="${fmt.esc(condicional.valor)}"`
      : '';

    let inner = '';

    if (campo.tipo === 'texto' || campo.tipo === 'hora') {
      inner = `<label for="${idA}">${label} ${req}</label>
        <input type="text" id="${idA}" name="${nameA}" maxlength="${fmt.esc(campo.maxLength || 255)}"
          ${campo.requerido && !esCondicional ? 'required' : ''} class="form-control">`;
    }
    else if (campo.tipo === 'fecha') {
      // Si el label menciona "hora" usamos datetime-local; si no, solo date
      const inputType = /hora/i.test(campo.label) ? 'datetime-local' : 'date';
      inner = `<label for="${idA}">${label} ${req}</label>
        <input type="${inputType}" id="${idA}" name="${nameA}" class="form-control">`;
    }
    else if (campo.tipo === 'numero') {
      inner = `<label for="${idA}">${label} ${req}</label>
        <input type="number" id="${idA}" name="${nameA}"
          min="${fmt.esc(campo.min || '')}" max="${fmt.esc(campo.max || '')}" class="form-control">`;
    }
    else if (campo.tipo === 'boolean') {
      inner = `<label style="flex-direction:row;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="${idA}" name="${nameA}"> ${label}</label>`;
    }
    else if (campo.tipo === 'select') {
      inner = `<label for="${idA}">${label} ${req}</label>
        <select id="${idA}" name="${nameA}" class="form-control"
                onchange="formRenderer.evaluarCondicionales(this)">
          <option value="">— Seleccionar —</option>
          ${campo.opciones.map(o => `<option value="${fmt.esc(o)}">${fmt.esc(o)}</option>`).join('')}
        </select>`;
    }
    else if (campo.tipo === 'checkboxes') {
      return `<div class="form-group form-group--full" style="${wrapStyle}" ${wrapData} data-campo-wrap="${nameA}">
        <label>${label} ${req}</label>
        <div class="checkbox-group">
          ${campo.opciones.map(o => `
            <label class="checkbox-item">
              <input type="checkbox" name="${nameA}" value="${fmt.esc(o)}"> ${fmt.esc(o)}
            </label>`).join('')}
        </div>
      </div>`;
    }
    else if (campo.tipo === 'textarea') {
      return `<div class="form-group form-group--full" style="${wrapStyle}" ${wrapData} data-campo-wrap="${nameA}">
        <label for="${idA}">${label} ${req}</label>
        <textarea id="${idA}" name="${nameA}" rows="3" maxlength="${fmt.esc(campo.maxLength || 2000)}"
          class="form-control"></textarea>
      </div>`;
    }

    if (!inner) return '';
    return `<div class="form-group" style="${wrapStyle}" ${wrapData} data-campo-wrap="${nameA}">
      ${inner}
    </div>`;
  }

  /**
   * Evalúa los campos condicionales después de que un select cambia su valor.
   * Busca todos los wrappers con data-cond-campo=<name> dentro del mismo
   * contenedor del renderer y los muestra/oculta.
   */
  function evaluarCondicionales(selectEl) {
    const nombreCampo = selectEl.name;
    const valorActual = selectEl.value;
    const container   = selectEl.closest('[data-form-renderer]')
      || document.getElementById('formulario-dinamico');
    if (!container) return;

    container.querySelectorAll(`[data-cond-campo="${nombreCampo}"]`).forEach(wrap => {
      const valorEsperado = wrap.dataset.condValor;
      const visible = valorActual === valorEsperado;
      wrap.style.display = visible ? '' : 'none';
      // Limpiar valor cuando se oculta para no enviar datos fantasma
      if (!visible) {
        wrap.querySelectorAll('input, select, textarea').forEach(el => {
          if (el.type === 'checkbox') el.checked = false;
          else el.value = '';
        });
      }
    });
  }

  /**
   * Recolecta las respuestas del formulario dentro de `container`.
   * Ignora los campos dentro de un wrapper condicional oculto.
   */
  function recolectar(container) {
    const respuestas = {};
    if (!container) return respuestas;

    container.querySelectorAll('[name]').forEach(el => {
      // Ignorar campos dentro de un wrapper condicional que está oculto
      const wrap = el.closest('[data-campo-wrap]');
      if (wrap && wrap.style.display === 'none') return;

      if (el.type === 'checkbox') {
        if (!respuestas[el.name]) respuestas[el.name] = [];
        if (el.checked) respuestas[el.name].push(el.value || true);
      } else if (el.value) {
        respuestas[el.name] = el.value;
      }
    });
    return respuestas;
  }

  window.formRenderer = { render, renderCampo, evaluarCondicionales, recolectar };
  // Alias de compatibilidad: markup previo pudo referenciar el global suelto.
  window.evaluarCondicionales = evaluarCondicionales;
})();
