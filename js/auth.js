import { sb } from './supabase.js';
import { state } from './state.js';

// ── Screen switching ────────────────────────────────────────
export function showScreen(name) {
  // name: 'login' | 'pending' | 'app'
  document.getElementById('login-screen').style.display   = name === 'login'   ? 'flex'  : 'none';
  document.getElementById('pending-screen').style.display = name === 'pending' ? 'flex'  : 'none';
  document.getElementById('app-screen').style.display     = name === 'app'     ? 'flex'  : 'none';
}

// ── Feedback helpers ────────────────────────────────────────
export function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
  document.getElementById('auth-success').style.display = 'none';
}

export function showAuthSuccess(msg) {
  const el = document.getElementById('auth-success');
  el.textContent = msg;
  el.style.display = 'flex';
  document.getElementById('auth-error').style.display = 'none';
}

// ── Tab switching ───────────────────────────────────────────
export function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.getElementById('tab-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('tab-register').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('auth-error').style.display   = 'none';
  document.getElementById('auth-success').style.display = 'none';
}

// ── Profile loader ──────────────────────────────────────────
export async function loadProfile(user, onReady) {
  const { data: p, error } = await sb.from('perfiles').select('*').eq('id', user.id).single();
  if (error || !p) {
    state.pendingUser = user;
    await renderPendingScreen(user);
    return;
  }
  if (p.rol === 'superadmin') {
    state.profile = p;
    showScreen('app');
    onReady();
    return;
  }
  if (p.rol === 'encargado' && !p.titular_id) {
    state.pendingUser = user;
    await renderPendingScreen(user);
    return;
  }
  state.profile = p;
  showScreen('app');
  await loadMoviles();
  onReady();
}

// ── Pending screen (dynamic) ─────────────────────────────────
export async function renderPendingScreen(user) {
  showScreen('pending');
  const el = document.getElementById('pending-content');
  if (!el) return;

  el.innerHTML = '<p style="padding:24px;text-align:center;color:var(--muted);font-size:13px">Cargando...</p>';

  const { data: sol } = await sb.from('solicitudes_rol')
    .select('*').eq('user_id', user.id).maybeSingle();

  let solicitudHtml = '';
  if (!sol) {
    solicitudHtml = `
      <div class="sol-request-box">
        <p style="font-size:13px;color:var(--subtle);margin:0 0 12px">¿Querés gestionar tu propia flota como Titular?</p>
        <div class="form-group">
          <label for="sol-msg">Mensaje para el administrador <span style="font-size:11px;color:var(--muted)">(opcional)</span></label>
          <textarea id="sol-msg" rows="2" placeholder="Ej: Tengo 3 taxis y quiero gestionar mi propia flota..."></textarea>
        </div>
        <button class="btn primary sm" id="btn-sol-titular">Solicitar rol de Titular</button>
      </div>`;
  } else if (sol.estado === 'pendiente') {
    solicitudHtml = `
      <div class="success-msg" style="display:flex">
        Tu solicitud para ser Titular está siendo revisada por el administrador.
      </div>`;
  } else if (sol.estado === 'rechazada') {
    solicitudHtml = `
      <div class="error-msg-box" style="display:block">
        Tu solicitud fue rechazada por el administrador.
      </div>
      <div class="sol-request-box" style="margin-top:12px">
        <p style="font-size:13px;color:var(--subtle);margin:0 0 12px">Podés volver a solicitar:</p>
        <div class="form-group">
          <label for="sol-msg">Mensaje <span style="font-size:11px;color:var(--muted)">(opcional)</span></label>
          <textarea id="sol-msg" rows="2"></textarea>
        </div>
        <button class="btn primary sm" id="btn-sol-titular">Volver a solicitar</button>
      </div>`;
  } else if (sol.estado === 'aprobada') {
    solicitudHtml = `
      <div class="success-msg" style="display:flex">
        Tu solicitud fue aprobada. Cerrá sesión y volvé a ingresar para acceder como Titular.
      </div>`;
  }

  el.innerHTML = `
    <div class="pi" aria-hidden="true">⏳</div>
    <h3>Cuenta pendiente</h3>
    <p>Tu cuenta fue creada como <strong>Encargado</strong>. Pedile al titular el link de invitación para unirte a su flota.</p>
    <div style="width:100%;max-width:340px;margin-top:16px;text-align:left">
      ${solicitudHtml}
    </div>
    <button class="btn sm" id="btn-logout-pending" style="margin:20px auto 0;display:flex">Volver al login</button>
  `;

  document.getElementById('btn-logout-pending')?.addEventListener('click', doLogout);
  document.getElementById('btn-sol-titular')?.addEventListener('click', () => _enviarSolicitud(user));
}

