import { sb }           from './supabase.js';
import { state }        from './state.js';
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_MB } from './config.js';
import { fmtDate, calcReparto, formatMoney, esc, setLoading } from './utils.js';

export function renderCarga() {
  const { rol, nombre } = state.profile;
  const el = document.getElementById('main-content');

  if (!state.moviles.length) {
    el.innerHTML = '<div style="padding:24px;text-align:center"><p style="font-size:14px;color:var(--muted)">No hay móviles configurados. El titular debe agregar móviles primero.</p></div>';
    return;
  }

  const todayStr = fmtDate(new Date());
  const opts = state.moviles.map(m =>
    `<option value="${m.id}|${esc(m.numero)}">${esc(m.numero)}${m.descripcion ? ' — ' + esc(m.descripcion) : ''}</option>`
  ).join('');

  const bannerClass = { titular: 'rb-titular', encargado: 'rb-encargado', chofer: 'rb-chofer' }[rol] || '';
  const bannerLabel = { titular: '▪ Titular', encargado: '▸ Encargado', chofer: '● Chofer' }[rol] || rol;
  const banner = `<div class="role-banner ${bannerClass}">${bannerLabel}: ${esc(nombre)}</div>`;

  const fotoField = rol === 'chofer' ? `
    <div class="form-group">
      <label>Foto del comprobante <span class="req-badge">obligatorio</span></label>
      <div class="upload-zone" id="uz">
        <input type="file" id="foto-input" accept="image/*" capture="environment"/>
        <div class="uz-icon" id="uz-icon">📷</div>
        <div class="uz-title" id="uz-title">Sacar foto o elegir imagen</div>
        <div class="uz-sub">Tocá para abrir la cámara</div>
      </div>
      <img id="foto-preview" class="preview-img" alt="Vista previa"/>
      <div id="foto-error" style="font-size:12px;color:var(--red);margin-top:5px;display:none">La foto es obligatoria.</div>
    </div>` : '';

  const repartoPreview = rol !== 'chofer' ? `
    <div style="background:var(--bg);border-top:1px solid var(--border);padding:14px 16px">
      <div class="totals-row t-cond" style="margin-bottom:8px">
        <span class="t-label"><span id="pct-label">Conductor (–)</span></span>
        <span class="t-val" id="cond-disp">$0</span>
      </div>
      <div class="totals-row t-dueno">
        <span class="t-label">Para el dueño</span>
        <span class="t-val" id="dueno-disp">$0</span>
      </div>
    </div>` : '';

  el.innerHTML = `
    ${banner}
    <div id="smsg" class="success-msg">✓ Recaudación guardada.</div>
    <div class="card">
      <div class="card-header"><h3>Nueva recaudación</h3></div>
      <div style="padding:16px">
        <div class="form-row">
          <div class="form-group">
            <label>Fecha</label>
            <input type="date" id="ff" value="${todayStr}"/>
          </div>
          <div class="form-group">
            <label>Turno</label>
            <select id="ft">
              <option>Mañana</option><option>Tarde</option><option>Noche</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Móvil</label>
          <select id="fmv"><option value="">Seleccionar...</option>${opts}</select>
        </div>
        <div style="height:1px;background:var(--border);margin:4px 0 14px"></div>
        <div class="form-row">
          <div class="form-group"><label>Efectivo ($)</label><input type="number" id="fe" placeholder="0" min="0" inputmode="numeric"/></div>
          <div class="form-group"><label>QR / Transferencia ($)</label><input type="number" id="fq" placeholder="0" min="0" inputmode="numeric"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Tarjeta ($)</label><input type="number" id="fta" placeholder="0" min="0" inputmode="numeric"/></div>
          <div class="form-group"><label>Vales YPF ($)</label><input type="number" id="fvy" placeholder="0" min="0" inputmode="numeric"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Vales comunes ($)</label><input type="number" id="fvc" placeholder="0" min="0" inputmode="numeric"/></div>
          <div class="form-group"><label>Apps (Uber/Cabify/etc.) ($)</label><input type="number" id="fap" placeholder="0" min="0" inputmode="numeric"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Gastos / Combustible ($)</label><input type="number" id="fg" placeholder="0" min="0" inputmode="numeric"/></div>
          <div class="form-group"><label>Observaciones</label><input type="text" id="fo" placeholder="Opcional"/></div>
        </div>
        ${fotoField}
      </div>
      ${repartoPreview}
      <div class="totals-footer">
        <div class="totals-row t-neto">
          <span class="t-label">Neto del turno</span>
          <span class="t-val" id="tot-disp">$0</span>
        </div>
        <button class="btn primary" id="btn-guardar" style="margin-top:10px">Guardar recaudación</button>
      </div>
    </div>`;

  // Event delegation — no inline oninput / onclick (fixes audit H-13)
  const numIds = ['fe', 'fq', 'fta', 'fvy', 'fvc', 'fap', 'fg'];
  numIds.forEach(id => document.getElementById(id)?.addEventListener('input', calcTot));
  document.getElementById('fmv')?.addEventListener('change', calcTot);
  document.getElementById('btn-guardar')?.addEventListener('click', guardar);
  document.getElementById('foto-input')?.addEventListener('change', e => previewFoto(e.target));
}

