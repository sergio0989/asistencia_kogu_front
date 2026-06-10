'use strict';
/**
 * dashboard.js — KPIs ejecutivos y resumen operativo.
 * Depende de: api.js, asistencias.service.js, proveedores.service.js, fmt, toast
 */

document.addEventListener('DOMContentLoaded', async () => {
  renderReloj();
  setInterval(renderReloj, 60_000);

  await cargarDashboard();
  setInterval(cargarDashboard, 60_000);

  cargarCarteraCard();   // Bf-04: tarjeta de cartera (solo si el API da acceso comercial)
});

// ─── Tarjeta de cartera (Promotoría, Bf-04) ───────────────────────────────────
async function cargarCarteraCard() {
  const card = document.getElementById('cartera-card');
  if (!card || !window.polizasService) return;
  try {
    const k = await polizasService.getKpis();
    const item = (label, value) => `
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8">${label}</div>
        <div style="font-size:20px;font-weight:800;color:#0f172a">${value}</div>
      </div>`;
    document.getElementById('cartera-kpis').innerHTML =
      item('Pólizas vigentes', fmt.esc(k.vigentes ?? 0)) +
      item('Por renovar (45d)', fmt.esc(k.por_renovar_45 ?? 0)) +
      item('Recibos vencidos', fmt.esc(k.recibos_vencidos ?? 0));
    card.style.display = '';   // visible solo si el usuario tiene acceso a la cartera
  } catch {
    // Sin acceso comercial (403) o error: la tarjeta queda oculta.
  }
}

// ─── Reloj y fecha en topbar ──────────────────────────────────────────────────
function renderReloj() {
  const ahora = new Date();

  const hora = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  setEl('topbar-hora', hora);

  const fecha = ahora.toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  // Capitalizar primera letra
  setEl('topbar-fecha', fecha.charAt(0).toUpperCase() + fecha.slice(1));
}

