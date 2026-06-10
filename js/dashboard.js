import { sb }           from './supabase.js';
import { state }        from './state.js';
import { COLORS }       from './config.js';
import { fmtDate, formatMoney, tablaHTML, setLoading } from './utils.js';

export async function renderDashboard() {
  const el     = document.getElementById('main-content');
  const titId  = state.profile.id;
  const today  = new Date();
  const mesStr = fmtDate(today).slice(0, 7);
  const todayStr = fmtDate(today);

  const [{ data: rows }, { data: resumenes }] = await Promise.all([
    sb.from('recaudaciones')
      .select('*').eq('titular_id', titId).order('fecha', { ascending: false }),
    sb.from('resumenes_anuales')
      .select('id, anio, generado_at')
      .eq('titular_id', titId).order('anio', { ascending: false }),
  ]);

  const all = rows || [];
  const hoy = all.filter(r => r.fecha === todayStr);
  const mes = all.filter(r => r.fecha?.startsWith(mesStr));

  const netoMes   = mes.reduce((s, r) => s + Number(r.total  || 0), 0);
  const netoHoy   = hoy.reduce((s, r) => s + Number(r.total  || 0), 0);
  const gastosMes = mes.reduce((s, r) => s + Number(r.gastos || 0), 0);
  const prom      = all.length ? Math.round(all.reduce((s, r) => s + Number(r.total || 0), 0) / all.length) : 0;

  let totCond = 0, totDueno = 0;
  mes.forEach(r => {
    const mv = state.moviles.find(m => m.id === r.movil_id);
    const { conductor, dueno } = _calcReparto(Number(r.total || 0), mv);
    totCond += conductor; totDueno += dueno;
  });

  // By-movil aggregation for bar chart
  const byM = {};
  state.moviles.forEach(m => { byM[m.numero] = 0; });
  mes.forEach(r => { if (byM[r.movil_numero] !== undefined) byM[r.movil_numero] += Number(r.total || 0); });

  // Payment type aggregation for doughnut chart
  const tE = mes.reduce((s, r) => s + Number(r.efectivo      || 0), 0);
  const tQ = mes.reduce((s, r) => s + Number(r.qr            || 0), 0);
  const tT = mes.reduce((s, r) => s + Number(r.tarjeta       || 0), 0);
  const tV = mes.reduce((s, r) => s + Number(r.vales_ypf     || 0) + Number(r.vales_comunes || 0), 0);
  const tA = mes.reduce((s, r) => s + Number(r.apps          || 0), 0);

  const ownerPct  = netoMes > 0 ? Math.round(totDueno / netoMes * 100) : 0;
  const driverPct = netoMes > 0 ? Math.round(totCond  / netoMes * 100) : 0;

  el.innerHTML = `
    <div class="metric-grid">
      <div class="metric-card mc-blue">
        <div class="lbl">Hoy</div>
        <div class="val">${formatMoney(netoHoy)}</div>
        <div class="sub">${hoy.length} registros</div>
      </div>
      <div class="metric-card mc-green">
        <div class="lbl">Neto del mes</div>
        <div class="val">${formatMoney(netoMes)}</div>
        <div class="sub">${mes.length} turnos</div>
      </div>
      <div class="metric-card mc-amber">
        <div class="lbl">Gastos mes</div>
        <div class="val">${formatMoney(gastosMes)}</div>
        <div class="sub">combustible</div>
      </div>
      <div class="metric-card mc-purple">
        <div class="lbl">Prom. turno</div>
        <div class="val">${formatMoney(prom)}</div>
        <div class="sub">${all.length} turnos</div>
      </div>
    </div>

    <div class="reparto-banner">
      <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.04em">Reparto del mes</div>
      <div class="reparto-row">
        <div class="reparto-col">
          <div class="r-label">Neto total</div>
          <div class="r-val">${formatMoney(netoMes)}</div>
          <div class="r-sub">${mes.length} turnos</div>
        </div>
        <div class="reparto-col r-owner">
          <div class="r-label">Para vos</div>
          <div class="r-val">${formatMoney(totDueno)}</div>
          <div class="r-sub">${ownerPct}%</div>
        </div>
        <div class="reparto-col r-driver">
          <div class="r-label">Conductores</div>
          <div class="r-val">${formatMoney(totCond)}</div>
          <div class="r-sub">${driverPct}%</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Por móvil — mes</h3></div>
      <div class="chart-wrap"><canvas id="cc" role="img" aria-label="Por móvil"></canvas></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Tipo de pago — mes</h3></div>
      <div class="chart-wrap"><canvas id="cp" role="img" aria-label="Tipo de pago"></canvas></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Últimas recaudaciones</h3></div>
      <div class="table-wrap">${tablaHTML(all.slice(0, 8), state.moviles, true)}</div>
    </div>`;

  _renderCharts(byM, tE, tQ, tT, tV, tA);

  if (state.profile.rol === 'titular') {
    _renderCierreAnual(el, resumenes || [], today.getFullYear(), titId);
  }
}

