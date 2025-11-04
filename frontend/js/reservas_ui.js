// reservas_ui.js — grilla 30' con libre/ocupado (solo aprobado/ocupado bloquea) + selección contigua + mis reservas

(function () {
  const API = window.API || "/api/api.php";
  const $ = (s, r = document) => r.querySelector(s);

  // UI refs
  const grid      = $("#slotsGrid");
  const btnVer    = $("#btnVer");
  const btnSol    = $("#btnSolicitar");
  const fechaI    = $("#resFecha");
  const espacioSel= $("#espacio");
  const selCount  = $("#selCount");
  const misBox    = $("#misReservas");

  // estado
  const slots = [];                // [{i, start:"HH:MM", end:"HH:MM", el:DOM}]
  let busy = new Set();            // índices ocupados (solo aprobado/ocupado)
  let pending = new Set();         // índices pendientes (no bloquea)
  let selected = new Set();        // índices seleccionados contiguos

  // helpers
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  const idxToTime = (i) => {
    const m = i * 30;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${pad(h)}:${pad(mm)}`;
  };
  function timeToIdx(t) { // "HH:MM" -> index (0..47)
    const [h, m] = String(t).split(":").map(Number);
    return Math.max(0, Math.min(47, (h * 60 + (m || 0)) / 30 | 0));
  }
  const apiH = ()=>{
    const t = (window.session && session.getToken && session.getToken())
      || localStorage.getItem("fans_token") || localStorage.getItem("token") || "";
    return t ? { Authorization: "Bearer " + t } : {};
  };
  async function raw(u, opt={}) {
    const r = await fetch(u, { cache:"no-store", credentials:"include", ...opt });
    const txt = await r.text();
    let j; try{ j = JSON.parse(txt); } catch { j = { ok:r.ok, raw:txt }; }
    if(!r.ok || j?.ok===false) throw new Error(j?.error || txt || ("HTTP "+r.status));
    return j;
  }
  async function tryGet(actions, params={}) {
    for (const a of actions) {
      try {
        const u = new URL(API, location.origin);
        u.searchParams.set("action", a);
        u.searchParams.set("_", Date.now()); // anti-cache
        Object.entries(params).forEach(([k,v])=>{
          if(v!==undefined && v!==null && v!=="") u.searchParams.set(k,v);
        });
        return await raw(u, { headers: { ...apiH() } });
      } catch(e){}
    }
    return null;
  }
  async function tryPost(actions, body={}) {
    for (const a of actions) {
      try {
        const u = new URL(API, location.origin);
        u.searchParams.set("action", a);
        u.searchParams.set("_", Date.now());
        // JSON
        try {
          return await raw(u, { method:"POST", headers:{ "Content-Type":"application/json", ...apiH() }, body: JSON.stringify(body) });
        } catch(e){}
        // x-www-form-urlencoded
        const f = new URLSearchParams();
        Object.entries(body).forEach(([k,v])=> f.append(k,v));
        return await raw(u, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded; charset=UTF-8", ...apiH() }, body: f.toString() });
      } catch(e){}
    }
    throw new Error("POST falló en: "+actions.join(", "));
  }

  // construir grilla 48 slots
  function buildGrid(){
    grid.innerHTML = "";
    slots.length = 0; busy = new Set(); pending = new Set(); selected = new Set();
    for (let i=0;i<48;i++){
      const start = idxToTime(i);
      const end   = idxToTime(Math.min(48, i+1));
      const el = document.createElement("button");
      el.type="button";
      el.className = "slot";
      el.textContent = `${start}–${end}`;
      el.dataset.idx = i;
      el.addEventListener("click", onSlotClick);
      grid.appendChild(el);
      slots.push({ i, start, end, el });
    }
    updateColors();
    updateSelCount();
  }

  // normaliza estado textual del backend
  function normEstado(v){
    const t = String(v||"").toLowerCase();
    if (t.includes("aprob")) return "aprobado";
    if (t.includes("ocup"))  return "ocupado";
    if (t.includes("rech"))  return "rechazado";
    return "pendiente";
  }

  function clearSelection(){
    selected.clear();
    updateColors();
    updateSelCount();
  }
  function isContiguous(nextIdx){
    if (selected.size===0) return true;
    const arr = Array.from(selected).sort((a,b)=>a-b);
    const lo = arr[0], hi = arr[arr.length-1];
    return nextIdx===lo-1 || nextIdx===hi+1 || (nextIdx>=lo && nextIdx<=hi);
  }

  function onSlotClick(e){
    const idx = +e.currentTarget.dataset.idx;
    if (busy.has(idx)) return; // ocupado no se toca
    if (selected.size && !isContiguous(idx)){
      clearSelection(); // si rompe contigüidad, empezar de cero
    }
    if (selected.has(idx)) selected.delete(idx);
    else selected.add(idx);
    updateColors();
    updateSelCount();
  }

  function updateColors(){
    const selMin = selected.size ? Math.min(...selected) : -1;
    const selMax = selected.size ? Math.max(...selected) : -1;
    for(const s of slots){
      s.el.classList.remove("busy","free","selected","pending","slot--busy","slot--free","slot--pending","slot--selected");
      if (busy.has(s.i)){
        s.el.classList.add("busy","slot--busy");
        s.el.disabled = true;
        continue;
      }
      s.el.disabled = false;
      s.el.classList.add("free","slot--free");
      if (pending.has(s.i)){
        s.el.classList.add("pending","slot--pending");
      }
      if (s.i>=selMin && s.i<=selMax && selected.size){
        s.el.classList.add("selected","slot--selected");
      }
    }
  }
  function updateSelCount(){
    selCount.textContent = `${selected.size} intervalos seleccionados`;
  }

  function ymd(d){
    const dt = new Date(d);
    if (isNaN(dt)) return "";
    return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
  }

  // === Disponibilidad por día ===
  async function cargarDisponibilidad(){
    clearSelection();
    busy = new Set();
    pending = new Set();

    const fecha = fechaI.value || new Date().toISOString().slice(0,10);
    const packs = [
      // suelen devolver reservas del día
      ["reservas_disponibilidad","reservas_ocupadas","reservas_listar_dia","reservas_admin_dia"],
      ["reservas_listar_admin","reservas_listar","reservas_listar_todos"]
    ];

    let reservas = [];
    for (const actions of packs){
      const res = await tryGet(actions, { fecha, espacio: espacioSel?.value||"", admin:1, all:1 });
      if (res){
        const arr = Array.isArray(res) ? res
          : res.items || res.rows || res.data || res.reservas || res.ocupados || [];
        reservas = reservas.concat(arr);
      }
    }

    // mapear a índices, pero SOLO bloquear aprobado/ocupado
    reservas.forEach(r=>{
      const estado = normEstado(r.Estado || r.estado);
      const hiRaw = (r.Hora_Inicio || r.hora_inicio || r.hi || r.inicio || "").toString().slice(0,5);
      const hfRaw = (r.Hora_Fin    || r.hora_fin    || r.hf || r.fin    || "").toString().slice(0,5);
      if (!/^\d\d:\d\d$/.test(hiRaw) || !/^\d\d:\d\d$/.test(hfRaw)) return;
      const a = timeToIdx(hiRaw), b = timeToIdx(hfRaw)-1; // inclusivo
      for(let i=a;i<=b;i++){
        if (i<0 || i>=48) continue;
        if (estado==="aprobado" || estado==="ocupado") busy.add(i);
        else if (estado==="pendiente") pending.add(i); // solo visual
        // rechazado -> no marca
      }
    });

    updateColors();
  }

  // === Enviar solicitud ===
  async function enviarSolicitud(){
    if (!selected.size) return alert("Elegí al menos un intervalo contiguo.");
    const fecha = fechaI.value || new Date().toISOString().slice(0,10);
    const arr = Array.from(selected).sort((a,b)=>a-b);
    const hi = idxToTime(arr[0]);
    const hf = idxToTime(arr[arr.length-1]+1);

    const payloads = [
      { fecha, hora_inicio:hi, hora_fin:hf, espacio:espacioSel?.value||"", estado:"pendiente" },
      { Fecha:fecha, Hora_Inicio:hi, Hora_Fin:hf, Espacio:espacioSel?.value||"", Estado:"pendiente" }
    ];
    const actions = ["reservas_solicitar","reservas_crear","reservas_nueva"];

    let ok=false, lastError="";
    for (const p of payloads){
      try { await tryPost(actions, p); ok=true; break; } catch(e){ lastError=e.message; }
    }
    if(!ok) return alert("No se pudo enviar la solicitud: "+lastError);

    alert("Solicitud enviada. Queda como pendiente hasta que el administrador la apruebe.");
    clearSelection();
    await cargarDisponibilidad();
    await cargarMisReservas();
  }

  // === Mis reservas ===
  async function cargarMisReservas(){
    if(!misBox) return;
    misBox.textContent = "Cargando…";
    const packs = [
      ["mis_reservas_listar","reservas_mias","reservas_mis_solicitudes"],
      ["reservas_listar","reservas_listar_usuario"]
    ];
    let out=[];
    for(const a of packs){
      const r = await tryGet(a, { _:Date.now() });
      if(r){
        const arr = Array.isArray(r) ? r : r.items || r.rows || r.data || r.reservas || [];
        out = out.concat(arr);
      }
    }
    out.sort((A,B)=> (B.id||B.ID||0) - (A.id||A.ID||0));

    misBox.innerHTML = out.length ? `
      <ul class="res-list">
        ${out.map(x=>{
          const f  = x.Fecha || x.fecha || "";
          const hi = (x.Hora_Inicio || x.hora_inicio || "").toString().slice(0,5);
          const hf = (x.Hora_Fin || x.hora_fin || "").toString().slice(0,5);
          const st = (x.Estado || x.estado || "pendiente").toString().toLowerCase();
          const cls = st.includes("aproba") ? "st-ok" : st.includes("recha") ? "st-bad" : st.includes("ocup") ? "st-bad" : "st-warn";
          return `<li><span>${f}</span> <span>${hi}–${hf}</span> <span class="pill ${cls}">${st}</span></li>`;
        }).join("")}
      </ul>
    ` : "Sin reservas.";
  }

  // init
  document.addEventListener("DOMContentLoaded", async()=>{
    fechaI.value = ymd(new Date()); // hoy
    buildGrid();
    await cargarDisponibilidad();
    await cargarMisReservas();
  });

  btnVer?.addEventListener("click", cargarDisponibilidad);
  btnSol?.addEventListener("click", enviarSolicitud);
})();