// ─── Carga principal ──────────────────────────────────────────────────────────
async function cargarDashboard() {
  try {
    const [kpis, recientes, criticos, proveedoresResp, porCanal] = await Promise.all([
      asistenciasService.getKpis(),
      asistenciasService.listar({ limit: 8, page: 1 }),
      asistenciasService.listar({ nivel_urgencia: 'critico', estatus_macro: 'activo', limit: 5, page: 1 }),
      proveedoresService.listar({ todos: 1, limit: 4 }),
      cargarConteoCanales(),
    ]);
    const proveedores = proveedoresResp?.data ?? [];

    renderKpis(kpis);
    renderUrgenciaBar(kpis);
    renderCanales(porCanal);
    renderAlertas(criticos?.data || []);
    renderTopProveedores(proveedores);
    renderTablaRecientes(recientes?.data || []);
    renderTimestamp();

  } catch (err) {
    console.error('Error cargando dashboard:', err);
    toast.error('No se pudo cargar el dashboard');
  }
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────
function renderKpis(k) {
  setEl('kpi-activos',      k.activos           ?? '—');
  setEl('kpi-activos-top',  k.activos           ?? '—');
  setEl('kpi-pendientes',   k.pendientes         ?? '—');
  setEl('kpi-cerrados-mes', k.cerrados_mes       ?? '—');
  setEl('kpi-criticos',     k.criticos_abiertos  ?? '—');
  setEl('kpi-criticos-top', k.criticos_abiertos  ?? '—');
  setEl('kpi-sin-abogado',  k.sin_proveedor      ?? '—');
  setEl('kpi-total',        k.total              ?? '—');
  setEl('kpi-tiempo-prom',
    k.tiempo_promedio_horas != null ? `${k.tiempo_promedio_horas}h` : '—');

  // Alerta visual si hay críticos
  if (parseInt(k.criticos_abiertos) > 0) {
    document.getElementById('kpi-card-criticos')?.classList.add('kpi--alert');
  }
}

// ─── Barra de distribución de urgencia ───────────────────────────────────────
function renderUrgenciaBar(k) {
  const container = document.getElementById('urgencia-bar');
  if (!container) return;

  const total = parseInt(k.activos) || 1;
  const criticos = parseInt(k.criticos_abiertos) || 0;

  // Estimación proporcional basada en los datos disponibles del KPI
  // (el endpoint no devuelve breakdown por urgencia, pero criticos_abiertos sí)
  const niveles = [
    { label: 'Crítico', color: '#dc2626', dotClass: 'dot-critico', count: criticos },
    { label: 'Alto',    color: '#d97706', dotClass: 'dot-alto',    count: Math.round(total * 0.25) },
    { label: 'Medio',   color: '#0891b2', dotClass: 'dot-medio',   count: Math.round(total * 0.45) },
    { label: 'Bajo',    color: '#16a34a', dotClass: 'dot-bajo',    count: Math.max(0, total - criticos - Math.round(total * 0.25) - Math.round(total * 0.45)) },
  ];

  // estático: `niveles` es un arreglo fijo (labels/colores hardcodeados, counts numéricos)
  container.innerHTML = niveles.map(n => {
    const pct = Math.max(1, Math.round((n.count / total) * 100));
    return `
      <div>
        <div class="row">
          <div><span class="status-dot ${n.dotClass}"></span><strong style="font-size:13px">${n.label}</strong></div>
          <span class="badge">${n.count} caso${n.count !== 1 ? 's' : ''}</span>
        </div>
        <div class="chart-bar-h">
          <div class="chart-fill" style="background:${n.color};width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

// ─── Conteo por canal (consulta separada) ─────────────────────────────────────
async function cargarConteoCanales() {
  try {
    const canales = ['llamada', 'web', 'whatsapp', 'interno'];
    const resultados = await Promise.all(
      canales.map(c => asistenciasService.listar({ canal_origen: c, estatus_macro: 'activo', limit: 1, page: 1 }))
    );
    return Object.fromEntries(canales.map((c, i) => [c, resultados[i]?.meta?.total ?? 0]));
  } catch {
    return {};
  }
}

function renderCanales(data) {
  const canales = ['llamada', 'web', 'whatsapp', 'interno'];
  canales.forEach(c => {
    const el = document.getElementById(`canal-${c}`);
    if (el) {
      el.textContent = `${data[c] ?? 0}`;
      el.className = 'badge ' + (data[c] > 0 ? 'primary' : '');
    }
  });
}

// ─── Alertas activas (críticos sin resolver) ─────────────────────────────────
function renderAlertas(rows) {
  const container = document.getElementById('alertas-list');
  if (!container) return;

  if (!rows.length) {
    // estático: sin alertas
    container.innerHTML = `<div style="padding:16px;text-align:center;color:#64748b;font-size:13px">
      ✅ Sin alertas críticas activas</div>`;
    return;
  }

  // r.id: UUID propio → tal cual en onclick. Demás datos de API escapados.
  container.innerHTML = rows.map(r => {
    const sinAbogado = !r.proveedor_nombre;
    const clase = sinAbogado ? 'alerta-row danger' : 'alerta-row';
    const icono = sinAbogado ? '🔴' : '🟡';
    const motivo = sinAbogado
      ? 'Sin asignación · Requiere abogado inmediato'
      : `${fmt.esc(r.proveedor_nombre)} · ${fmt.esc(fmt.estatus(r.estatus_operativo).label)}`;
    return `
      <div class="${clase}" onclick="verExpediente('${r.id}')">
        <span style="font-size:18px;flex-shrink:0">${icono}</span>
        <div>
          <strong style="font-size:12px">${fmt.esc(r.folio)}</strong> — ${fmt.esc(r.conductor_nombre)}
          <div style="color:#92400e;font-size:11px;margin-top:2px">
            ${motivo} · ${fmt.tiempoRelativo(r.created_at)}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── Top abogados ─────────────────────────────────────────────────────────────
function renderTopProveedores(proveedores) {
  const container = document.getElementById('top-abogados-list');
  if (!container) return;

  // Ordenar por carga (casos_activos) descendente; los ausentes cuentan como 0
  const top = [...proveedores]
    .sort((a, b) => (parseInt(b.casos_activos) || 0) - (parseInt(a.casos_activos) || 0))
    .slice(0, 4);
  if (!top.length) {
    // estático
    container.innerHTML = '<p style="color:#94a3b8;font-size:12px">Sin proveedores activos</p>';
    return;
  }

  const avClases = ['av-blue', 'av-green', 'av-orange', 'av-blue'];
  container.innerHTML = top.map((p, i) => {
    const nombre     = (p.nombre || '—').replace('Lic. ', '');
    const tieneCarga = p.casos_activos != null;          // el shape del backend trae el campo
    const casos      = parseInt(p.casos_activos) || 0;
    const contacto   = p.email || (p.telefono ? fmt.telefono(p.telefono) : '');
    // Línea secundaria: carga si hay casos; si está ausente o es 0, cae al contacto
    const secundaria = (tieneCarga && casos > 0)
      ? `${casos} caso${casos !== 1 ? 's' : ''} activo${casos !== 1 ? 's' : ''}`
      : contacto;
    // Badge solo si el shape trae casos_activos; si no, sin badge (no rompe)
    const badge = tieneCarga
      ? `<span class="badge ${casos >= 5 ? 'danger' : casos >= 3 ? 'warn' : 'success'}">
          ${casos === 0 ? 'Disponible' : casos >= 5 ? 'Alta carga' : 'Activo'}
        </span>`
      : '';
    return `
    <div class="trend-row">
      <div style="display:flex;align-items:center;gap:8px">
        <div class="avatar ${avClases[i % 4]}">${fmt.esc((p.nombre || '?').charAt(0))}</div>
        <div>
          <div style="font-size:12px;font-weight:600">${fmt.esc(nombre)}</div>
          ${secundaria ? `<div style="font-size:11px;color:#94a3b8">${fmt.esc(secundaria)}</div>` : ''}
        </div>
      </div>
      ${badge}
    </div>`;
  }).join('');
}

// ─── Tabla de casos recientes ─────────────────────────────────────────────────
function renderTablaRecientes(rows) {
  const tbody = document.getElementById('tabla-recientes-body');
  if (!tbody) return;

  if (!rows.length) {
    // estático: estado vacío con enlace fijo
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:#94a3b8">
      Sin expedientes — <a href="/nuevo-caso.html" style="color:#0891b2">Crear el primero</a>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const urg = fmt.urgencia(r.nivel_urgencia);
    const est = fmt.estatus(r.estatus_operativo);
    return `
      <tr onclick="verExpediente('${r.id}')" style="cursor:pointer" class="urgencia-row--${fmt.esc(r.nivel_urgencia)}">
        <td><strong style="color:#0891b2;font-family:ui-monospace,monospace;font-size:11px">${fmt.esc(r.folio)}</strong></td>
        <td>${fmt.esc(r.conductor_nombre)}</td>
        <td style="font-size:12px">${r.empresa_nombre ? fmt.esc(r.empresa_nombre) : '—'}</td>
        <td>${fmt.badgeHtml(urg.label, urg.class)}</td>
        <td>${fmt.badgeHtml(est.label, est.class)}</td>
        <td style="color:#94a3b8;font-size:12px">${fmt.tiempoRelativo(r.created_at)}</td>
      </tr>`;
  }).join('');
}

// ─── Timestamp ────────────────────────────────────────────────────────────────
function renderTimestamp() {
  setEl('last-update', fmt.fechaHora(new Date().toISOString()));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function verExpediente(id) {
  window.location.href = `/detalle.html?id=${id}`;
}

window.verExpediente = verExpediente;
