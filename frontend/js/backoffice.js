// frontend/js/backoffice.js  (IIFE, sin imports)

// Duración legible a partir de minutos (estándar: "h m")
function fmtDur(mins) {
  mins = Math.max(0, parseInt(mins ?? 0, 10));
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h && m) return `${h} h ${m} m`;
  if (h)      return `${h} h`;
  return `${m} m`;
}

// ── Helpers comunes ───────────────────────────────────────────────────────────
function fmtDur(mins){
  mins = Math.max(0, parseInt(mins ?? 0, 10));
  const h = Math.floor(mins/60), m = mins % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h)      return `${h} h`;
  return `${m} min`;
}
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

(function(){
  const API = '../backend/api/cooperativa.php';

  const cred = { credentials: 'include' };
  const asJSON = r => r.json();

  async function apiGet(params){
    const url = `${API}?${new URLSearchParams(params).toString()}`;
    const res = await fetch(url, cred);
    if (!res.ok) throw await res.json().catch(()=>({error:'HTTP_'+res.status}));
    return asJSON(res);
  }
  async function apiPost(action, body){
    const res = await fetch(API+'?action='+encodeURIComponent(action), {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body||{}),
      credentials:'include'
    });
    if (!res.ok) throw await res.json().catch(()=>({error:'HTTP_'+res.status}));
    return asJSON(res);
  }

  async function ensureAdmin(){
    try { await apiGet({action:'me'}); }
    catch(e){ location.href='admin_login.html'; }
  }

  // ---------- Usuarios pendientes ----------
  async function loadPostulantes(){
    const tbody = document.getElementById('pendingUsersTbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Cargando…</td></tr>`;
    try{
      const {items=[]} = await apiGet({action:'postulantes_listar'});
      if (!items.length){ tbody.innerHTML = `<tr><td colspan="5" class="empty">Sin pendientes.</td></tr>`; return; }
      tbody.innerHTML = items.map(p => `
        <tr>
          <td>${p.id}</td>
          <td>${p.nombre ?? ''}</td>
          <td>${p.correo ?? ''}</td>
          <td>${p.fecha ?? ''}</td>
          <td class="row-actions">
            <button class="btn btn-primary" data-approve="${p.id}">Aprobar</button>
            <button class="btn btn-danger" data-reject="${p.id}">Rechazar</button>
          </td>
        </tr>
      `).join('');
      tbody.onclick = async (ev)=>{
        const a = ev.target.closest('[data-approve]'); const r = ev.target.closest('[data-reject]');
        if (a){ await apiPost('postulante_aprobar',{id:+a.dataset.approve}); loadPostulantes(); }
        if (r){ await apiPost('postulante_rechazar',{id:+r.dataset.reject}); loadPostulantes(); }
      };
    }catch{ tbody.innerHTML = `<tr><td colspan="5" class="empty">Error cargando.</td></tr>`; }
  }

  // ---------- Comprobantes ----------
  async function loadComprobantes(){
    const tbody = document.getElementById('tbodyComprobantes');
    if (!tbody) return;
    const estado = document.getElementById('estadoFiltro')?.value || '';
    const rid = document.getElementById('residenteFiltro')?.value.trim() || '';
    tbody.innerHTML = `<tr><td colspan="8" class="empty">Cargando…</td></tr>`;
    try{
      const params = {action:'admin_comprobantes_listar'};
      if (estado) params.estado = estado;
      if (rid) params.rid = rid;
      const {items=[]} = await apiGet(params);
      if (!items.length){ tbody.innerHTML = `<tr><td colspan="8" class="empty">Sin comprobantes.</td></tr>`; return; }
      tbody.innerHTML = items.map(c => `
        <tr>
          <td>${c.id}</td>
          <td>${c.Tipo ?? ''}</td>
          <td>${c.Fecha ?? ''}</td>
          <td>${c.Monto ?? ''}</td>
          <td>
            <select data-cestado="${c.id}">
              ${['Pendiente','Aprobado','Rechazado'].map(s=>`<option ${s===(c.Estado||'')?'selected':''}>${s}</option>`).join('')}
            </select>
          </td>
          <td>${c.Archivo ? `<a href="../${c.Archivo}" target="_blank">ver</a>` : ''}</td>
          <td class="muted">${c.id_Administrador?('#'+c.id_Administrador):'—'}</td>
          <td class="row-actions">
            <button class="btn" data-save="${c.id}">Guardar</button>
            <button class="btn btn-danger" data-del="${c.id}">Eliminar</button>
          </td>
        </tr>
      `).join('');
      tbody.onclick = async (ev)=>{
        const s = ev.target.closest('[data-save]'); const d = ev.target.closest('[data-del]');
        if (d){ if(confirm('¿Eliminar comprobante?')){ await apiPost('comprobantes_eliminar',{id:+d.dataset.del}); loadComprobantes(); } return; }
        if (s){
          const id = +s.dataset.save;
          const sel = tbody.querySelector(`[data-cestado="${id}"]`);
          await apiPost('comprobantes_estado',{id, estado: sel.value});
          loadComprobantes();
        }
      };
    }catch{ tbody.innerHTML = `<tr><td colspan="8" class="empty">Error cargando.</td></tr>`; }
  }

  // ---------- Comunicados ----------
  async function loadComunicados(){
    const list = document.getElementById('comList');
    if (!list) return;
    list.innerHTML = `<tr><td colspan="4" class="empty">Cargando…</td></tr>`;
    try{
      const {items=[]} = await apiGet({action:'comunicados_listar'});
      if (!items.length){ list.innerHTML = `<tr><td colspan="4" class="empty">Sin comunicados.</td></tr>`; return; }
      list.innerHTML = items.map(x=>`
        <tr>
          <td>${x.Titulo}</td>
          <td>${x.Fecha}</td>
          <td>${x.Destinatario||'Todos'}</td>
          <td><button class="btn btn-danger" data-cdel="${x.id}">Eliminar</button></td>
        </tr>
      `).join('');
      list.onclick = async ev=>{
        const b = ev.target.closest('[data-cdel]');
        if (b){ if(confirm('¿Eliminar comunicado?')){ await apiPost('comunicado_eliminar',{id:+b.dataset.cdel}); loadComunicados(); } }
      };
    }catch{ list.innerHTML = `<tr><td colspan="4" class="empty">Error cargando.</td></tr>`; }
  }
  function hookComunicadosForm(){
    const f = document.getElementById('boAnnForm');
    if (!f) return;
    f.addEventListener('submit', async (ev)=>{
      ev.preventDefault();
      const titulo = document.getElementById('comTitle').value.trim();
      const cuerpo = document.getElementById('comBody').value.trim();
      if(!titulo || !cuerpo) return;
      await apiPost('admin_comunicados_crear',{titulo, contenido:cuerpo});
      f.reset(); loadComunicados();
    });
  }

  // ---------- Reclamos ----------
  async function loadReclamos(){
    const tbody = document.getElementById('boReclamosTBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Cargando…</td></tr>`;
    try{
      const {items=[]} = await apiGet({action:'admin_reclamos_listar'});
      if (!items.length){ tbody.innerHTML = `<tr><td colspan="6" class="empty">Sin reclamos.</td></tr>`; return; }
      tbody.innerHTML = items.map(r=>`
        <tr>
          <td>${r.id}</td>
          <td>${r.id_Residente||''}</td>
          <td>${r.Fecha||''}</td>
          <td>${r.Descripcion||''}</td>
          <td>
            <select data-restado="${r.id}">
              ${['abierto','en progreso','cerrado'].map(s=>`<option ${s===(r.Estado||'')?'selected':''}>${s}</option>`).join('')}
            </select>
          </td>
          <td class="row-actions">
            <button class="btn" data-rsave="${r.id}">Guardar</button>
            <button class="btn btn-danger" data-rdel="${r.id}">Eliminar</button>
          </td>
        </tr>
      `).join('');
      tbody.onclick = async ev=>{
        const s = ev.target.closest('[data-rsave]'); const d = ev.target.closest('[data-rdel]');
        if (d){ if(confirm('¿Eliminar reclamo?')){ await apiPost('reclamos_eliminar',{id:+d.dataset.rdel}); loadReclamos(); } return; }
        if (s){
          const id = +s.dataset.rsave;
          const sel = tbody.querySelector(`[data-restado="${id}"]`);
          await apiPost('reclamos_estado',{id, estado: sel.value});
          loadReclamos();
        }
      };
    }catch{ tbody.innerHTML = `<tr><td colspan="6" class="empty">Error cargando.</td></tr>`; }
  }

  // ---------- Reservas ----------
  async function loadReservas() {
  const tbody = document.getElementById('boReservasTBody');
  tbody.innerHTML = '<tr><td colspan="6">Cargando…</td></tr>';

  try {
    const r = await fetch('../backend/api/cooperativa.php?action=admin_reservas_listar', {
      credentials: 'include'
    }).then(x => x.json());

    if (!r.ok) throw new Error(r.error || 'SERVER');

    const pad = s => String(s ?? '').padStart(2,'0');

    tbody.innerHTML = '';
    if (!r.items || !r.items.length) {
      tbody.innerHTML = '<tr><td colspan="6">Sin reservas.</td></tr>';
      return;
    }

    for (const it of r.items) {
      const id       = it.id;
      const resId    = it.residente || it.id_Residente || '';
      const fecha    = it.fecha    || it.Fecha || '';
      const hora     = it.hora     || it.Hora  ||
                       (it.hora_inicio && it.hora_fin
                        ? `${pad(it.hora_inicio).slice(0,2)}:${pad(it.hora_inicio).slice(-2)}–${pad(it.hora_fin).slice(0,2)}:${pad(it.hora_fin).slice(-2)}`
                        : '');

      const sel = document.createElement('select');
      ['Pendiente','Aprobado','Rechazado'].forEach(v=>{
        const o = document.createElement('option');
        o.value = v; o.textContent = v;
        if ((it.estado||'Pendiente') === v) o.selected = true;
        sel.appendChild(o);
      });

      const btnSave = document.createElement('button');
      btnSave.className = 'btn';
      btnSave.textContent = 'Guardar';
      btnSave.addEventListener('click', async ()=>{
        const body = { id, estado: sel.value };
        const resp = await fetch('../backend/api/cooperativa.php?action=reservas_estado', {
          method:'POST', credentials:'include',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(body)
        }).then(x=>x.json());
        if (!resp.ok) alert(resp.error||'Error');
      });

      const btnDel = document.createElement('button');
      btnDel.className = 'btn btn-danger';
      btnDel.textContent = 'Eliminar';
      btnDel.addEventListener('click', async ()=>{
        if (!confirm('¿Eliminar reserva?')) return;
        const resp = await fetch('../backend/api/cooperativa.php?action=reservas_eliminar', {
          method:'POST', credentials:'include',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({id})
        }).then(x=>x.json());
        if (resp.ok) loadReservas(); else alert(resp.error||'Error');
      });

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${id}</td>
        <td>${resId}</td>
        <td>${fecha || '-'}</td>
        <td>${hora  || '-'}</td>
        <td></td>
        <td></td>
      `;
      tr.children[4].appendChild(sel);
      tr.children[5].appendChild(btnSave);
      tr.children[5].appendChild(btnDel);
      tbody.appendChild(tr);
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6">Error cargando.</td></tr>`;
    console.error(e);
  }
}

  // ---------- Horas (admin) ----------
// Función para formatear los minutos en horas y minutos
function fmtDur(mins) {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`; // Ejemplo: "1h 30m"
  }
  return `${minutes}m`; // Si no hay horas, solo muestra los minutos: "30m"
}

// ── Horas (admin) ─────────────────────────────────────────────────────────────
// ---------- Horas (admin) ----------
async function loadHours(){
  const tbody = document.getElementById('hoursTbody');
  if (!tbody) return;

  const ridEl   = document.getElementById('hoursRid');
  const monthEl = document.getElementById('hoursMonth');

  const rid   = ridEl   ? ridEl.value.trim() : '';
  const month = monthEl ? monthEl.value : '';

  tbody.innerHTML = `<tr><td colspan="6" class="empty">Cargando…</td></tr>`;

  const fmtMin = n => `${Number(n || 0)} min`;

  try{
    const params = { action:'hours_admin_listar' };
    if (rid) params.rid = rid;
    if (month) {
      const [Y,M] = month.split('-');
      if (Y && M) { params.anio = Y; params.mes = M; }
    }

    const { items = [] } = await apiGet(params);

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">Sin registros.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(h => {
      const mins = (h.mins ?? h.Cantidad ?? 0);
      const residente = (h.residente_id ?? h.id_Residente ?? '');
      return `
        <tr>
          <td>${h.id}</td>
          <td>${residente}</td>
          <td>${h.Fecha ?? ''}</td>
          <td>${fmtMin(mins)}</td>
          <td>${h.Descripcion ?? ''}</td>
          <td><button class="btn btn-danger" data-hdel="${h.id}">Eliminar</button></td>
        </tr>`;
    }).join('');

    // borrar
    tbody.onclick = async ev => {
      const d = ev.target.closest('[data-hdel]');
      if (!d) return;
      if (!confirm('¿Eliminar registro de horas?')) return;
      await apiPost('hours_admin_eliminar', { id: +d.dataset.hdel });
      loadHours();
    };

  } catch (e) {
    console.error('Error al cargar horas:', e);
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Error cargando.</td></tr>`;
  }
}

  // ---------- Logout ----------
  function bindLogout(){
    document.querySelector('[data-logout]')?.addEventListener('click', async ()=>{
      try{ await apiPost('logout',{});}catch{}
      document.cookie='fans_token=;path=/;max-age=0;samesite=Lax';
      location.href='admin_login.html';
    });
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    await ensureAdmin();

    // Toggle de tema (igual al resto)
   // Al cargar la página, establecer el tema en función de lo almacenado en el almacenamiento local
document.addEventListener('DOMContentLoaded', () => {
  const themeToggleButton = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const savedTheme = localStorage.getItem('theme') || 'dark'; // por defecto 'dark'
  
  // Establece el tema
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️'; // Establece el ícono en función del tema
  
  // Cambio de tema al hacer clic en el botón
  themeToggleButton.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';  // Alterna entre 'dark' y 'light'
    
    // Aplica el nuevo tema
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Guarda el tema en localStorage
    localStorage.setItem('theme', newTheme);
    
    // Cambia el ícono del botón
    themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
  });
});

    bindLogout();

    document.getElementById('aplicarFiltros')?.addEventListener('click', loadComprobantes);
    document.getElementById('hoursApply')?.addEventListener('click', loadHours);

    hookComunicadosForm();

    // Cargas iniciales
    loadPostulantes();
    loadComprobantes();
    loadComunicados();
    loadReclamos();
    loadReservas();

    const m = document.getElementById('hoursMonth');
    if (m && !m.value){ const d=new Date(); m.value = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
    loadHours();
  });
})();