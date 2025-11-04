// js/upload.js
document.addEventListener('DOMContentLoaded', async () => {
  window.requireToken();
  const $ = (s) => document.querySelector(s);
  let gUser=null, gRid=0;

  async function whoAmI(){
    const j = await (await fetch(window.apiUrl('?action=me'), { headers: window.authHeaders() })).json();
    if (!j?.ok) throw new Error('ME_FAIL'); gUser = j.user;
  }
  function pickRid(){
    let v = prompt('ID de residente destino:', gRid||'');
    if (!v) return;
    v = parseInt(v,10);
    if (!Number.isFinite(v)||v<=0) { alert('ID inválido'); return; }
    gRid = v; localStorage.setItem('as_residente_id', String(v));
    listReceipts();
  }
  async function resolveRid(){
    if (gUser?.role==='residente') { gRid=gUser.id; return; }
    const qs = new URLSearchParams(location.search);
    const qid = parseInt(qs.get('id_residente')||'0',10);
    if (qid>0){ gRid=qid; localStorage.setItem('as_residente_id', String(qid)); return; }
    const st=parseInt(localStorage.getItem('as_residente_id')||'0',10);
    if (st>0){ gRid=st; return; }
    pickRid();
  }
  function actingBar(){
    const box = document.getElementById('actingAs');
    if (box && gUser?.role==='admin'){
      box.innerHTML = `Actuando como <b>residente #${gRid||'—'}</b> <button class="btn btn-outline" id="chgRid">Cambiar</button>`;
      box.style.display = '';
      document.getElementById('chgRid').onclick = pickRid;
    } else if (box) box.style.display='none';
  }

  async function listReceipts(){
    const tb = document.getElementById('receiptsBody'); if(!tb) return;
    tb.innerHTML=`<tr><td colspan="4">Cargando…</td></tr>`;
    let q='?action=list_receipts';
    if (gUser?.role==='admin' && gRid) q += '&id_residente='+encodeURIComponent(gRid);
    try{
      const j = await (await fetch(window.apiUrl(q), { headers: window.authHeaders() })).json();
      const rows = j?.rows || j?.receipts || [];
      if(!rows.length){ tb.innerHTML = `<tr><td colspan="4">Sin resultados.</td></tr>`; return; }
      const FILE_BASE = ( (window.API || '/api/api.php').replace(/\/api\/api\.php$/,'') + '/' ).replace(/\/+$/,'/');
      tb.innerHTML = rows.map(x=>{
        const fileUrl = x.Archivo ? (x.Archivo.startsWith('http') ? x.Archivo : (FILE_BASE + x.Archivo).replace(/\/+/g,'/')) : '';
        return `<tr>
          <td>${x.Tipo??'-'}</td>
          <td>${x.Fecha??'-'}</td>
          <td>${x.Estado??'-'}</td>
          <td>${x.Archivo ? `<a href="${fileUrl}" target="_blank">Ver</a>` : ''}</td>
        </tr>`;
      }).join('');
    }catch(e){
      tb.innerHTML = `<tr><td colspan="4">Error: ${e.message}</td></tr>`;
    }
  }

  async function onUpload(e){
    e.preventDefault();
    const f = document.getElementById('archivo').files[0];
    if(!f) { alert('Seleccioná un archivo'); return; }
    const fd = new FormData();
    fd.set('tipo', document.getElementById('tipo').value);
    fd.set('fecha', document.getElementById('fecha').value);
    const m = document.getElementById('monto').value; if(m) fd.set('monto', m);
    fd.set('archivo', f);
    if (gUser?.role==='admin' && gRid) fd.set('id_residente', String(gRid));

    document.getElementById('status').style.display='inline';
    try{
      const j = await (await fetch(window.apiUrl('?action=upload_receipt'), { method:'POST', headers: window.authHeaders(), body: fd })).json();
      if(!j?.ok) throw new Error(j?.message || j?.error || 'No se pudo subir');
      e.target.reset();
      await listReceipts();
      alert('Comprobante subido');
    }catch(err){
      alert('Error: '+err.message);
    }finally{
      document.getElementById('status').style.display='none';
    }
  }

  await whoAmI();
  await resolveRid();
  actingBar();
  document.getElementById('uploadForm')?.addEventListener('submit', onUpload);
  listReceipts();
});