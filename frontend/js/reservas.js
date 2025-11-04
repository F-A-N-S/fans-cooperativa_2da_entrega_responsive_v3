// Reservas — UI de bloques de 30'
(function(){
  const API = (window.API || "/api/api.php");
  const $ = (s)=>document.querySelector(s);
  const token = ()=>localStorage.getItem("fans_token")||localStorage.getItem("token")||"";
  const H = ()=> token()? {Authorization:"Bearer "+token()} : {};
  const B = (a)=> `${API}?action=${a}`;

  function pad2(n){ return (n<10?"0":"")+n; }
  function toTime(h,m){ return pad2(h)+":"+pad2(m); } // HH:mm

  // UI elements
  const selEspacio = $("#selEspacio");
  const selDia  = $("#selDia") || null;
  const selMes  = $("#selMes") || null;
  const fechaInput = $("#resFecha") || null; // opcional
  const slotsBox = $("#slots");
  const btnHoy   = $("#btnHoy");
  const selInfo  = $("#selInfo");
  const btnReservar = $("#btnSolicitar") || $("#btnReservar");
  const msg      = $("#msg");
  const misBox   = $("#misReservas");

  function todayY(){ return String((new Date()).getFullYear()); }
  function yyyy_mm_dd(){
    if (fechaInput) return String(fechaInput.value || new Date().toISOString().slice(0,10));
    const y = todayY();                         // <-- YA NO ES 2025 FIJO
    const m = selMes?.value || pad2(new Date().getMonth()+1);
    const d = selDia?.value || pad2(new Date().getDate());
    return `${y}-${m}-${d}`;
  }

  // build half-hour slots
  const START_H = 8;   // 08:00
  const END_H   = 21;  // 21:00
  const allSlots = [];
  (function makeSlots(){
    let idx=0;
    for(let h=START_H; h<END_H; h++){
      allSlots.push({i:idx++, start: toTime(h,0),  end: toTime(h,30),  label: toTime(h,0)+"–"+toTime(h,30)});
      allSlots.push({i:idx++, start: toTime(h,30), end: toTime(h+1,0), label: toTime(h,30)+"–"+toTime(h+1,0)});
    }
  })();

  const selected = new Set();
  const disabled = new Set();
  function contiguous(sel){
    if(sel.size===0) return [];
    const arr = Array.from(sel).sort((a,b)=>a-b);
    for (let i=1;i<arr.length;i++) if (arr[i] !== arr[i-1]+1) return null;
    const first = allSlots[arr[0]];
    const last  = allSlots[arr[arr.length-1]];
    return [first.start, last.end];
  }

  function renderSlots(){
    slotsBox.innerHTML = allSlots.map(s=>{
      const dis = disabled.has(s.i) ? " is-disabled" : "";
      const sel = selected.has(s.i) ? " is-selected" : "";
      return `<button type="button" class="slot${dis}${sel}" data-i="${s.i}" aria-pressed="${selected.has(s.i)}">${s.label}</button>`;
    }).join("");
    selInfo && (selInfo.textContent = selected.size+" intervalos seleccionados");
  }

  async function fetchOcupados(){
    disabled.clear(); selected.clear(); renderSlots();
    msg && (msg.textContent = "Cargando ocupación…");
    try{
      const fecha = yyyy_mm_dd();
      const espacio = selEspacio.value;
      const r = await fetch(B("reservas_listar_fecha")+"&fecha="+encodeURIComponent(fecha)+"&espacio="+encodeURIComponent(espacio), {headers:H()});
      const j = await r.json();
      const rows = j.rows||j.items||[];
      for(const row of rows){
        const hi = String(row.Hora_Inicio||row.hora_inicio||"");
        const hf = String(row.Hora_Fin||row.hora_fin||"");
        for(const s of allSlots){
          if(!(s.end<=hi || s.start>=hf)){ disabled.add(s.i); }
        }
      }
      renderSlots();
      msg && (msg.textContent = "");
    }catch(e){ msg && (msg.textContent = "Error: "+e.message); }
  }

  slotsBox.addEventListener("click", (ev)=>{
    const el = ev.target.closest('.slot'); if(!el) return;
    const i = +el.dataset.i;
    if (disabled.has(i)) return;
    if (selected.has(i)) selected.delete(i); else selected.add(i);
    renderSlots();
  });

  selEspacio?.addEventListener("change", fetchOcupados);
  selDia?.addEventListener("change", fetchOcupados);
  selMes?.addEventListener("change", fetchOcupados);
  fechaInput?.addEventListener("change", fetchOcupados);
  btnHoy?.addEventListener("click", ()=>{
    const n=new Date();
    if (selDia) selDia.value = pad2(n.getDate());
    if (selMes) selMes.value = pad2(n.getMonth()+1);
    if (fechaInput) fechaInput.value = n.toISOString().slice(0,10);
    fetchOcupados();
  });

  async function me(){
    const r = await fetch(B("me"), {headers:H()});
    const j = await r.json();
    if(!j.ok) throw new Error("No autenticado");
    return j.user;
  }

  btnReservar.addEventListener("click", async () => {
  if (selected.size === 0) {
    alert("Elegí al menos un intervalo.");
    return;
  }
  const idx = Array.from(selected).sort((a, b) => a - b);
  const start = allSlots[idx[0]].start;
  const end = allSlots[idx[idx.length - 1]].end;
  const fecha = yyyy_mm_dd();               // usa el año actual dinámico
  const espacio = selEspacio.value;

  try {
    // NO llamamos a "me": la API toma el id del token
    const payload = { fecha, espacio, hora_inicio: start, hora_fin: end };
    const r = await fetch(B("reservas_solicitar"), {
      method: "POST",
      headers: { ...H(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const t = await r.text();
    const j = JSON.parse(t);
    if (!r.ok || j?.ok === false) throw new Error(j?.error || "Error");
    alert("Solicitud enviada ✅");
    await fetchOcupados();  // refresca ocupación
  } catch (err) {
    console.error("[reservas] error", err);
    alert("No se pudo solicitar: " + (err?.message || "error"));
  }
});

  // Mis reservas (requiere endpoint reservas_listar_mis)
  async function loadMine(){
    if (!misBox) return;
    misBox.textContent = 'Cargando…';
    try{
      const j = await fetch(B('reservas_listar_mis'), {headers:H()}).then(r=>r.json());
      const rows = j.rows || j.items || [];
      misBox.innerHTML = rows.length ? `
        <table class="table">
          <thead><tr><th>Fecha</th><th>Inicio</th><th>Fin</th><th>Espacio</th><th>Estado</th></tr></thead>
          <tbody>
            ${rows.map(r=>`<tr>
              <td>${r.Fecha||r.fecha}</td>
              <td>${r.Hora_Inicio||r.hora_inicio}</td>
              <td>${r.Hora_Fin||r.hora_fin}</td>
              <td>${r.Espacio||r.espacio||''}</td>
              <td><span class="badge ${(['aprobado','rechazado','pendiente'].includes(String(r.Estado||r.estado).toLowerCase())?String(r.Estado||r.estado).toLowerCase():'secondary')}">${r.Estado||r.estado}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<div class="muted">Sin reservas.</div>';
    }catch(e){
      misBox.innerHTML = `<span class="text-danger">Error: ${e.message}</span>`;
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    if (fechaInput && !fechaInput.value) fechaInput.value = new Date().toISOString().slice(0,10);
    fetchOcupados();
    loadMine();
  });
})();