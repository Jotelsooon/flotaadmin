// ── Date helpers (timezone-safe — fixes audit H-11) ────────
// toISOString() returns UTC; these use local time instead.

export function fmtDate(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fmtDisp(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

export function subDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

export const today = new Date();

// ── Money formatting ────────────────────────────────────────
export function formatMoney(n) {
  return '$' + Number(n || 0).toLocaleString('es-AR');
}

// ── HTML escaping — prevents XSS (fixes audit H-03) ────────
// Use this on EVERY piece of user-supplied data before innerHTML.
export function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Business logic ──────────────────────────────────────────
export function calcReparto(neto, movil) {
  if (!movil) return { conductor: 0, dueno: neto, pct: 0 };
  let pct = 0;
  if (movil.reparto_tipo === 'fijo') {
    pct = Number(movil.pct_fijo || 0) / 100;
  } else {
    pct = neto > Number(movil.umbral || 60000)
      ? Number(movil.pct_alto || 35) / 100
      : Number(movil.pct_bajo || 30) / 100;
  }
  return {
    conductor: Math.round(neto * pct),
    dueno:     Math.round(neto * (1 - pct)),
    pct,
  };
}

// ── Shared table renderer (used by dashboard + historial) ───
export function tablaHTML(rows, moviles, showRep = false) {
  if (!rows.length) return '<p style="padding:20px;font-size:13px;color:var(--muted)">Sin registros.</p>';
  const tc = { Mañana: 'tm', Tarde: 'ta', Noche: 'tn' };

  const rTh = showRep ? '<th>Conductor</th><th>Dueño</th>' : '';

  const rTd = (r) => {
    if (!showRep) return '';
    const mv = moviles.find(m => m.id === r.movil_id);
    const { conductor, dueno, pct } = calcReparto(Number(r.total || 0), mv);
    const badge = pct > 0.30 ? `<span class="badge plus" style="margin-left:4px">${Math.round(pct * 100)}%</span>` : '';
    return `<td style="color:#27500A;font-weight:500">${formatMoney(conductor)}${badge}</td>
            <td style="color:var(--blue-dark);font-weight:500">${formatMoney(dueno)}</td>`;
  };

  const iTd = (r) => {
    if (!r.imagen_url) return '<td>–</td>';
    try {
      const u = new URL(r.imagen_url);
      if (!['https:', 'http:'].includes(u.protocol)) return '<td>–</td>';
    } catch { return '<td>–</td>'; }
    return `<td><a href="${esc(r.imagen_url)}" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-size:11px">Ver</a></td>`;
  };

  const rows_html = rows.map(r => `
    <tr>
      <td>${esc(r.fecha)}</td>
      <td><span class="badge ${tc[r.turno] || ''}">${esc(r.turno)}</span></td>
      <td><strong>${esc(r.movil_numero)}</strong></td>
      <td>${formatMoney(r.efectivo)}</td>
      <td>${formatMoney(r.qr)}</td>
      <td>${formatMoney(r.tarjeta)}</td>
      <td>${formatMoney(r.vales_ypf)}</td>
      <td>${formatMoney(r.vales_comunes)}</td>
      <td>${formatMoney(r.apps)}</td>
      <td style="color:var(--red)">-${formatMoney(r.gastos)}</td>
      <td style="font-weight:700">${formatMoney(r.total)}</td>
      ${rTd(r)}${iTd(r)}
    </tr>`).join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Fecha</th><th>Turno</th><th>Móvil</th>
          <th>Efectivo</th><th>QR</th><th>Tarjeta</th>
          <th>Vales YPF</th><th>Vales</th><th>Apps</th>
          <th>Gastos</th><th>Neto</th>${rTh}<th>Foto</th>
        </tr>
      </thead>
      <tbody>${rows_html}</tbody>
    </table>`;
}

// ── UI helpers ──────────────────────────────────────────────
export function showElement(id, show, displayType = 'block') {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? displayType : 'none';
}

export function setLoading(btn, loading, label = 'Guardar') {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Guardando...' : label;
}
