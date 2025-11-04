// reservas_grid.js — selección múltiple (bloque contiguo), año fijo 2025
(function(){
  const gridBox=document.getElementById("slotsGrid");
  const espacioEl=document.getElementById("espacio");
  const fechaEl=document.getElementById("fecha");
  const durEl=document.getElementById("duracion");   // si hay multi, se ignora
  const notaEl=document.getElementById("nota");
  const btn=document.getElementById("btnSolicitar");
  const sumE=document.getElementById("sumEspacio");
  const sumF=document.getElementById("sumFecha");
  const sumH=document.getElementById("sumHora");
  const misBox=document.getElementById("misReservas");

  const START_H=8, START_M=30, END_H=22, END_M=30;
  const pad=n=>String(n).padStart(2,"0"), toStr=(h,m)=>pad(h)+":"+pad(m);
  const plus30=x=>{ const [h,m]=x.split(":").map(Number); const mm=m+30; return toStr(h+(mm===60?1:0),(mm===60?0:mm)); };
  const addMin=(hhmm,min)=>{ const [h,m]=hhmm.split(":").map(Number); const T=h*60+m+min; return toStr(Math.floor(T/60),T%60); };

  const slots=()=>{ const out=[];
    for(let h=START_H,m=START_M; h<23 && (h<END_H || (h===END_H && m<=END_M)); ){
      out.push(toStr(h,m)); m+=30; if(m===60){m=0;h++;}
    }
    return out;
  };
  const allSlots=slots();
  const y2025=v=>{ if(!v) return v; const p=v.split("-"); if(p.length===3){ p[0]="2025"; return p.join("-"); } return v; };

  function H(){ return (window.authH&&window.authH())||{}; }
  function url(a,p){ return (window.apiBuild?window.apiBuild(a,p):(window.API||"/api/api.php")+"?action="+a); }
  async function GET(a,p={}){ const r=await fetch(url(a,p),{headers:{...H()}}); let j=null; try{ j=await r.json(); }catch(_){ }
    if(!r.ok) throw new Error(j?.error||r.statusText||("HTTP "+r.status)); return j||{}; }
  async function POST(a,d){ const r=await fetch(url(a),{method:"POST",headers:{"Content-Type":"application/json",...H()},body:JSON.stringify(d||{})}); let j=null; try{ j=await r.json(); }catch(_){ }
    if(!r.ok) throw new Error(j?.error||r.statusText||("HTTP "+r.status)); return j||{}; }

  async function loadEspacios(){
    let items=[]; const acts=["espacios_listar","list_espacios","rooms_list"];
    for(const a of acts){ try{ const j=await GET(a); items=j.rows||j.items||j.data||[]; if(items.length||j.ok) break; }catch(_){ } }
    if(!items.length) items=[{id:1,nombre:"Salón de eventos"},{id:2,nombre:"Parrillero"},{id:3,nombre:"Sala de reuniones"}];
    espacioEl.innerHTML=items.map(it=>`<option value="${it.id||it.ID||it.nombre}">${it.nombre||it.room||it.display||("Espacio "+(it.id||it.ID||""))}</option>`).join("");
  }

  async function fetchOcupados(d,esp){
    if(!d) return new Set(); let rows=[]; const acts=["reservas_ocupados","bookings_occupied","list_bookings"];
    for(const a of acts){ try{ const j=await GET(a,{fecha:y2025(d),espacio:esp}); rows=j.rows||j.items||j.data||[]; if(rows.length||j.ok) break; }catch(_){ } }
    const occ=new Set();
    rows.forEach(r=>{
      let i=(r.hora_inicio||r.start||"").slice(0,5),
          f=(r.hora_fin||r.end||"").slice(0,5);
      if(!i||!f) return;
      while(i<f){ occ.add(i); i=plus30(i); }
    });
    return occ;
  }

  let selected=new Set(); // HH:MM seleccionados
  function contiguous(sel){
    if(sel.size<=1) return true;
    const arr=[...sel].sort();
    for(let i=1;i<arr.length;i++){
      if(plus30(arr[i-1])!==arr[i]) return false;
    }
    return true;
  }
  function paint(occ){
    gridBox.innerHTML=allSlots.map(t=>`<button type="button" class="slot ${(occ.has(t)?"reserved":"free")} ${selected.has(t)?"selected":""}" data-time="${t}" ${occ.has(t)?"disabled":""}>${t}</button>`).join("");
  }
  function updSummary(){
    const arr=[...selected].sort();
    const fec=fechaEl.value||"—";
    const esp=espacioEl.options[espacioEl.selectedIndex]?.text||"—";
    let rango="—";
    if(arr.length){
      const ini=arr[0], fin=plus30(arr[arr.length-1]);
      rango=`${ini} - ${fin} (${arr.length*30} min)`;
    }
    sumE.textContent="Espacio: "+esp;
    sumF.textContent="Fecha: "+fec;
    sumH.textContent="Horario: "+rango;
    btn.disabled = arr.length===0;
  }

  gridBox.addEventListener("click", e=>{
    const b=e.target.closest(".slot.free"); if(!b) return;
    const t=b.dataset.time;
    if(selected.has(t)){ selected.delete(t); paint(new Set()); updSummary(); return; }
    // tentativa
    const temp=new Set(selected); temp.add(t);
    if(!contiguous(temp)){ alert("Debe ser un bloque contiguo de 30 minutos."); return; }
    selected=temp; paint(new Set()); updSummary();
  });

  async function reload(){
    const d=y2025(fechaEl.value||"");
    if(fechaEl && d && fechaEl.value!=d) fechaEl.value=d;
    const occ=await fetchOcupados(d, espacioEl.value).catch(()=>new Set());
    paint(occ); updSummary();
  }

  async function submit(){
    const fec=y2025(fechaEl.value||""); const esp=espacioEl.value;
    const arr=[...selected].sort();
    if(!fec||!arr.length) return alert("Selecciona fecha y al menos una casilla.");
    const ini=arr[0], fin=plus30(arr[arr.length-1]);

    // intento 1: endpoint que acepta bloque
    const payload={espacio:esp,fecha:fec,hora_inicio:ini,hora_fin:fin,nota:(notaEl.value||"")};
    const acts=["reservas_solicitar","reservas_create","create_booking"];
    let ok=false,err=null;
    for(const a of acts){ try{ const r=await POST(a,payload); ok=(r?.ok!==false); if(ok) break; }catch(ex){ err=ex; } }

    // intento 2: si no soporta bloque, enviamos 30' x 30'
    if(!ok && arr.length>1){
      try{
        for(let i=0;i<arr.length;i++){
          const s=arr[i], e=plus30(s);
          await POST(acts[0],{espacio:esp,fecha:fec,hora_inicio:s,hora_fin:e,nota:(notaEl.value||"")});
        }
        ok=true;
      }catch(ex){ err=ex; }
    }

    if(!ok) return alert("No se pudo enviar la solicitud"+(err?": "+err.message:""));
    alert("Solicitud enviada."); selected.clear(); await reload(); await loadMine();
  }

  async function loadMine(){
    misBox.innerHTML="<em>Cargando…</em>";
    let rows=[]; const acts=["mis_reservas","list_mis_reservas","reservas_mias"];
    for(const a of acts){ try{ const j=await GET(a); rows=j.rows||j.items||[]; if(rows.length||j.ok) break; }catch(_){ } }
    misBox.innerHTML = rows.length
      ? "<ul>"+rows.map(r=>`<li>${r.fecha||""} ${(r.hora_inicio||"").slice(0,5)}-${(r.hora_fin||"").slice(0,5)} • ${r.espacio||""} • <b>${(r.estado||"pendiente")}</b></li>`).join("")+"</ul>"
      : "<em>Sin reservas.</em>";
  }

  async function listarMisReservas(){
  const acts=["mis_reservas","reservas_mias","user_bookings"];
  let r=null,lastErr=null;
  for(const a of acts){ try{ r=await apiGet(a); if(r?.rows?.length || r?.items?.length || r?.ok) return r; }catch(e){ lastErr=e; } }
  if(lastErr) throw lastErr; return {rows:[]};
}

  fechaEl.addEventListener("change", ()=>{ selected.clear(); reload(); });
  espacioEl.addEventListener("change", ()=>{ selected.clear(); reload(); });
  durEl?.addEventListener("change", ()=>{}); // se ignora si hay multi

  btn.addEventListener("click", submit);

  (function init(){
    const now=new Date();
    const d="2025-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
    fechaEl.value=d; loadEspacios().then(reload); loadMine();
  })();
})();