import { sb }     from './supabase.js';
import { state }  from './state.js';
import { loadMoviles } from './auth.js';
import { esc }    from './utils.js';

export async function renderMoviles() {
  const el = document.getElementById('main-content');
  const { data: mv } = await sb.from('moviles').select('*')
    .eq('titular_id', state.profile.id).order('numero');
  const lista = mv || [];

  const count = lista.length;
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-size:13px;color:var(--muted)">${count} móvil${count !== 1 ? 'es' : ''} configurado${count !== 1 ? 's' : ''}</div>
      <button class="btn primary sm" id="btn-nuevo-movil">+ Nuevo móvil</button>
    </div>
    <div id="nuevo-movil-form" style="display:none"></div>
    <div id="moviles-lista">
      ${lista.map(m => _movilCardHTML(m)).join('')}
      ${!lista.length ? '<p style="text-align:center;color:var(--muted);padding:40px;font-size:14px">No tenés móviles aún. Creá el primero.</p>' : ''}
    </div>`;

  // Event delegation — no inline onclick (fixes audit H-13)
  document.getElementById('btn-nuevo-movil')?.addEventListener('click', () => _showForm());

  document.getElementById('moviles-lista')?.addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-edit-id]');
    const delBtn  = e.target.closest('[data-del-id]');
    if (editBtn) {
      const id = parseInt(editBtn.dataset.editId);
      const mv = lista.find(m => m.id === id);
      if (mv) { _showForm(mv); document.getElementById('nuevo-movil-form').scrollIntoView({ behavior: 'smooth' }); }
    }
    if (delBtn) {
      const id = parseInt(delBtn.dataset.delId);
      await _eliminar(id);
    }
  });
}

// ── Card HTML ────────────────────────────────────────────────
function _movilCardHTML(m) {
  const repartoLabel = m.reparto_tipo === 'fijo'
    ? `${esc(String(m.pct_fijo))}% fijo`
    : `${esc(String(m.pct_bajo))}%/${esc(String(m.pct_alto))}%`;

  const repartoDesc = m.reparto_tipo === 'fijo'
    ? `Conductor lleva el ${esc(String(m.pct_fijo))}% siempre`
    : `Conductor lleva ${esc(String(m.pct_bajo))}% hasta $${Number(m.umbral).toLocaleString('es-AR')}, luego ${esc(String(m.pct_alto))}%`;

  return `
    <div class="movil-card">
      <div class="movil-card-header">
        <div>
          <div class="movil-num">Móvil ${esc(m.numero)}</div>
          ${m.conductor_nombre
            ? `<div class="movil-desc">${esc(m.conductor_nombre)}${m.conductor_iniciales ? ` (${esc(m.conductor_iniciales)})` : ''}</div>`
            : m.descripcion ? `<div class="movil-desc">${esc(m.descripcion)}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="reparto-chip">${repartoLabel}</span>
          <button class="btn sm" data-edit-id="${m.id}" style="padding:6px 10px">✏️</button>
          <button class="btn sm danger" data-del-id="${m.id}" style="padding:6px 10px">🗑</button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--muted)">${repartoDesc}</div>
    </div>`;
}

// ── Form ─────────────────────────────────────────────────────
function _showForm(editData = null) {
  const wrap   = document.getElementById('nuevo-movil-form');
  if (!wrap) return;
  const isEdit = !!editData;
  const d = editData || { numero: '', descripcion: '', conductor_nombre: '', conductor_iniciales: '', reparto_tipo: 'fijo', pct_fijo: 30, pct_bajo: 30, pct_alto: 35, umbral: 60000 };

  wrap.style.display = 'block';
  wrap.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div class="card-header">
        <h3>${isEdit ? 'Editar móvil' : 'Nuevo móvil'}</h3>
        <button class="btn sm" id="btn-close-form">✕</button>
      </div>
      <div style="padding:16px">
        <div class="form-row">
          <div class="form-group">
            <label>Número / Identificador</label>
            <input type="text" id="nm-num" placeholder="ej: 01 o ABC123" value="${esc(String(d.numero))}"
              ${isEdit ? 'readonly style="background:var(--bg)"' : ''}/>
          </div>
          <div class="form-group">
            <label>Descripción (opcional)</label>
            <input type="text" id="nm-desc" placeholder="ej: Ford Ka blanco" value="${esc(String(d.descripcion || ''))}"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Conductor asignado</label>
            <input type="text" id="nm-conductor-nombre" placeholder="ej: Carlos Medina"
                   value="${esc(String(d.conductor_nombre || ''))}"/>
          </div>
          <div class="form-group">
            <label>Iniciales</label>
            <input type="text" id="nm-conductor-iniciales" placeholder="ej: CM" maxlength="4"
                   value="${esc(String(d.conductor_iniciales || ''))}"/>
          </div>
        </div>
        <div class="form-group">
          <label>Esquema de reparto</label>
          <select id="nm-tipo">
            <option value="fijo"   ${d.reparto_tipo === 'fijo'   ? 'selected' : ''}>% Fijo siempre</option>
            <option value="umbral" ${d.reparto_tipo === 'umbral' ? 'selected' : ''}>% con umbral (sube si supera monto)</option>
          </select>
        </div>
        <div id="rep-fijo" style="${d.reparto_tipo === 'fijo' ? '' : 'display:none'}">
          <div class="form-group">
            <label>% del conductor (0 = no lleva nada)</label>
            <input type="number" id="nm-pfijo" min="0" max="100" value="${esc(String(d.pct_fijo))}" placeholder="30"/>
          </div>
        </div>
        <div id="rep-umbral" style="${d.reparto_tipo === 'umbral' ? '' : 'display:none'}">
          <div class="form-row">
            <div class="form-group">
              <label>% conductor (bajo)</label>
              <input type="number" id="nm-pbajo" min="0" max="100" value="${esc(String(d.pct_bajo))}" placeholder="30"/>
            </div>
            <div class="form-group">
              <label>% conductor (alto)</label>
              <input type="number" id="nm-palto" min="0" max="100" value="${esc(String(d.pct_alto))}" placeholder="35"/>
            </div>
          </div>
          <div class="form-group">
            <label>Umbral ($) — a partir de aquí aplica % alto</label>
            <input type="number" id="nm-umbral" min="0" value="${esc(String(d.umbral))}" inputmode="numeric" placeholder="60000"/>
          </div>
        </div>
      </div>
      <div style="padding:0 16px 16px">
        <button class="btn primary" id="btn-save-movil"
          data-mode="${isEdit ? 'edit' : 'new'}" data-id="${isEdit ? editData.id : ''}">
          Guardar
        </button>
      </div>
    </div>`;

  document.getElementById('btn-close-form')?.addEventListener('click', () => { wrap.style.display = 'none'; });
  document.getElementById('nm-tipo')?.addEventListener('change', _toggleRepartoForm);
  document.getElementById('btn-save-movil')?.addEventListener('click', async e => {
    const btn = e.currentTarget;
    if (btn.dataset.mode === 'edit') await _guardarEdicion(parseInt(btn.dataset.id));
    else await _guardarNuevo();
  });
}

function _toggleRepartoForm() {
  const t = document.getElementById('nm-tipo').value;
  document.getElementById('rep-fijo').style.display   = t === 'fijo'   ? 'block' : 'none';
  document.getElementById('rep-umbral').style.display = t === 'umbral' ? 'block' : 'none';
}

// ── CRUD ─────────────────────────────────────────────────────
async function _guardarNuevo() {
  const num = document.getElementById('nm-num').value.trim();
  if (!num) { alert('El número del móvil es obligatorio'); return; }
  const tipo = document.getElementById('nm-tipo').value;
  const payload = _buildPayload(tipo);
  payload.titular_id = state.profile.id;
  payload.numero     = num;
  const { error } = await sb.from('moviles').insert(payload);
  if (error) { alert('Error: ' + error.message); return; }
  await loadMoviles();
  renderMoviles();
}

async function _guardarEdicion(id) {
  const tipo    = document.getElementById('nm-tipo').value;
  const payload = _buildPayload(tipo);
  payload.descripcion = document.getElementById('nm-desc').value;
  const { error } = await sb.from('moviles').update(payload).eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  await loadMoviles();
  renderMoviles();
}

async function _eliminar(id) {
  if (!confirm('¿Eliminar este móvil? Se desactivará pero no se borrarán las recaudaciones existentes.')) return;
  await sb.from('moviles').update({ activo: false }).eq('id', id);
  await loadMoviles();
  renderMoviles();
}

function _buildPayload(tipo) {
  return {
    reparto_tipo:        tipo,
    pct_fijo:            tipo === 'fijo'   ? +document.getElementById('nm-pfijo').value  : 30,
    pct_bajo:            tipo === 'umbral' ? +document.getElementById('nm-pbajo').value  : 30,
    pct_alto:            tipo === 'umbral' ? +document.getElementById('nm-palto').value  : 35,
    umbral:              tipo === 'umbral' ? +document.getElementById('nm-umbral').value : 60000,
    conductor_nombre:    document.getElementById('nm-conductor-nombre')?.value.trim()          || '',
    conductor_iniciales: document.getElementById('nm-conductor-iniciales')?.value.trim().toUpperCase() || '',
  };
}
