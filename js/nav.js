import { state }  from './state.js';
import { IC }     from './icons.js';
import { esc }    from './utils.js';

// Route registry — populated by app.js to avoid circular deps.
const routes = {};

export function registerRoutes(map) {
  Object.assign(routes, map);
}

// ── Nav build ───────────────────────────────────────────────
export function setupNav() {
  const { rol, nombre } = state.profile;
  const ini = nombre.slice(0, 2).toUpperCase();
  const rl  = { titular: 'Titular', encargado: 'Encargado', chofer: 'Chofer' };

  document.getElementById('m-name').textContent       = esc(nombre);
  document.getElementById('ds-av').textContent        = ini;
  document.getElementById('ds-name').textContent      = esc(nombre);
  document.getElementById('ds-role').textContent      = rl[rol] || rol;
  document.getElementById('ds-role-label').textContent = rl[rol] || rol;

  let pages = [];
  if (rol === 'titular')   pages = ['dashboard', 'carga', 'historial', 'moviles', 'usuarios'];
  else if (rol === 'encargado') pages = ['carga', 'historial', 'usuarios'];
  else                     pages = ['carga'];

  const labels = {
    dashboard: 'Dashboard',
    carga:     'Cargar',
    historial: 'Historial',
    moviles:   'Móviles',
    usuarios:  'Usuarios',
  };

  const bottomNav  = document.getElementById('bottom-nav');
  const desktopNav = document.getElementById('ds-nav');

  // Event delegation — no inline onclick (fixes audit H-13)
  bottomNav.innerHTML = pages.map((p, i) => `
    <button class="bn-item${i === 0 ? ' active' : ''}" data-page="${p}">
      ${IC[p]}<span>${labels[p]}</span>
    </button>`).join('');

  desktopNav.innerHTML = pages.map((p, i) => `
    <button class="ds-nav-item${i === 0 ? ' active' : ''}" data-page="${p}">
      <span style="display:inline-flex;width:16px;height:16px">${IC[p]}</span>${labels[p]}
    </button>`).join('');

  bottomNav.addEventListener('click', e => {
    const btn = e.target.closest('[data-page]');
    if (btn) showPage(btn.dataset.page);
  });
  desktopNav.addEventListener('click', e => {
    const btn = e.target.closest('[data-page]');
    if (btn) showPage(btn.dataset.page);
  });

  // Logout buttons in app shell
  document.getElementById('btn-logout-app')?.addEventListener('click', async () => {
    const { doLogout } = await import('./auth.js');
    doLogout();
  });
  document.getElementById('btn-logout-ds')?.addEventListener('click', async () => {
    const { doLogout } = await import('./auth.js');
    doLogout();
  });
}

// ── Page router ─────────────────────────────────────────────
export function showPage(p) {
  // Update active state on both navs
  document.querySelectorAll('[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === p);
  });

  const titles = {
    dashboard: 'Dashboard',
    carga:     'Nueva recaudación',
    historial: 'Historial',
    moviles:   'Mis móviles',
    usuarios:  'Usuarios',
  };
  const t = titles[p] || p;
  document.getElementById('page-title').textContent = t;
  document.getElementById('dt-title').textContent   = t;
  document.getElementById('main-content').innerHTML = '<div class="loading">Cargando...</div>';

  if (routes[p]) {
    routes[p]();
  }
}
