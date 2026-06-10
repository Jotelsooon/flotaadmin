import { sb }        from './supabase.js';
import { state }     from './state.js';
import { fmtDate, fmtDisp, subDays, formatMoney, calcReparto, tablaHTML, esc } from './utils.js';

export async function renderHistorial() {
  const { rol } = state.profile;
  const el = document.getElementById('main-content');
  const today    = new Date();
  const todayStr = fmtDate(today);
  const mOpts    = state.moviles.map(m => `<option value="${m.id}">${esc(m.numero)}</option>`).join('');

  el.innerHTML = `
    <div class="card" style="padding:16px">
      <div class="section-title">Período rápido</div>
      <div class="period-filters">
        <button class="pf-btn" data-days="1">Hoy</button>
        <button class="pf-btn" data-days="7">7 días</button>
        <button class="pf-btn" data-days="15">15 días</button>
        <button class="pf-btn active" data-days="30">30 días</button>
        <button class="pf-btn" data-days="365">Año</button>
      </div>
      <div class="section-title" style="margin-top:12px">O elegí un rango de fechas</div>
      <div class="date-range-row">
        <input type="date" id="hd" value="${fmtDate(subDays(today, 29))}"/>
        <span>hasta</span>
        <input type="date" id="hh" value="${todayStr}"/>
      </div>
      ${state.moviles.length ? `
        <div class="form-group" style="margin-bottom:10px">
          <select id="hm"><option value="">Todos los móviles</option>${mOpts}</select>
        </div>` : ''}
      <div class="form-group" style="margin-bottom:0">
        <select id="ht">
          <option value="">Todos los turnos</option>
          <option>Mañana</option><option>Tarde</option><option>Noche</option>
        </select>
      </div>
    </div>

    <div id="period-summary-wrap"></div>

    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <button class="btn primary sm" id="btn-filtrar">Ver resultados</button>
      ${rol === 'titular' ? '<button class="btn green sm" id="btn-pdf">Exportar PDF</button>' : ''}
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Registros</h3>
        <span id="hbadge" style="font-size:12px;color:var(--muted)"></span>
      </div>
      <div class="table-wrap" id="htabla"><div class="loading">Cargando...</div></div>
    </div>`;

  // Event delegation — no inline onclick (fixes audit H-13)
  el.querySelector('.period-filters')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-days]');
    if (!btn) return;
    el.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const n = parseInt(btn.dataset.days);
    document.getElementById('hd').value = fmtDate(subDays(today, n - 1));
    document.getElementById('hh').value = todayStr;
    filtrarHistorial();
  });

  document.getElementById('btn-filtrar')?.addEventListener('click', filtrarHistorial);
  document.getElementById('btn-pdf')?.addEventListener('click', exportarPDF);

  filtrarHistorial();
}

