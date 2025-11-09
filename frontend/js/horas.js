// frontend/js/horas.js
(function () {
  const $ = (s, p=document) => p.querySelector(s);

  const API   = '../backend/api/cooperativa.php';
  const msg   = $('#msg');
  const fecha = $('#fecha');
  const desde = $('#desde');
  const hasta = $('#hasta');
  const desc  = $('#desc');
  const btn   = $('#btnGuardar');
  const list  = $('#list');

  const showMsg = (t, ok=false) => {
    if(!msg) return;
    msg.style.display='block';
    msg.className = 'alert ' + (ok ? 'ok' : 'error');
    msg.textContent = t;
    if(ok) setTimeout(()=> msg.style.display='none', 1600);
  };

  // dd/mm/aaaa | aaaa-mm-dd -> aaaa-mm-dd
  function toISODate(s){
    s = (s||'').trim();
    let m = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return s;
    return null;
  }

  // HH:MM -> minutos desde medianoche
  function hmToMin(s){
    const m = (s||'').trim().match(/^(\d{1,2}):(\d{2})$/);
    if(!m) return NaN;
    const hh = +m[1], mm = +m[2];
    if(hh<0 || hh>23 || mm<0 || mm>59) return NaN;
    return hh*60 + mm;
  }

  function fmtDateYMDtoDMY(iso) {
  // "2025-11-11" -> "11/11/2025"
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '');
}

function minsOf(it) {
  return parseInt(it.mins ?? it.Cantidad ?? 0, 10) || 0;
}

function fmtDur(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} h ${m} m`;
  if (h) return `${h} h`;
  return `${m} m`;
}

async function listar(){
  try{
    const res = await fetch(`${API}?action=hours_list`, {credentials:'include'});
    if(!res.ok) throw new Error(await res.text());
    const data  = await res.json();
    const items = (data.items || []).sort((a,b) => (b.Id_Hora??0) - (a.Id_Hora??0)); // más recientes arriba

    const table   = document.getElementById('hoursTable');
    const summary = document.getElementById('hoursSummary');

    const totalMin = items.reduce((acc, it) => acc + minsOf(it), 0);
    summary.textContent = `${items.length} registro${items.length!==1?'s':''} — ${fmtDur(totalMin)} totales`;

    // Header
    let html = `
      <div class="t-row t-head">
        <div>Fecha</div>
        <div class="right">Duración</div>
        <div>Descripción</div>
      </div>
    `;

    if (items.length === 0) {
      html += `<div class="empty">Sin registros por ahora.</div>`;
    } else {
      html += items.map(it => {
        const fecha = fmtDateYMDtoDMY(it.Fecha || '');
        const mins  = minsOf(it);
        const desc  = (it.Descripcion || '').replaceAll('<','&lt;');
        return `
          <div class="t-row">
            <div>${fecha}</div>
            <div class="right">${fmtDur(mins)}</div>
            <div>${desc}</div>
          </div>
        `;
      }).join('');
    }

    table.innerHTML = html;
  }catch(e){
    console.error(e);
    showMsg('Error cargando horas');
  }
}

  async function guardar(){
    msg && (msg.style.display='none');
    btn && (btn.disabled=true);
    try{
      const iso = toISODate(fecha.value);
      const m0  = hmToMin(desde.value);
      const m1i = hmToMin(hasta.value);

      if(!iso || isNaN(m0) || isNaN(m1i)){
        showMsg('Fecha u hora inválida'); return;
      }

      // cruzar medianoche
      let m1 = m1i;
      if (m1 <= m0) m1 += 24*60;

      const delta = m1 - m0;
      if (delta <= 0) { showMsg('El rango horario es inválido'); return; }

      const body = new URLSearchParams({
        fecha: iso,      // **ISO para el backend**
        desde: desde.value.trim(),
        hasta: hasta.value.trim(),
        descripcion: (desc.value||'').trim(),
      });

      const res = await fetch(`${API}?action=hours_create`, {
        method:'POST',
        body,
        credentials:'include'
      });
      if(!res.ok) throw new Error(await res.text());

      await res.json();
      showMsg('Horas guardadas ✅', true);
      await listar();
    }catch(e){
      console.error(e);
      showMsg('Error guardando horas');
    }finally{
      btn && (btn.disabled=false);
    }
  }

  $('#btnGuardar')?.addEventListener('click', guardar);

  // Defaults: desde ahora redondeado a :00, hasta +60 min (misma minuta)
  (function setDefaults(){
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');

    // fecha -> DD/MM/AAAA si tu input está con ese formato; si usás <input type="date">
    // podés poner directamente ISO.
    const d = now;
    const dd = pad(d.getDate()), mm = pad(d.getMonth()+1), yy = d.getFullYear();
    if (fecha) {
      // Si tu input es de texto y mostrás dd/mm/aaaa:
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha.value||'')) {
        fecha.value = `${dd}/${mm}/${yy}`;
      } else {
        fecha.value = `${yy}-${mm}-${dd}`;
      }
    }

    let h = d.getHours();
    const m = 0; // fijamos minutos en :00
    if (desde) desde.value = `${pad(h)}:${pad(m)}`;
    if (hasta) hasta.value = `${pad((h+1)%24)}:${pad(m)}`;
  })();

  listar();
})();