async function _enviarSolicitud(user) {
  const btn = document.getElementById('btn-sol-titular');
  if (btn) btn.disabled = true;
  const msg = document.getElementById('sol-msg')?.value.trim() || null;
  const nombre = user.user_metadata?.nombre || user.email?.split('@')[0] || 'Sin nombre';

  const { data: existing } = await sb.from('solicitudes_rol')
    .select('id').eq('user_id', user.id).maybeSingle();

  let error;
  if (existing) {
    ({ error } = await sb.from('solicitudes_rol').update({
      estado:     'pendiente',
      mensaje:    msg,
      created_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: null,
    }).eq('id', existing.id));
  } else {
    ({ error } = await sb.from('solicitudes_rol').insert({
      user_id:       user.id,
      nombre,
      email:         user.email,
      rol_solicitado: 'titular',
      mensaje:       msg,
    }));
  }

  if (error) {
    if (btn) btn.disabled = false;
    alert('Error al enviar solicitud: ' + error.message);
    return;
  }

  await renderPendingScreen(user);
}

export async function loadMoviles() {
  const titId = state.profile.rol === 'titular' ? state.profile.id : state.profile.titular_id;
  if (!titId) { state.moviles = []; return; }
  const { data } = await sb.from('moviles').select('*')
    .eq('titular_id', titId).eq('activo', true).order('numero');
  state.moviles = data || [];
}

// ── Auth actions ────────────────────────────────────────────
export async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;
  if (!email || !pass) { showAuthError('Ingresá email y contraseña.'); return; }
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { showAuthError('Email o contraseña incorrectos.'); return; }
  // loadProfile is called via onAuthStateChange
}

export async function doRegister() {
  const nombre    = document.getElementById('r-nombre').value.trim();
  const username  = document.getElementById('r-username').value.trim().toLowerCase();
  const email     = document.getElementById('r-email').value.trim();
  const telefono  = document.getElementById('r-telefono').value.trim();
  const pass      = document.getElementById('r-pass').value;
  if (!nombre || !username || !email || !pass) { showAuthError('Completá nombre, usuario, email y contraseña.'); return; }
  if (pass.length < 6) { showAuthError('La contraseña debe tener al menos 6 caracteres.'); return; }

  const { data, error } = await sb.auth.signUp({
    email,
    password: pass,
    options: { data: { nombre, username } },
  });
  if (error) { showAuthError('Error: ' + error.message); return; }
  if (data.user) {
    await sb.from('perfiles').upsert(
      { id: data.user.id, nombre, username, telefono: telefono || null, rol: 'encargado' },
      { onConflict: 'id', ignoreDuplicates: true }
    );
    showAuthSuccess('Cuenta creada. Pedile al titular el link de invitación para unirte a su flota.');
    ['r-nombre', 'r-username', 'r-email', 'r-telefono', 'r-pass'].forEach(id => {
      document.getElementById(id).value = '';
    });
  }
}

export async function doLogout() {
  await sb.auth.signOut();
  state.profile     = null;
  state.pendingUser = null;
  state.moviles     = [];
  state.historialRows = [];
  if (state.chartBar)      { state.chartBar.destroy();      state.chartBar      = null; }
  if (state.chartDoughnut) { state.chartDoughnut.destroy(); state.chartDoughnut = null; }
  showScreen('login');
  switchAuthTab('login');
  document.getElementById('auth-error').style.display   = 'none';
  document.getElementById('auth-success').style.display = 'none';
}

// ── Event listeners (call once from app.js) ─────────────────
export function setupAuthListeners() {
  // Tab buttons
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
  });

  // Enter key on login fields
  ['l-pass', 'l-email'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });
  });
  ['r-pass', 'r-email', 'r-nombre', 'r-username', 'r-telefono'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doRegister();
    });
  });

  // Login / register buttons (replaces inline onclick)
  document.getElementById('btn-login')?.addEventListener('click', doLogin);
  document.getElementById('btn-register')?.addEventListener('click', doRegister);

}
