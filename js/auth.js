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
    showScreen('pending');
    return;
  }
  // Encargado without flota assignment — show pending until invited
  if (p.rol === 'encargado' && !p.titular_id) {
    showScreen('pending');
    return;
  }
  state.profile = p;
  showScreen('app');
  await loadMoviles();
  onReady();
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
  state.profile = null;
  state.moviles = [];
  state.historialRows = [];
  if (state.chartBar)      { state.chartBar.destroy();      state.chartBar      = null; }
  if (state.chartDoughnut) { state.chartDoughnut.destroy(); state.chartDoughnut = null; }
  showScreen('login');
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
  document.getElementById('btn-logout-pending')?.addEventListener('click', doLogout);

}
