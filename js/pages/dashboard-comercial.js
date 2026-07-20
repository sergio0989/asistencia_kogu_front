'use strict';
/**
 * dashboard-comercial.js — Panel comercial (Promotoría).
 * Consume endpoints existentes: polizas/kpis, polizas/bandeja-renovaciones,
 * oportunidades/kpis, oportunidades/recontactos. El scope lo aplica el API.
 * Depende de: api.js, oportunidades.service.js, polizas.service.js, fmt, toast.
 */

document.addEventListener('DOMContentLoaded', () => {
  mostrarUsuario();
  cargarCartera();
  cargarEmbudo();
  cargarRenovaciones();
  cargarRecontactos();
});

function mostrarUsuario() {
  try {
    const u = JSON.parse(sessionStorage.getItem('user') || 'null');
    const el = document.getElementById('pc-user');
    if (el && u && u.nombre) el.textContent = u.nombre;
  } catch { /* silencioso */ }
}

const box = (label, value) =>
  `<div class="kpi-box"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`;

// ─── Mi cartera (polizas/kpis) ───────────────────────────────────────────────
async function cargarCartera() {
  try {
    const k = await polizasService.getKpis();
    document.getElementById('cartera-row').innerHTML =
      box('Pólizas vigentes', fmt.esc(k.vigentes ?? 0)) +
      box('Prima vigente', fmt.moneda(k.prima_vigente)) +
      box('Por renovar 45/30/15', `${fmt.esc(k.por_renovar_45 ?? 0)} / ${fmt.esc(k.por_renovar_30 ?? 0)} / ${fmt.esc(k.por_renovar_15 ?? 0)}`) +
      box('Tasa de retención', k.tasa_retencion_pct != null ? `${fmt.esc(k.tasa_retencion_pct)}%` : '—') +
      box('Recibos vencidos', fmt.esc(k.recibos_vencidos ?? 0));
  } catch (err) {
    console.error('cartera:', err);
    document.getElementById('cartera-row').innerHTML = box('Cartera', '—');
  }
}

// ─── Mi embudo (oportunidades/kpis) + funnel por etapa ───────────────────────
async function cargarEmbudo() {
  try {
    const k = await oportunidadesService.getKpis();
    document.getElementById('embudo-row').innerHTML =
      box('Oportunidades abiertas', fmt.esc(k.abiertas ?? 0)) +
      box('Valor potencial', fmt.moneda(k.valor_potencial)) +
      box('Por recontactar', fmt.esc(k.por_recontactar ?? 0)) +
      box('Tasa de cierre', k.tasa_cierre_pct != null ? `${fmt.esc(k.tasa_cierre_pct)}%` : '—') +
      box('Ganadas', fmt.esc(k.ganadas ?? 0));

    const etapas = [
      ['primer_contacto', 'Primer contacto'], ['calificado', 'Calificado'],
      ['en_cotizacion', 'En cotización'], ['cotizado', 'Cotizado'], ['en_emision', 'En emisión'],
    ];
    const pe = k.por_estatus || {};
    const max = Math.max(1, ...etapas.map(([c]) => pe[c] || 0));
    document.getElementById('funnel').innerHTML = etapas.map(([c, l]) => {
      const n = pe[c] || 0;
      const w = Math.round((n / max) * 100);
      return `<div class="fbar"><span class="lab">${l}</span><span class="track"><span class="fill" style="width:${w}%"></span></span><span class="n">${fmt.esc(n)}</span></div>`;
    }).join('');
  } catch (err) {
    console.error('embudo:', err);
    document.getElementById('embudo-row').innerHTML = box('Embudo', '—');
  }
}

// ─── Renovaciones próximas (polizas/bandeja-renovaciones) ────────────────────
async function cargarRenovaciones() {
  const cont = document.getElementById('reno-list');
  try {
    const rows = (await polizasService.bandejaRenovaciones()) || [];
    if (!rows.length) { cont.innerHTML = '<div class="pc-empty">Sin pólizas por renovar próximamente. 🎉</div>'; return; }
    const sem = { rojo: '#dc2626', naranja: '#ea580c', amarillo: '#ca8a04', vencida: '#7f1d1d', verde: '#16a34a' };
    cont.innerHTML = `<table class="pc-table"><thead><tr><th></th><th>Póliza</th><th>Cliente</th><th>Vence</th><th>Días</th><th>Prima</th></tr></thead><tbody>` +
      rows.slice(0, 6).map(p => `<tr>
        <td><span class="pc-sem" style="background:${sem[p.semaforo] || '#16a34a'}" title="${fmt.esc(p.semaforo || '')}"></span></td>
        <td><a class="pc-lk" href="/comercial/poliza.html?id=${p.id}">${fmt.esc(p.numero_poliza)}</a></td>
        <td>${fmt.esc(p.cliente_nombre || '—')}</td>
        <td>${fmt.fecha(p.vigencia_fin)}</td>
        <td><b>${fmt.esc(p.dias_restantes)}</b></td>
        <td>${fmt.moneda(p.prima_total)}</td></tr>`).join('') + `</tbody></table>`;
  } catch (err) {
    console.error('renovaciones:', err);
    cont.innerHTML = '<div class="pc-empty">No se pudieron cargar las renovaciones.</div>';
  }
}

// ─── Por recontactar (oportunidades/recontactos) ─────────────────────────────
async function cargarRecontactos() {
  const cont = document.getElementById('recontacto-list');
  try {
    const rows = (await oportunidadesService.getRecontactos()) || [];
    if (!rows.length) { cont.innerHTML = '<div class="pc-empty">Sin recontactos pendientes hoy. 🎉</div>'; return; }
    cont.innerHTML = `<table class="pc-table"><thead><tr><th>Folio</th><th>Cliente</th><th>Ramo</th><th>Recontacto</th></tr></thead><tbody>` +
      rows.slice(0, 6).map(o => `<tr>
        <td><a class="pc-lk" href="/comercial/oportunidad.html?id=${o.id}">${fmt.esc(o.folio)}</a></td>
        <td>${fmt.esc(o.cliente_nombre || '—')}</td>
        <td>${fmt.esc(o.ramo_clave || '—')}</td>
        <td>${fmt.fecha(o.fecha_recontacto)}</td></tr>`).join('') + `</tbody></table>`;
  } catch (err) {
    console.error('recontactos:', err);
    cont.innerHTML = '<div class="pc-empty">No se pudieron cargar los recontactos.</div>';
  }
}