// ── Filter & fetch ──────────────────────────────────────────
async function filtrarHistorial() {
  const titId = state.profile.rol === 'titular' ? state.profile.id : state.profile.titular_id;
  let q = sb.from('recaudaciones').select('*')
    .eq('titular_id', titId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  const d  = document.getElementById('hd')?.value;
  const h  = document.getElementById('hh')?.value;
  const m  = document.getElementById('hm')?.value;
  const t  = document.getElementById('ht')?.value;

  if (d) q = q.gte('fecha', d);
  if (h) q = q.lte('fecha', h);
  if (m) q = q.eq('movil_id', parseInt(m));
  if (t) q = q.eq('turno', t);

  const { data } = await q;
  state.historialRows = data || [];

  renderPeriodSummary(state.historialRows);
  document.getElementById('hbadge').textContent = state.historialRows.length + ' registros';
  document.getElementById('htabla').innerHTML   = tablaHTML(state.historialRows, state.moviles, state.profile.rol === 'titular');
}

// ── Period summary ──────────────────────────────────────────
function renderPeriodSummary(rows) {
  const wrap = document.getElementById('period-summary-wrap');
  if (!wrap || !rows.length || state.profile.rol !== 'titular') {
    if (wrap) wrap.innerHTML = '';
    return;
  }

  const netoTotal   = rows.reduce((s, r) => s + Number(r.total  || 0), 0);
  const gastosTotal = rows.reduce((s, r) => s + Number(r.gastos || 0), 0);
  let totCond = 0, totDueno = 0;
  rows.forEach(r => {
    const mv = state.moviles.find(m => m.id === r.movil_id);
    const { conductor, dueno } = calcReparto(Number(r.total || 0), mv);
    totCond += conductor; totDueno += dueno;
  });

  const desde = document.getElementById('hd')?.value;
  const hasta  = document.getElementById('hh')?.value;
  const label  = desde && hasta ? `${fmtDisp(desde)} al ${fmtDisp(hasta)}` : 'Período';
  const owPct  = netoTotal > 0 ? Math.round(totDueno / netoTotal * 100) : 0;
  const drPct  = netoTotal > 0 ? Math.round(totCond  / netoTotal * 100) : 0;
  const prom   = rows.length ? Math.round(netoTotal / rows.length) : 0;

  wrap.innerHTML = `
    <div class="reparto-banner" style="margin-bottom:8px">
      <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:10px">Resumen: ${esc(label)}</div>
      <div class="period-summary">
        <div class="ps-card ps-total">
          <div class="ps-label">Neto total</div>
          <div class="ps-val">${formatMoney(netoTotal)}</div>
          <div class="ps-sub">${rows.length} registros</div>
        </div>
        <div class="ps-card ps-owner">
          <div class="ps-label">Para vos</div>
          <div class="ps-val">${formatMoney(totDueno)}</div>
          <div class="ps-sub">${owPct}%</div>
        </div>
        <div class="ps-card ps-driver">
          <div class="ps-label">Conductores</div>
          <div class="ps-val">${formatMoney(totCond)}</div>
          <div class="ps-sub">${drPct}%</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <div style="background:var(--amber-light);border-radius:var(--radius-sm);padding:10px;text-align:center">
          <div style="font-size:10px;font-weight:600;color:var(--amber);text-transform:uppercase;margin-bottom:3px">Gastos</div>
          <div style="font-size:15px;font-weight:700">${formatMoney(gastosTotal)}</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:10px;text-align:center">
          <div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:3px">Prom. turno</div>
          <div style="font-size:15px;font-weight:700">${formatMoney(prom)}</div>
        </div>
      </div>
    </div>`;
}

// ── PDF export ──────────────────────────────────────────────
function exportarPDF() {
  if (!state.historialRows.length) { alert('No hay datos para exportar.'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W   = doc.internal.pageSize.getWidth();

  const desde = document.getElementById('hd')?.value;
  const hasta  = document.getElementById('hh')?.value;
  const label  = desde && hasta ? `${fmtDisp(desde)} al ${fmtDisp(hasta)}` : 'Todos';
  const rows   = state.historialRows;

  const netoTotal   = rows.reduce((s, r) => s + Number(r.total  || 0), 0);
  const gastosTotal = rows.reduce((s, r) => s + Number(r.gastos || 0), 0);
  let totCond = 0, totDueno = 0;
  rows.forEach(r => {
    const mv = state.moviles.find(m => m.id === r.movil_id);
    const { conductor, dueno } = calcReparto(Number(r.total || 0), mv);
    totCond += conductor; totDueno += dueno;
  });

  // Header
  doc.setFillColor(24, 95, 165); doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text('FlotaAdmin', 14, 12);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text('Reporte de recaudaciones', 14, 19);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-AR')}`, W - 14, 12, { align: 'right' });
  doc.text(`Titular: ${state.profile.nombre}`, W - 14, 19, { align: 'right' });

  doc.setTextColor(26, 26, 26);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');   doc.text(`Período: ${label}`, 14, 36);
  doc.setFontSize(9);  doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
  doc.text(`${rows.length} registros`, 14, 42);

  // Summary boxes
  const bY = 46, bH = 18, bW = (W - 28) / 4 - 2;
  [
    { label: 'Neto total',          val: formatMoney(netoTotal),   bg: [235,243,251], tc: [12,68,124] },
    { label: 'Para ' + state.profile.nombre, val: formatMoney(totDueno), bg: [235,243,251], tc: [12,68,124] },
    { label: 'Para conductores',    val: formatMoney(totCond),     bg: [234,243,222], tc: [39,80,10]  },
    { label: 'Gastos',              val: formatMoney(gastosTotal), bg: [250,238,218], tc: [99,56,6]   },
  ].forEach((b, i) => {
    const x = 14 + i * (bW + 2.5);
    doc.setFillColor(...b.bg); doc.roundedRect(x, bY, bW, bH, 2, 2, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...b.tc);
    doc.text(b.label, x + bW / 2, bY + 5, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(b.val, x + bW / 2, bY + 13, { align: 'center' });
  });

  const tableData = rows.map(r => {
    const mv = state.moviles.find(m => m.id === r.movil_id);
    const { conductor, dueno, pct } = calcReparto(Number(r.total || 0), mv);
    return [
      r.fecha, r.turno, r.movil_numero,
      formatMoney(r.efectivo), formatMoney(r.qr), formatMoney(r.tarjeta),
      formatMoney(r.vales_ypf), formatMoney(r.vales_comunes), formatMoney(r.apps),
      '-' + formatMoney(r.gastos), formatMoney(r.total),
      Math.round(pct * 100) + '%', formatMoney(conductor), formatMoney(dueno),
    ];
  });

  doc.autoTable({
    startY: bY + bH + 6,
    head:   [['Fecha','Turno','Móvil','Efectivo','QR','Tarjeta','V.YPF','V.Com','Apps','Gastos','Neto','%','Cond.','Dueño']],
    body:   tableData,
    styles:           { fontSize: 6.5, cellPadding: 2, font: 'helvetica' },
    headStyles:       { fillColor: [24,95,165], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [248,249,250] },
    margin: { left: 7, right: 7 },
    didDrawPage: data => {
      doc.setFontSize(7); doc.setTextColor(150,150,150);
      doc.text(
        `FlotaAdmin — ${state.profile.nombre} — Pág. ${data.pageNumber}`,
        W / 2, doc.internal.pageSize.getHeight() - 6,
        { align: 'center' }
      );
    },
  });

  const fY = doc.lastAutoTable.finalY + 6;
  doc.setFillColor(24, 95, 165); doc.roundedRect(7, fY, W - 14, 12, 2, 2, 'F');
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(255,255,255);
  doc.text(`NETO: ${formatMoney(netoTotal)}`, 14, fY + 7.5);
  doc.text(`DUEÑO: ${formatMoney(totDueno)}   COND: ${formatMoney(totCond)}`, W - 14, fY + 7.5, { align: 'right' });

  const slug = state.profile.nombre.toLowerCase().replace(/ /g, '_');
  doc.save(`flota_${slug}_${desde || 'all'}_${hasta || 'all'}.pdf`);
}