function _renderCharts(byM, tE, tQ, tT, tV, tA) {
  const Chart = window.Chart;
  if (!Chart) return;

  if (state.chartBar)      { state.chartBar.destroy();      state.chartBar      = null; }
  if (state.chartDoughnut) { state.chartDoughnut.destroy(); state.chartDoughnut = null; }

  state.chartBar = new Chart(document.getElementById('cc'), {
    type: 'bar',
    data: {
      labels: Object.keys(byM),
      datasets: [{ data: Object.values(byM), backgroundColor: COLORS, borderRadius: 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => '$' + ctx.raw.toLocaleString('es-AR') } },
      },
      scales: {
        x: { ticks: { font: { size: 10 } } },
        y: { ticks: { callback: v => '$' + v.toLocaleString('es-AR'), font: { size: 10 } } },
      },
    },
  });

  state.chartDoughnut = new Chart(document.getElementById('cp'), {
    type: 'doughnut',
    data: {
      labels: ['Efectivo', 'QR/Transf', 'Tarjeta', 'Vales', 'Apps'],
      datasets: [{
        data: [tE, tQ, tT, tV, tA],
        backgroundColor: ['#185FA5', '#0F6E56', '#534AB7', '#854F0B', '#993556'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => '$' + ctx.raw.toLocaleString('es-AR') } },
      },
    },
  });
}

