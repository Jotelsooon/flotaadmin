import { sb }           from './supabase.js';
import { showScreen, loadProfile, doLogout, setupAuthListeners } from './auth.js';
import { setupNav, showPage, registerRoutes }  from './nav.js';
import { renderDashboard } from './dashboard.js';
import { renderCarga }     from './carga.js';
import { renderHistorial } from './historial.js';
import { renderMoviles }   from './moviles.js';
import { renderUsuarios }  from './usuarios.js';
import { state }           from './state.js';

// ── Wire up routes before any auth event fires ──────────────
registerRoutes({
  dashboard: renderDashboard,
  carga:     renderCarga,
  historial: renderHistorial,
  moviles:   renderMoviles,
  usuarios:  renderUsuarios,
});

// ── Auth event listener ─────────────────────────────────────
let _loadingProfile = false;

sb.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session && !state.profile && !_loadingProfile) {
    _loadingProfile = true;
    await loadProfile(session.user, _onProfileReady);
    _loadingProfile = false;
  }
  if (event === 'SIGNED_OUT') {
    state.profile = null;
    showScreen('login');
  }
});

function _onProfileReady() {
  setupNav();
  const startPage = state.profile.rol === 'titular' ? 'dashboard' : 'carga';
  showPage(startPage);
}

// ── Static UI setup ─────────────────────────────────────────
setupAuthListeners();

// Date display in desktop topbar
const today = new Date();
const dtDate = document.getElementById('dt-date');
if (dtDate) {
  dtDate.textContent = today.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}
