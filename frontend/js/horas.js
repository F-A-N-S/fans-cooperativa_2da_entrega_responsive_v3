// frontend/js/horas.js — retro-compatible y unificado a MINUTOS
(function () {
  const API = '../backend/api/cooperativa.php';
  const $ = (s, p=document) => p.querySelector(s);
  const byId = (...ids) => { for (const id of ids) { const el = $('#'+id); if (el) return el; } return null; };

  // Soporta ambos nombres de IDs (viejos y nuevos)
  const msg        = byId('msg');
  const fechaEl    = byId('hFecha','fecha');
  const desdeEl    = byId('hDesde','desde');
  const hastaEl    = byId('hHasta','hasta');
  const descEl     = byId('hDescripcion','desc');
  const btnGuardar = byId('btnGuardar');
  const form       = byId('hoursForm');

  // Contenedores de render: layout viejo y nuevo (usa el que exista)
  const table   = byId('hoursTable');     // viejo
  const summary = byId('hoursSummary');   // viejo
  const list    = byId('myHoursList');    // nuevo
  const totalEl = byId('myHoursTotal');   // nuevo

  const fmtMin = n => `${Number(n || 0)} min`;
  const minsOf = it => parseInt(it.mins ?? it.Cantidad ?? 0, 10) || 0;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[m]));

  function toISODate(s){
    s = (s||'').trim();
    let m = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;          // dd/mm/aaaa -> aaaa-mm-dd
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? s : null;                               // aaaa-mm-dd
  }
  function hmToMin(s){
    const m=(s||'').trim().match(/^(\d{1,2}):(\d{2})$/);
    if(!m) return NaN;
    const hh=+m[1], mm=+m[2];
    if(hh<0||hh>23||mm<0||mm>59) return NaN;
    return hh*60+mm;
  }
  function showOK(text){
    if(!msg) return;
    msg.style.display='block';
    msg.className='alert ok';
    msg.textContent=text;
    setTimeout(()=> msg.style.display='none', 1500);
  }

  // ----- Cargar “Mis horas” -----
  async function load(){
    try{
      const res = await fetch(`${API}?action=hours_list`, { credentials:'include' });
      const data = await res.json();
      const items = (data.items || []).sort((a,b)=>(b.Id_Hora??0) - (a.Id_Hora??0));
      const total = items.reduce((acc,it)=> acc + minsOf(it), 0);

      // Render viejo (tabla compacta)
      if (table){
        let html = `
          <div class="t-row t-head">
            <div>Fecha</div>
            <div class="right">Minutos</div>
            <div>Descripción</div>
          </div>`;
        html += items.length
          ? items.map(it => `
              <div class="t-row">
                <div>${esc(it.Fecha||'')}</div>
                <div class="right">${fmtMin(minsOf(it))}</div>
                <div>${esc(it.Descripcion||'')}</div>
              </div>`).join('')
          : `<div class="empty">Sin registros por ahora.</div>`;
        table.innerHTML = html;
      }
      if (summary) summary.textContent = `${items.length} registro${items.length!==1?'s':''} — ${fmtMin(total)} totales`;

      // Render nuevo (filas 3 columnas)
      if (list){
        list.innerHTML = items.length
          ? items.map(it => `
              <div class="t-row">
                <div class="cell date">${esc(it.Fecha||'')}</div>
                <div class="cell mins">${fmtMin(minsOf(it))}</div>
                <div class="cell desc">${esc(it.Descripcion||'')}</div>
              </div>`).join('')
          : `<div class="empty">Sin registros todavía.</div>`;
      }
      if (totalEl) totalEl.textContent = fmtMin(total);
    }catch(e){
      console.error('load hours', e);
      if (msg){ msg.style.display='block'; msg.className='alert error'; msg.textContent='Error cargando horas'; }
    }
  }

  // ----- Guardar (URL-ENCODED como tu backend espera) -----
  async function save(ev){
    if (ev) ev.preventDefault();

    const iso = toISODate(fechaEl?.value);
    const d0  = hmToMin(desdeEl?.value);
    const d1i = hmToMin(hastaEl?.value);
    if (!iso || isNaN(d0) || isNaN(d1i)) { alert('Fecha u hora inválida'); return; }

    // soporte cruce de medianoche
    let d1 = d1i;
    if (d1 <= d0) d1 += 24*60;
    if ((d1 - d0) <= 0) { alert('Rango horario inválido'); return; }

    const body = new URLSearchParams({
      fecha: iso,
      desde: (desdeEl?.value||'').trim(),
      hasta: (hastaEl?.value||'').trim(),
      descripcion: (descEl?.value||'').trim(),
    });

    try{
      const res = await fetch(`${API}?action=hours_create`, {
        method:'POST',
        credentials:'include',
        body // <- x-www-form-urlencoded (como tu versión que funcionaba)
      });
      const r = await res.json();
      if (!r.ok) { alert(r.error || 'Error guardando'); return; }
      showOK('Horas guardadas ✅');
      (form||{}).reset?.();
      load();
    }catch(e){
      console.error(e);
      alert('Error guardando horas');
    }
  }

  // ----- Inicialización -----
  document.addEventListener('DOMContentLoaded', () => {
    // Defaults cómodos
    const pad = n => String(n).padStart(2,'0');
    if (fechaEl && !fechaEl.value){
      const d=new Date(), iso=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      // si el input es type="date" uso ISO, si es texto uso dd/mm/aaaa
      fechaEl.value = (fechaEl.type==='date') ? iso : `${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)}`;
    }
    if (desdeEl && !desdeEl.value){
      const d=new Date(); desdeEl.value = `${pad(d.getHours())}:00`;
    }
    if (hastaEl && !hastaEl.value){
      const d=new Date(); hastaEl.value = `${pad((d.getHours()+1)%24)}:00`;
    }

    // Soporto form submit o botón suelto
    if (form) form.addEventListener('submit', save);
    if (btnGuardar) btnGuardar.addEventListener('click', save);

    load();
  });
})();