// ── Cierre anual ─────────────────────────────────────────────
function _renderCierreAnual(el, resumenes, anioActual, titId) {
  const yaActualCerrado = resumenes.some(r => r.anio === anioActual);

  const listaHTML = resumenes.length
    ? resumenes.map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:9px 0;border-bottom:1px solid var(--border)">
          <span style="font-weight:600;font-size:14px">Año ${r.anio}</span>
          <span style="font-size:11px;color:var(--muted)">
            ${new Date(r.generado_at).toLocaleDateString('es-AR')}
          </span>
          <span style="font-size:12px;color:var(--green);font-weight:500">✓ Cerrado</span>
        </div>`).join('')
    : '<p style="font-size:13px;color:var(--muted);margin:0 0 10px">Sin cierres anteriores.</p>';

  const btnHTML = yaActualCerrado
    ? `<p style="font-size:13px;color:var(--green);margin:10px 0 0;font-weight:500">
         ✓ El año ${anioActual} ya fue cerrado.
       </p>`
    : `<button class="btn primary sm" id="btn-cerrar-anio" style="margin-top:12px">
         Cerrar año ${anioActual}
       </button>`;

  const card = document.createElement('div');
  card.className = 'card';
  card.style.marginTop = '14px';
  card.innerHTML = `
    <div class="card-header"><h3>Cierre anual</h3></div>
    <div style="padding:16px">${listaHTML}${btnHTML}</div>`;
  el.appendChild(card);

  document.getElementById('btn-cerrar-anio')
    ?.addEventListener('click', () => _cerrarAnio(titId, anioActual));
}

async function _cerrarAnio(titId, anio) {
  if (!confirm(
    `¿Cerrar el año ${anio}?\n\n` +
    `Se consolidan todas las recaudaciones del año ${anio}.\n` +
    `Los datos originales no se modifican ni eliminan.`
  )) return;

  const btn = document.getElementById('btn-cerrar-anio');
  setLoading(btn, true, `Cerrar año ${anio}`);

  // Cargar TODOS los móviles (incluso inactivos) para reparto histórico correcto
  const [{ data: rows, error: rowsErr }, { data: allMoviles }] = await Promise.all([
    sb.from('recaudaciones').select('*')
      .eq('titular_id', titId)
      .gte('fecha', `${anio}-01-01`)
      .lte('fecha', `${anio}-12-31`),
    sb.from('moviles')
      .select('id, numero, reparto_tipo, pct_fijo, pct_bajo, pct_alto, umbral')
      .eq('titular_id', titId),
  ]);

  if (rowsErr) {
    alert('Error al obtener datos: ' + rowsErr.message);
    setLoading(btn, false, `Cerrar año ${anio}`);
    return;
  }
  if (!rows || rows.length === 0) {
    alert(`No hay recaudaciones registradas para el año ${anio}.`);
    setLoading(btn, false, `Cerrar año ${anio}`);
    return;
  }

  const data_json = _buildAnualSummary(rows, anio, state.profile, allMoviles || []);

  const { error: insertErr } = await sb.from('resumenes_anuales').insert({
    titular_id: titId,
    anio,
    data_json,
    pdf_url: '',
  });

  if (insertErr) {
    alert('Error al guardar el cierre: ' + insertErr.message);
    setLoading(btn, false, `Cerrar año ${anio}`);
    return;
  }

  renderDashboard();
}

function _buildAnualSummary(rows, anio, profile, moviles) {
  let total = 0, gastos = 0, neto_dueno = 0, neto_conductores = 0;

  rows.forEach(r => {
    const n  = Number(r.total  || 0);
    total  += n;
    gastos += Number(r.gastos || 0);
    const { conductor, dueno } = _calcReparto(n, moviles.find(m => m.id === r.movil_id));
    neto_conductores += conductor;
    neto_dueno       += dueno;
  });

  // Agrupar por mes
  const mesMap = {};
  rows.forEach(r => {
    const mes = String(r.fecha).slice(0, 7);
    if (!mesMap[mes]) mesMap[mes] = { mes, total: 0, gastos: 0, dueno: 0, conductores: 0, registros: 0 };
    const n = Number(r.total || 0);
    const { conductor, dueno } = _calcReparto(n, moviles.find(m => m.id === r.movil_id));
    mesMap[mes].total       += n;
    mesMap[mes].gastos      += Number(r.gastos || 0);
    mesMap[mes].dueno       += dueno;
    mesMap[mes].conductores += conductor;
    mesMap[mes].registros++;
  });

  // Agrupar por móvil
  const movilMap = {};
  rows.forEach(r => {
    const num = r.movil_numero;
    if (!movilMap[num]) movilMap[num] = { numero: num, total: 0, registros: 0 };
    movilMap[num].total    += Number(r.total || 0);
    movilMap[num].registros++;
  });

  return {
    titular_nombre: profile.nombre,
    anio,
    resumen: { total, gastos, neto_dueno, neto_conductores, registros: rows.length },
    por_mes:   Object.values(mesMap).sort((a, b) => a.mes.localeCompare(b.mes)),
    por_movil: Object.values(movilMap).sort((a, b) => b.total - a.total),
    generado_at: new Date().toISOString(),
  };
}

// Local helper — avoids importing calcReparto from utils just to re-read state.moviles
function _calcReparto(neto, movil) {
  if (!movil) return { conductor: 0, dueno: neto };
  let pct = 0;
  if (movil.reparto_tipo === 'fijo') {
    pct = Number(movil.pct_fijo || 0) / 100;
  } else {
    pct = neto > Number(movil.umbral || 60000)
      ? Number(movil.pct_alto || 35) / 100
      : Number(movil.pct_bajo || 30) / 100;
  }
  return { conductor: Math.round(neto * pct), dueno: Math.round(neto * (1 - pct)) };
}