// ── Live total calc ─────────────────────────────────────────
function calcTot() {
  const g = id => +document.getElementById(id)?.value || 0;
  const neto = g('fe') + g('fq') + g('fta') + g('fvy') + g('fvc') + g('fap') - g('fg');

  document.getElementById('tot-disp').textContent = formatMoney(neto);

  const cd = document.getElementById('cond-disp');
  if (!cd) return;

  const mv = _getMovilSeleccionado();
  if (mv) {
    const { conductor, dueno, pct } = calcReparto(neto, mv);
    cd.textContent = formatMoney(conductor);
    document.getElementById('dueno-disp').textContent = formatMoney(dueno);
    document.getElementById('pct-label').textContent  = `Conductor (${Math.round(pct * 100)}%)`;
  } else {
    cd.textContent = '$0';
    document.getElementById('dueno-disp').textContent = '$0';
    document.getElementById('pct-label').textContent  = 'Conductor (seleccioná móvil)';
  }
}

// ── Photo preview ───────────────────────────────────────────
function previewFoto(input) {
  const f = input.files[0];
  if (!f) return;

  // Security fix H-12: validate MIME type and file size
  if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
    document.getElementById('foto-error').textContent = 'Formato no permitido. Usá JPG, PNG o WebP.';
    document.getElementById('foto-error').style.display = 'block';
    input.value = '';
    return;
  }
  if (f.size > MAX_PHOTO_MB * 1024 * 1024) {
    document.getElementById('foto-error').textContent = `La imagen supera el límite de ${MAX_PHOTO_MB} MB.`;
    document.getElementById('foto-error').style.display = 'block';
    input.value = '';
    return;
  }

  const preview = document.getElementById('foto-preview');
  preview.src = URL.createObjectURL(f);
  preview.style.display = 'block';
  document.getElementById('uz').classList.add('has-photo');
  document.getElementById('uz-icon').textContent  = '✓';
  document.getElementById('uz-title').textContent = 'Foto cargada';
  document.getElementById('foto-error').style.display = 'none';
}

// ── Save ────────────────────────────────────────────────────
async function guardar() {
  const { rol } = state.profile;
  const btn = document.getElementById('btn-guardar');

  const mvEl = document.getElementById('fmv');
  if (!mvEl?.value) { alert('Seleccioná un móvil'); return; }

  if (rol === 'chofer') {
    const fi = document.getElementById('foto-input');
    if (!fi?.files[0]) {
      document.getElementById('foto-error').style.display = 'block';
      return;
    }
  }

  setLoading(btn, true);

  const [mvId, mvNum] = mvEl.value.split('|');
  const titId = state.profile.rol === 'titular' ? state.profile.id : state.profile.titular_id;

  let imagen_url = null;
  const fi = document.getElementById('foto-input');
  if (fi?.files[0]) {
    const file = fi.files[0];
    const ext   = file.name.split('.').pop().toLowerCase();
    const fname = `${titId}/comprobantes/${Date.now()}_${mvId}.${ext}`;
    const { error: ue } = await sb.storage.from('recaudaciones-fotos').upload(fname, file, {
      contentType: file.type, upsert: false,
    });
    if (ue) { alert('Error al subir la foto: ' + ue.message); setLoading(btn, false); return; }
    const { data: ud, error: signErr } = await sb.storage.from('recaudaciones-fotos').createSignedUrl(fname, 365 * 24 * 60 * 60);
    if (signErr) { alert('Error al generar URL de la foto: ' + signErr.message); setLoading(btn, false); return; }
    imagen_url = ud.signedUrl;
  }
  const g = id => +document.getElementById(id)?.value || 0;

  const { error } = await sb.from('recaudaciones').insert({
    titular_id:    titId,
    movil_id:      parseInt(mvId),
    movil_numero:  mvNum,
    turno:         document.getElementById('ft').value,
    fecha:         document.getElementById('ff').value,
    efectivo:      g('fe'),
    qr:            g('fq'),
    tarjeta:       g('fta'),
    vales_ypf:     g('fvy'),
    vales_comunes: g('fvc'),
    apps:          g('fap'),
    gastos:        g('fg'),
    observaciones: document.getElementById('fo')?.value || '',
    cargado_por:   state.profile.id,
    imagen_url,
  });

  setLoading(btn, false);

  if (error) { alert('Error: ' + error.message); return; }

  const sm = document.getElementById('smsg');
  sm.style.display = 'flex';
  setTimeout(() => { sm.style.display = 'none'; }, 3000);

  // Reset fields
  ['fe', 'fq', 'fta', 'fvy', 'fvc', 'fap', 'fg', 'fo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const fip = document.getElementById('foto-input');
  if (fip) {
    fip.value = '';
    const pv = document.getElementById('foto-preview');
    if (pv) { pv.src = ''; pv.style.display = 'none'; }
    const uz = document.getElementById('uz');
    if (uz) {
      uz.classList.remove('has-photo');
      document.getElementById('uz-icon').textContent  = '📷';
      document.getElementById('uz-title').textContent = 'Sacar foto o elegir imagen';
    }
  }

  calcTot();
}

// ── Helpers ─────────────────────────────────────────────────
function _getMovilSeleccionado() {
  const el = document.getElementById('fmv');
  if (!el?.value) return null;
  const [id] = el.value.split('|');
  return state.moviles.find(m => m.id === parseInt(id)) || null;
}
