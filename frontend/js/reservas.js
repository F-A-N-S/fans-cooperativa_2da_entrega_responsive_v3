// frontend/js/reservas.js
(() => {
  const API = (location.pathname.includes('/frontend/'))
    ? '../backend/api/cooperativa.php'
    : 'backend/api/cooperativa.php';

  // ---- utilidades ----
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const toHM = (h, m) => `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  const add30 = (hm) => { const [H,M]=hm.split(':').map(Number); const t=H*60+M+30; return toHM(Math.floor(t/60), t%60); };

  // slots de 30' (08:00–21:30) -> ajustá si querés otro rango
  const SLOTS = [];
  for (let t=8*60; t<=21*60+30; t+=30) SLOTS.push(toHM(Math.floor(t/60), t%60));

  // ---- elementos ----
  const espacioSel = $('#espacio');
  const fechaInp   = $('#fecha');
  const grid       = $('#slotsGrid');
  const btnDisp    = $('#btnDisponibilidad');
  const btnSend    = $('#btnEnviarReserva');
  const misCont    = $('#misSolicitudes');

  // estado de selección (rango)
  let startIdx = null;   // índice del primer slot seleccionado
  let endIdx   = null;   // índice del último slot seleccionado (inclusive)
  let busySet  = new Set(); // índices ocupados según disponibilidad

  // pinta la grilla
  function renderGrid() {
    grid.innerHTML = SLOTS.map((t,i)=>`<button type="button" class="slot" data-i="${i}">${t}</button>`).join('');
    grid.addEventListener('click', onSlotClick, { once:true }); // engancho una sola vez
    paint();
  }

  function inRange(i) {
    if (startIdx===null) return false;
    const a = Math.min(startIdx, endIdx ?? startIdx);
    const b = Math.max(startIdx, endIdx ?? startIdx);
    return i>=a && i<=b;
  }

  function paint() {
    $$('.slot', grid).forEach((el) => {
      const i = Number(el.dataset.i);
      el.classList.toggle('busy',  busySet.has(i));
      el.classList.toggle('active', inRange(i));
    });
  }

  function onSlotClick(e) {
    if (!e.target.classList.contains('slot')) { grid.addEventListener('click', onSlotClick, { once:true }); return; }
    const i = Number(e.target.dataset.i);
    if (busySet.has(i)) { // no permito marcar ocupado
      grid.addEventListener('click', onSlotClick, { once:true });
      return;
    }
    if (startIdx===null) {                    // primer clic -> inicio
      startIdx = i; endIdx = null;
    } else if (endIdx===null) {               // segundo clic -> fin
      endIdx = i;
      // normalizo para no incluir ocupados en el medio
      const a = Math.min(startIdx, endIdx), b = Math.max(startIdx, endIdx);
      for (let k=a; k<=b; k++) {
        if (busySet.has(k)) {                 // si hay ocupado en el rango, corto ahí
          endIdx = (k===a) ? a : k-1;
          break;
        }
      }
    } else {                                  // tercer clic -> reinicia con nuevo inicio
      startIdx = i; endIdx = null;
    }
    paint();
    grid.addEventListener('click', onSlotClick, { once:true });
  }

  // carga "mis reservas"
  async function loadMine() {
    try {
      const url = `${API}?action=reservas_mias`;
      const r = await fetch(url);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error||'ERROR');

      if (!j.items || !j.items.length) {
        misCont.innerHTML = `<div class="card"><div class="card-body" style="opacity:.7">Sin solicitudes.</div></div>`;
        return;
      }
      misCont.innerHTML = j.items.map(it => {
        const rango = `${it.hora_inicio?.slice(0,5)??it.hora?.slice(0,5)}–${(it.hora_fin||'').slice(0,5)}`;
        return `<div class="card"><div class="card-body" style="display:flex;justify-content:space-between;gap:12px">
          <div><div class="badge">${it.espacio||'Espacio'}</div><div>${it.fecha}</div></div>
          <div style="font-weight:700">${rango}</div>
          <div class="badge">${(it.estado||'pendiente')}</div>
        </div></div>`;
      }).join('');
    } catch {
      misCont.innerHTML = `<div class="card"><div class="card-body" style="opacity:.7">Error cargando.</div></div>`;
    }
  }

  // disponibilidad (marca ocupados)
  async function checkAvailability() {
    busySet = new Set();
    startIdx = endIdx = null;
    paint();

    const esp = espacioSel.value;
    const f   = normDate(fechaInp.value);
    if (!esp || !f) return alert('Elegí espacio y fecha.');

    try {
      // endpoint opcional; si no existe, no rompe. Marca ocupados si responde.
      const url = `${API}?action=reservas_disponibilidad&espacio=${encodeURIComponent(esp)}&fecha=${encodeURIComponent(f)}`;
      const r = await fetch(url);
      const j = await r.json();

      if (j.ok && Array.isArray(j.busy)) {
        for (const b of j.busy) {
          // b: {desde:"HH:MM", hasta:"HH:MM"}
          let i = SLOTS.indexOf(b.desde);
          while (i>=0 && i < SLOTS.length && SLOTS[i] < b.hasta) {
            busySet.add(i); i++;
          }
        }
      }
    } catch { /* silencioso */ }
    paint();
  }

  // envía reserva de rango [startIdx ... endIdx]
  async function sendBooking() {
    if (startIdx===null) return alert('Elegí al menos un bloque.\nTip: clic en inicio y luego fin para rango.');
    const a = Math.min(startIdx, endIdx ?? startIdx);
    const b = Math.max(startIdx, endIdx ?? startIdx);

    // cálculo de horas
    const desde = SLOTS[a];
    // fin = slot final + 30'
    const hasta = add30(SLOTS[b]);

    const body = {
      espacio: espacioSel.value,
      fecha:   normDate(fechaInp.value),
      desde, hasta
    };
    if (!body.espacio || !body.fecha) return alert('Faltan espacio o fecha.');

    try {
      const r = await fetch(`${API}?action=reservas_crear`, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'ERROR');
      alert('Reserva enviada. El backoffice puede aprobarla.');
      await loadMine();
      await checkAvailability();
    } catch (e) {
      alert('No se pudo reservar. '+ (e.message||''));
    }
  }

  // normaliza dd/mm/aaaa o yyyy-mm-dd -> yyyy-mm-dd
  function normDate(x) {
    if (!x) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return x;
    const m = x.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : x;
  }

  // arranque
  renderGrid();
  loadMine();

  // hoy por defecto
  if (!fechaInp.value) {
    const d=new Date(), y=d.getFullYear(), mo=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0');
    fechaInp.value = `${y}-${mo}-${da}`;
  }

  btnDisp?.addEventListener('click', checkAvailability);
  btnSend?.addEventListener('click', sendBooking);
})();