import { sb }              from './supabase.js';
import { state }           from './state.js';
import { esc, setLoading } from './utils.js';

export async function renderSuperadmin() {
  const el = document.getElementById('main-content');
  el.innerHTML = '<div class="loading">Cargando...</div>';

  const [{ data: solicitudes, error: se }, { data: perfiles, error: pe }] = await Promise.all([
    sb.from('solicitudes_rol').select('*').order('created_at', { ascending: false }),
    sb.from('perfiles').select('*').order('nombre'),
  ]);

  if (se || pe) {
    el.innerHTML = `<div style="padding:24px;color:var(--red);font-size:13px">Error al cargar datos: ${esc((se || pe).message)}</div>`;
    return;
  }

  const pending = (solicitudes || []).filter(s => s.estado === 'pendiente');
  const history = (solicitudes || []).filter(s => s.estado !== 'pendiente');

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Solicitudes de rol Titular</h3>
        <span class="badge ta">${pending.length} pendiente${pending.length !== 1 ? 's' : ''}</span>
      </div>
      <div id="sa-solicitudes" style="padding:16px">
        ${pending.length === 0
          ? '<p style="font-size:13px;color:var(--muted);text-align:center;padding:20px 0">No hay solicitudes pendientes.</p>'
          : pending.map(s => _solCard(s)).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Todos los usuarios</h3></div>
      <div class="table-wrap">
        <table id="sa-users-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario / Email</th>
              <th>Rol actual</th>
              <th>Cambiar rol</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${(perfiles || []).map(p => _userRow(p)).join('')}
          </tbody>
        </table>
      </div>
    </div>

    ${history.length > 0 ? `
    <div class="card">
      <div class="card-header"><h3>Historial de solicitudes</h3></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Email</th><th>Fecha</th><th>Estado</th></tr></thead>
          <tbody>
            ${history.map(s => `
              <tr>
                <td>${esc(s.nombre)}</td>
                <td style="color:var(--muted)">${esc(s.email)}</td>
                <td>${new Date(s.created_at).toLocaleDateString('es-AR')}</td>
                <td><span class="badge ${s.estado === 'aprobada' ? 'plus' : 'ta'}">${s.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}
  `;

  document.getElementById('sa-solicitudes')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, solId, userId } = btn.dataset;
    setLoading(btn, true);
    if (action === 'aprobar')   await _aprobar(solId, userId, btn);
    if (action === 'rechazar')  await _rechazar(solId, btn);
  });

  document.getElementById('sa-users-table')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action="save-rol"]');
    if (!btn) return;
    const { userId } = btn.dataset;
    const sel = document.getElementById(`rol-sel-${userId}`);
    if (!sel) return;
    setLoading(btn, true);
    await _cambiarRol(userId, sel.value, btn);
  });
}

// ── Private helpers ──────────────────────────────────────────

function _solCard(s) {
  return `
    <div class="sol-card" id="sol-${s.id}">
      <div class="sol-info">
        <div style="font-weight:600;font-size:14px">${esc(s.nombre)}</div>
        <div style="font-size:12px;color:var(--muted)">${esc(s.email)}</div>
        ${s.mensaje ? `<div style="font-size:12px;margin-top:6px;color:var(--subtle);font-style:italic">"${esc(s.mensaje)}"</div>` : ''}
        <div style="font-size:11px;color:var(--muted);margin-top:4px">
          ${new Date(s.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0">
        <button class="btn green sm" data-action="aprobar" data-sol-id="${s.id}" data-user-id="${s.user_id}">Aprobar</button>
        <button class="btn danger sm" data-action="rechazar" data-sol-id="${s.id}">Rechazar</button>
      </div>
    </div>`;
}

function _userRow(p) {
  const roles = ['superadmin', 'titular', 'encargado', 'chofer'];
  const opts = roles.map(r =>
    `<option value="${r}"${r === p.rol ? ' selected' : ''}>${_rolLabel(r)}</option>`
  ).join('');
  return `
    <tr>
      <td>${esc(p.nombre || '–')}</td>
      <td style="color:var(--muted);font-size:12px">${esc(p.email || p.username || '–')}</td>
      <td><span class="role-pill ${p.rol}-pill">${_rolLabel(p.rol)}</span></td>
      <td><select id="rol-sel-${p.id}" class="role-select">${opts}</select></td>
      <td><button class="btn sm" data-action="save-rol" data-user-id="${p.id}">Guardar</button></td>
    </tr>`;
}

function _rolLabel(r) {
  return { superadmin: 'SuperAdmin', titular: 'Titular', encargado: 'Encargado', chofer: 'Chofer' }[r] || r;
}

async function _aprobar(solId, userId, btn) {
  const { error: e1 } = await sb.from('solicitudes_rol').update({
    estado: 'aprobada',
    reviewed_at: new Date().toISOString(),
    reviewed_by: state.profile.id,
  }).eq('id', solId);
  if (e1) { alert('Error: ' + e1.message); setLoading(btn, false); return; }

  const { error: e2 } = await sb.from('perfiles').update({ rol: 'titular' }).eq('id', userId);
  if (e2) { alert('Error al actualizar perfil: ' + e2.message); setLoading(btn, false); return; }

  document.getElementById(`sol-${solId}`)?.remove();
  _checkEmptySolicitudes();
}

async function _rechazar(solId, btn) {
  const { error } = await sb.from('solicitudes_rol').update({
    estado: 'rechazada',
    reviewed_at: new Date().toISOString(),
    reviewed_by: state.profile.id,
  }).eq('id', solId);
  if (error) { alert('Error: ' + error.message); setLoading(btn, false); return; }

  document.getElementById(`sol-${solId}`)?.remove();
  _checkEmptySolicitudes();
}

async function _cambiarRol(userId, newRol, btn) {
  const { error } = await sb.from('perfiles').update({ rol: newRol }).eq('id', userId);
  setLoading(btn, false);
  if (error) { alert('Error: ' + error.message); return; }
  const orig = btn.textContent;
  btn.textContent = '✓';
  setTimeout(() => { btn.textContent = orig; }, 1200);
}

function _checkEmptySolicitudes() {
  const container = document.getElementById('sa-solicitudes');
  if (container && !container.querySelector('.sol-card')) {
    container.innerHTML = '<p style="font-size:13px;color:var(--muted);text-align:center;padding:20px 0">No hay solicitudes pendientes.</p>';
    document.querySelector('#sa-solicitudes')?.closest('.card')
      ?.querySelector('.badge.ta')?.replaceWith(
        Object.assign(document.createElement('span'), { className: 'badge ta', textContent: '0 pendientes' })
      );
  }
}
