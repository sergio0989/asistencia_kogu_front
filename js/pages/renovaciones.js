'use strict';
/**
 * renovaciones.js — Bandeja de renovaciones + KPIs de cartera (Promotoría P1).
 * Depende de: api.js, polizas.service.js, fmt, toast, modal, formErrors
 */

let renovandoId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([cargarKpis(), cargarBandeja()]);
  document.getElementById('btn-confirmar-renovar')?.addEventListener('click', confirmarRenovar);
});

// ─── KPIs ─────────────────────────────────────────────────────────────────────
async function cargarKpis() {
  try {
    const k = await polizasService.getKpis();
    const box = (label, value) => `<div class="kpi-box"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`;
    document.getElementById('kpi-row').innerHTML =
      box('Vigentes', fmt.esc(k.vigentes ?? 0)) +
      box('Prima vigente', fmt.moneda(k.prima_vigente)) +
      box('Por renovar (45 / 30 / 15)', `${fmt.esc(k.por_renovar_45 ?? 0)} / ${fmt.esc(k.por_renovar_30 ?? 0)} / ${fmt.esc(k.por_renovar_15 ?? 0)}`) +
      box('Tasa de retención', k.tasa_retencion_pct != null ? `${fmt.esc(k.tasa_retencion_pct)}%` : '—') +
      box('Recibos vencidos', fmt.esc(k.recibos_vencidos ?? 0));
  } catch (err) {
    console.error(err);
  }
}

// ─── Bandeja ──────────────────────────────────────────────────────────────────
async function cargarBandeja() {
  try {
    const rows = await polizasService.bandejaRenovaciones() || [];
    renderBandeja(rows);
  } catch (err) {
    toast.error('Error al cargar la bandeja de renovaciones');
    console.error(err);
  }
}

function renderBandeja(rows) {
  const cont = document.getElementById('bandeja');
  if (!rows.length) { cont.innerHTML = '<p style="color:#94a3b8;font-size:13px">No hay pólizas en ventana de renovación. 🎉</p>'; return; }
  const semClase = { rojo: 'sem-rojo', naranja: 'sem-naranja', amarillo: 'sem-amarillo', verde: 'sem-verde', vencida: 'sem-vencida' };
  // p.id: UUID propio → onclick; demás datos de API escapados. El semáforo se
  // mapea a una clase interna (no se interpola el valor crudo en el HTML).
  cont.innerHTML = `<table class="mini-table">
    <thead><tr><th></th><th>Número</th><th>Cliente</th><th>Ramo</th><th>Aseguradora</th><th>Vence</th><th>Días</th><th>Prima</th><th></th></tr></thead>
    <tbody>${rows.map(p => `
      <tr>
        <td><span class="sem ${semClase[p.semaforo] || 'sem-verde'}" title="${fmt.esc(p.semaforo)}"></span></td>
        <td><a href="/comercial/poliza.html?id=${p.id}" style="color:#0891b2;text-decoration:none"><strong>${fmt.esc(p.numero_poliza)}</strong></a></td>
        <td>${fmt.esc(p.cliente_nombre || '—')}<div style="color:#94a3b8;font-size:11px">${p.cliente_telefono ? fmt.esc(fmt.telefono(p.cliente_telefono)) : ''}</div></td>
        <td>${fmt.esc(p.ramo_clave || '—')}</td>
        <td style="font-size:12px">${fmt.esc(p.aseguradora_nombre || '—')}</td>
        <td>${fmt.fecha(p.vigencia_fin)}</td>
        <td><strong>${fmt.esc(p.dias_restantes)}</strong></td>
        <td>${fmt.moneda(p.prima_total)}</td>
        <td style="text-align:right"><button class="btn btn-primary btn-sm"
          onclick="abrirRenovar('${p.id}','${fmt.esc(String(p.numero_poliza).replace(/\\/g,'\\\\').replace(/'/g,"\\'"))}','${(p.vigencia_fin||'').slice(0,10)}','${fmt.esc(p.prima_total)}')">🔁 Renovar</button></td>
      </tr>`).join('')}</tbody></table>`;
}

// ─── Renovar (mismo flujo que en pólizas) ─────────────────────────────────────
function abrirRenovar(id, numero, vigFin, prima) {
  renovandoId = id;
  formErrors.limpiar();
  document.getElementById('ren-anterior').textContent = numero;
  document.getElementById('r-numero').value = `${numero}-R`;
  document.getElementById('r-vig-inicio').value = vigFin || '';
  document.getElementById('r-vig-fin').value = '';
  document.getElementById('r-prima').value = prima || '';
  modal.open('modal-renovar');
}

async function confirmarRenovar() {
  formErrors.limpiar();
  const numero_poliza = document.getElementById('r-numero').value.trim();
  const vigencia_fin  = document.getElementById('r-vig-fin').value;
  if (!numero_poliza) { toast.warning('Indica el número de la nueva póliza'); return; }
  if (!vigencia_fin)  { toast.warning('Indica la vigencia fin de la renovación'); return; }
  const data = {
    numero_poliza, vigencia_fin,
    vigencia_inicio: document.getElementById('r-vig-inicio').value || undefined,
    prima_total: document.getElementById('r-prima').value ? Number(document.getElementById('r-prima').value) : undefined,
  };
  const btn = document.getElementById('btn-confirmar-renovar');
  btn.disabled = true; btn.textContent = 'Renovando…';
  try {
    const res = await polizasService.renovar(renovandoId, data);
    toast.success('Póliza renovada');
    modal.close('modal-renovar');
    const nuevaId = res?.poliza_nueva?.id;
    if (nuevaId) window.location.href = `/comercial/poliza.html?id=${nuevaId}`;
    else { await cargarKpis(); await cargarBandeja(); }
  } catch (err) {
    if (!formErrors.aplicar(err, { numero_poliza: 'r-numero', vigencia_fin: 'r-vig-fin', vigencia_inicio: 'r-vig-inicio', prima_total: 'r-prima' })) {
      toast.error(err.message || 'Error al renovar la póliza');
    }
  } finally { btn.disabled = false; btn.textContent = 'Renovar'; }
}

window.abrirRenovar = abrirRenovar;
