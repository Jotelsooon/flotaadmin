import { sb }    from './supabase.js';
import { state } from './state.js';
import { esc }   from './utils.js';

export async function renderUsuarios() {
  const el = document.getElementById('main-content');
  const titId = state.profile.rol === 'titular' ? state.profile.id : state.profile.titular_id;
  const { data: users } = await sb.from('perfiles').select('*')
    .eq('titular_id', titId).order('created_at');
  const lista = users || [];

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-size:13px;color:var(--muted)">${lista.length} usuario${lista.length !== 1 ? 's' : ''}</div>
      <button class="btn primary sm" id="btn-nuevo-chofer">+ Nuevo chofer</button>
    </div>
    <div id="nuevo-chofer-form" style="display:none;margin-bottom:14px"></div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Nombre</th><th>DNI</th><th>Usuario</th><th>Teléfono</th><th>Rol</th><th>Acción</th></tr>
          </thead>
          <tbody id="usuarios-tbody">
            ${lista.map(u => _userRowHTML(u)).join('')}
            ${!lista.length ? '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">No tenés usuarios creados aún.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById('btn-nuevo-chofer')?.addEventListener('click', _showNuevoChoferForm);

  document.getElementById('usuarios-tbody')?.addEventListener('change', async e => {
    const sel = e.target.closest('select[data-user-id]');
    if (sel) await _cambiarRol(sel.dataset.userId, sel.value);
  });
}

// ── Row HTML ─────────────────────────────────────────────────
function _userRowHTML(u) {
  const badges = {
    titular:   '<span class="badge rol-titular">Titular</span>',
    encargado: '<span class="badge rol-encargado">Encargado</span>',
    chofer:    '<span class="badge rol-chofer">Chofer</span>',
  };
  const badge = badges[u.rol] || esc(u.rol);

  return `
    <tr>
      <td>${esc(u.nombre)}</td>
      <td style="font-family:monospace;font-size:11px">${esc(u.dni || '—')}</td>
      <td style="font-family:monospace;font-size:11px">${esc(u.username || '')}</td>
      <td style="font-size:12px">${esc(u.telefono || '—')}</td>
      <td>${badge}</td>
      <td>
        <select data-user-id="${esc(u.id)}"
          style="padding:4px 8px;font-size:12px;border:1px solid var(--border);border-radius:5px">
          <option value="encargado" ${u.rol === 'encargado' ? 'selected' : ''}>Encargado</option>
          <option value="chofer"    ${u.rol === 'chofer'    ? 'selected' : ''}>Chofer</option>
        </select>
      </td>
    </tr>`;
}

// ── Formulario nuevo chofer ───────────────────────────────────
function _showNuevoChoferForm() {
  const wrap = document.getElementById('nuevo-chofer-form');
  wrap.style.display = 'block';
  wrap.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Nuevo chofer</h3>
        <button class="btn sm" id="btn-close-chofer">✕</button>
      </div>
      <div style="padding:16px">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre completo <span class="req-badge">*</span></label>
            <input type="text" id="nc-nombre" placeholder="Juan Pérez"/>
          </div>
          <div class="form-group">
            <label>DNI <span class="req-badge">*</span></label>
            <input type="text" id="nc-dni" placeholder="12345678" inputmode="numeric" maxlength="8"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Email <span class="req-badge">*</span></label>
            <input type="email" id="nc-email" placeholder="juan@email.com" inputmode="email"/>
          </div>
          <div class="form-group">
            <label>Teléfono <span style="font-size:11px;color:var(--muted)">(opcional)</span></label>
            <input type="tel" id="nc-telefono" placeholder="11 2345-6789" inputmode="tel"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Nombre de usuario <span class="req-badge">*</span></label>
            <input type="text" id="nc-username" placeholder="ej: chofer_juan" autocomplete="off"/>
          </div>
          <div class="form-group">
            <label>Contraseña temporal <span class="req-badge">*</span></label>
            <input type="password" id="nc-pass" placeholder="Mínimo 6 caracteres"/>
          </div>
        </div>
        <p style="font-size:12px;color:var(--muted);margin:4px 0 0">
          El chofer inicia sesión con su email y esta contraseña. El DNI impide que cree otra cuenta.
        </p>
      </div>
      <div style="padding:0 16px 16px">
        <button class="btn primary" id="btn-crear-chofer">Crear chofer</button>
      </div>
    </div>`;

  document.getElementById('btn-close-chofer')?.addEventListener('click', () => { wrap.style.display = 'none'; });
  document.getElementById('btn-crear-chofer')?.addEventListener('click', _crearChofer);
}

// ── Crear chofer ─────────────────────────────────────────────
async function _crearChofer() {
  const nombre   = document.getElementById('nc-nombre').value.trim();
  const dni      = document.getElementById('nc-dni').value.trim();
  const email    = document.getElementById('nc-email').value.trim();
  const telefono = document.getElementById('nc-telefono').value.trim();
  const username = document.getElementById('nc-username').value.trim().toLowerCase();
  const pass     = document.getElementById('nc-pass').value;

  if (!nombre || !dni || !email || !username || !pass) {
    alert('Completá todos los campos obligatorios (*)');
    return;
  }
  if (!/^\d{7,8}$/.test(dni)) {
    alert('El DNI debe tener 7 u 8 dígitos numéricos');
    return;
  }
  if (pass.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres');
    return;
  }

  const btn = document.getElementById('btn-crear-chofer');
  btn.disabled = true;
  btn.textContent = 'Creando...';

  // Verificar DNI único antes de crear el usuario auth
  const { data: dniCheck } = await sb.from('perfiles').select('id').eq('dni', dni).maybeSingle();
  if (dniCheck) {
    alert('Ya existe un usuario registrado con ese DNI.');
    btn.disabled = false;
    btn.textContent = 'Crear chofer';
    return;
  }

  // Guardar sesión actual (Titular/Encargado) para restaurarla después del signUp
  const { data: { session: sesionActual } } = await sb.auth.getSession();

  const { data, error } = await sb.auth.signUp({
    email,
    password: pass,
    options: { data: { nombre, username } },
  });

  if (error) {
    // Restaurar sesión si cambió
    if (sesionActual) {
      await sb.auth.setSession({
        access_token:  sesionActual.access_token,
        refresh_token: sesionActual.refresh_token,
      });
    }
    alert('Error al crear el usuario: ' + error.message);
    btn.disabled = false;
    btn.textContent = 'Crear chofer';
    return;
  }

  // Si signUp cambió la sesión activa, restaurar la del Titular/Encargado
  const { data: { session: sesionTras } } = await sb.auth.getSession();
  if (sesionActual && sesionTras?.user?.id !== sesionActual.user?.id) {
    await sb.auth.setSession({
      access_token:  sesionActual.access_token,
      refresh_token: sesionActual.refresh_token,
    });
  }

  if (data.user) {
    const titId = state.profile.rol === 'titular'
      ? state.profile.id
      : state.profile.titular_id;

    const { error: profileError } = await sb.from('perfiles').insert({
      id:         data.user.id,
      nombre,
      username,
      dni,
      telefono:   telefono || null,
      rol:        'chofer',
      titular_id: titId,
    });

    if (profileError) {
      alert('Usuario de acceso creado pero hubo un error al guardar el perfil: ' + profileError.message + '\n\nContactá al administrador.');
      btn.disabled = false;
      btn.textContent = 'Crear chofer';
      return;
    }
  }

  btn.disabled = false;
  btn.textContent = 'Crear chofer';
  document.getElementById('nuevo-chofer-form').style.display = 'none';
  renderUsuarios();
}

// ── Cambiar rol ───────────────────────────────────────────────
async function _cambiarRol(userId, nuevoRol) {
  if (!confirm(`¿Cambiar el rol de este usuario a "${nuevoRol}"?`)) {
    renderUsuarios();
    return;
  }
  const { error } = await sb.from('perfiles').update({ rol: nuevoRol }).eq('id', userId);
  if (error) alert('Error: ' + error.message);
  renderUsuarios();
}
