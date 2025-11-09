// frontend/js/dashboard.js  (cargar como <script type="module">)
const API = '../backend/api/';
const $  = s => document.querySelector(s);
const txt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

async function jget(url){
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (j && j.ok === false) throw new Error(j.error || 'API_ERROR');
  return j;
}

// ---------- Usuario ----------
async function loadMe(){
  const j = await jget(`${API}usuarios.php?action=me`);
  const u = j.user || {};
  const name = u.Usuario || (u.Correo ? u.Correo.split('@')[0] : 'usuario');
  txt('greetName', name);
  txt('greetEmail', u.Correo || '');
  const av = document.getElementById('dashAvatar');
  if (av) av.textContent = (name[0] || 'U').toUpperCase();
}

// ---------- Horas del mes ----------
const ym = d => {
  const dt = (d instanceof Date) ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
};
async function loadHoras(){
  const j = await jget(`${API}cooperativa.php?action=hours_list`);

  // año/mes actuales
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1; // 1..12

  let totalMin = 0;

  for (const it of (j.items || [])) {
    // --- 1) Fecha del registro y filtro por mes actual ---
    let fraw = (it.Fecha ?? it.fecha ?? it.Fecha_Registro ?? it.fecha_registro ?? '').toString();
    if (!fraw) continue;

    // soporta "YYYY-MM-DD" o "YYYY-MM-DD HH:MM:SS"
    const ymd = fraw.slice(0, 10).split('-').map(n => parseInt(n,10));
    if (ymd.length !== 3 || ymd.some(Number.isNaN)) continue;
    const [y, m] = ymd;
    if (y !== curY || m !== curM) continue;

    // --- 2) Minutos del registro ---
    // a) si viene un campo directo de minutos, úsalo
    const minuteCandidates = [it.min, it.Min, it.MIN, it.cantidad, it.Cantidad, it.Minutos, it.minutes];
    let mins = 0;
    for (const c of minuteCandidates) {
      if (c !== undefined && c !== null && c !== '' && !Number.isNaN(Number(c))) {
        mins = Number(c);
        break;
      }
    }

    // b) si no, calculá con Desde/Hasta (soporta cruce de día)
    if (!mins) {
      const d = (it.Desde ?? it.desde ?? '').toString();
      const h = (it.Hasta ?? it.hasta ?? '').toString();
      if (d && h && d.includes(':') && h.includes(':')) {
        const toMin = s => { const [hh, mm] = s.split(':').map(Number); return hh*60 + mm; };
        let a = toMin(d), b = toMin(h);
        let diff = b - a;
        if (diff < 0) diff += 24*60; // cruzó medianoche
        mins = diff;
      }
    }

    totalMin += (Number.isFinite(mins) ? mins : 0);
  }

  // --- 3) Mostrar horas y minutos ---
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  document.getElementById('dashHours')?.replaceChildren(String(h));
  document.getElementById('dashMinutes')?.replaceChildren(String(m));
}

// ---------- Reservas ----------
async function loadReservas(){
  const j = await jget(`${API}cooperativa.php?action=reservas_listar`);
  txt('dashReservas', (j.items || []).length || '—');
}

// ---------- Comprobantes ----------
async function loadComprobantes(){
  const j = await jget(`${API}cooperativa.php?action=comprobantes_listar`);
  txt('dashComprobantes', (j.items || []).length || '—');
}

// ---------- Comunicados ----------
function renderComunicados(items){
  const list  = document.getElementById('comunicadosList');
  const empty = document.getElementById('comunicadosEmpty');
  if (!list || !empty) return;

  list.innerHTML = '';
  if (!items || items.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  for (const it of items) {
    const el = document.createElement('div');
    el.className = 'item';
    const fecha = it.Fecha || it.fecha || '';
    const titulo = it.Titulo || it.titulo || '(Sin título)';
    const dest = it.Destinatario || it.destinatario || 'Todos';
    el.innerHTML = `
      <div class="title">${titulo}</div>
      <div class="meta">${fecha} · ${dest}</div>
      <div class="muted">${(it.Contenido || it.contenido || '').slice(0,160)}</div>
    `;
    list.appendChild(el);
  }
}
async function loadComunicados(){
  try {
    const j = await jget(`${API}cooperativa.php?action=comunicados_listar`);
    renderComunicados(j.items || []);
  } catch {
    renderComunicados([]);
  }
}

// ---------- Init ----------
(async function init(){
  try { await loadMe(); } catch {}
  loadHoras().catch(()=>{});
  loadReservas().catch(()=>{});
  loadComprobantes().catch(()=>{});
  loadComunicados().catch(()=>{});
})();