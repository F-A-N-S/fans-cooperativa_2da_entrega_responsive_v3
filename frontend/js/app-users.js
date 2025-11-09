(function(){
  const APIu = (window.API_USUARIOS || window.API);
  const { authHeaders } = window.FANS_SESSION || {};
  async function getJSON(url, opts={}){
    const r = await fetch(url, { credentials:'include', headers: { ...(authHeaders?.()||{}), ...(opts.headers||{}) }, method: opts.method||'GET', body: opts.body||null });
    let j=null; try { j = await r.json(); } catch(_){}
    if (!r.ok || !j || j.ok===false) throw new Error((j&&j.error) || ('HTTP '+r.status));
    return j;
  }
  async function listPublicComunicados(){
    const host = document.getElementById('comListPublic');
    if (!host) return;
    host.textContent = 'Cargando…';
    try{
      const j = await getJSON(APIu+'?action=comunicados_listar');
      const rows = j.rows || j.comunicados || [];
      host.innerHTML = rows.length ? rows.map(x => `
        <article class="card card--light" style="margin:.5rem 0;padding:.75rem 1rem">
          <header><b>${x.titulo||x.Titulo||'—'}</b> <span class="muted">(${x.created_at||x.Fecha||''})</span></header>
          <div>${(x.cuerpo||x.Contenido||'').replace(/\n/g,'<br>')}</div>
        </article>
      `).join('') : '<div class="muted">Sin comunicados.</div>';
    }catch(e){
      host.innerHTML = '<div class="muted">No se pudo cargar comunicados ('+e.message+').</div>';
    }
  }
  function bindReclamos(){
    const f = document.getElementById('reclamoForm');
    const tb= document.getElementById('reclamosTBody');
    if (!f || !tb) return;
    f.addEventListener('submit', async (ev)=>{
      ev.preventDefault();
      const asunto = f.querySelector('[name=asunto]').value.trim();
      const descripcion = f.querySelector('[name=descripcion]').value.trim();
      if (!asunto || !descripcion) return alert('Completá asunto y descripción');
      try{
        const j = await getJSON(APIu+'?action=reclamos_crear', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ asunto, descripcion }) });
        if (!j.ok) throw new Error(j.error||'Error');
        f.reset(); await loadReclamos();
      }catch(e){ alert('No se pudo enviar: '+e.message); }
    });
    async function loadReclamos(){
      try{
        const j = await getJSON(APIu+'?action=reclamos_listar');
        const rows = j.rows || j.reclamos || [];
        tb.innerHTML = rows.length ? rows.map(r=>`
          <tr><td>${r.fecha||r.created_at||''}</td><td>${r.asunto||r.Asunto||''}</td><td>${r.descripcion||r.Descripcion||''}</td><td>${r.estado||r.Estado||''}</td></tr>`).join('')
        : '<tr><td colspan="4" class="muted">Sin reclamos</td></tr>';
      }catch{ tb.innerHTML = '<tr><td colspan="4" class="muted">No disponible</td></tr>'; }
    }
    loadReclamos();
  }
  function bindUpload(){
    const form = document.getElementById('uploadForm');
    const tb   = document.getElementById('receiptsBody');
    const st   = document.getElementById('status');
    if (!form || !tb) return;
    form.addEventListener('submit', async (ev)=>{
      ev.preventDefault();
      const fd = new FormData(form);
      if (st) st.style.display='inline';
      try{
        const j = await getJSON(APIu+'?action=upload_receipt', { method:'POST', body: fd });
        if (!j.ok) throw new Error(j.error||'Error');
        form.reset(); await listReceipts();
      }catch(e){ alert('No se pudo subir: '+e.message); }
      finally { if (st) st.style.display='none'; }
    });
    async function listReceipts(){
      try{
        const j = await getJSON(APIu+'?action=list_receipts');
        const rows = j.rows || j.receipts || [];
        tb.innerHTML = rows.length ? rows.map(x=>`
          <tr><td>${x.Tipo||x.tipo||''}</td><td>${x.Fecha||x.fecha||''}</td><td>${x.Estado||x.estado||''}</td>
          <td>${x.Archivo?`<a target="_blank" href="${x.Archivo}">Ver</a>`:''}</td></tr>`).join('')
        : '<tr><td colspan="4" class="muted">Sin comprobantes</td></tr>';
      }catch{ tb.innerHTML='<tr><td colspan="4" class="muted">No disponible</td></tr>'; }
    }
    listReceipts();
  }
  function bindReservas(){
    const btnVer = document.getElementById('btnVer');
    const btnSol = document.getElementById('btnSolicitar');
    const grid   = document.getElementById('slotsGrid');
    const mine   = document.getElementById('misReservas');
    if (!btnVer || !btnSol || !grid) return;
    let selected = new Set();
    function renderSelected(){ const c = document.getElementById('selCount'); if (c) c.textContent = selected.size + ' intervalos seleccionados'; }
    function toggleSlot(el){
      const k = el.dataset.key;
      if (!k || el.classList.contains('busy')) return;
      if (selected.has(k)) { selected.delete(k); el.classList.remove('sel'); }
      else { selected.add(k); el.classList.add('sel'); }
      renderSelected();
    }
    function renderSlots(slots){
      grid.innerHTML = slots.map(s=>`<button type="button" class="slot ${s.busy?'busy':''}" data-key="${s.key}">${s.label}</button>`).join('');
      grid.querySelectorAll('.slot').forEach(b=>b.onclick = ()=>toggleSlot(b));
      selected.clear(); renderSelected();
    }
    btnVer.onclick = async ()=>{
      const fecha = (document.getElementById('resFecha')?.value||'').trim();
      const espacio = document.getElementById('espacio')?.value||'';
      if (!fecha) return alert('Elegí una fecha');
      try{
        const j = await getJSON(APIu+'?action=reservas_disponibilidad&fecha='+encodeURIComponent(fecha)+'&espacio='+encodeURIComponent(espacio));
        renderSlots(j.slots||[]);
      }catch(e){ alert('No se pudo cargar disponibilidad: '+e.message); }
    };
    btnSol.onclick = async ()=>{
      if (!selected.size) return alert('Seleccioná uno o más intervalos contiguos');
      const fecha = (document.getElementById('resFecha')?.value||'').trim();
      const espacio = document.getElementById('espacio')?.value||'';
      try{
        const j = await getJSON(APIu+'?action=reservas_solicitar', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fecha, espacio, slots: Array.from(selected) }) });
        if (!j.ok) throw new Error(j.error||'Error');
        alert('Solicitud enviada'); selected.clear(); renderSelected(); btnVer.click(); await misReservas();
      }catch(e){ alert('No se pudo solicitar: '+e.message); }
    };
    async function misReservas(){
      if (!mine) return;
      try{
        const j = await getJSON(APIu+'?action=reservas_mis');
        const rows = j.rows||j.reservas||[];
        mine.innerHTML = rows.length ? ('<ul>'+rows.map(r=>`<li>${r.fecha||r.Fecha||''} ${r.desde||r.desde_hora||''}–${r.hasta||r.hasta_hora||''} • ${r.estado||r.Estado||''}</li>`).join('')+'</ul>') : '<div class="muted">Sin reservas</div>';
      }catch{ mine.innerHTML = '<div class="muted">No disponible</div>'; }
    }
    misReservas();
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    listPublicComunicados();
    bindReclamos();
    bindUpload();
    bindReservas();
  });
})();