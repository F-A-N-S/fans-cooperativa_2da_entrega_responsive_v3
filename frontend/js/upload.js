// frontend/js/upload.js
(function () {
  const $ = (s, p=document) => p.querySelector(s);

  const form     = $('#uploadForm');
  const input    = $('#archivo');
  const monto    = $('#monto');
  const notas    = $('#notas');
  const respBox  = $('#uploadMsg');
  const listBox  = $('#misComprobantes');
  const tipo = $('#tipo');

  const API = (location.pathname.includes('/frontend/'))
    ? location.pathname.split('/frontend/')[0] + '/backend/api/cooperativa.php'
    : '../backend/api/cooperativa.php';

  function showMsg(t, kind='error'){
    if(!respBox) return;
    respBox.style.display = 'block';
    respBox.className = 'alert ' + (kind==='ok' ? 'alert--ok' : '');
    respBox.textContent = t;
  }
  function clearMsg(){ if(respBox){ respBox.style.display='none'; respBox.textContent=''; } }

  async function apiListar(){
    const res = await fetch(API+'?action=comprobantes_listar', { credentials: 'include' });
    if(!res.ok) throw new Error(await res.text());
    return res.json();
  }
  async function apiSubir(fd){
    const res = await fetch(API+'?action=comprobantes_subir', {
      method: 'POST',
      body: fd,
      credentials: 'include'
    });
    if(!res.ok) throw new Error(await res.text());
    return res.json();
  }

  function renderList(items){
    if(!listBox) return;
    if(!items || items.length===0){
      listBox.innerHTML = `
        <div class="empty">
          <span class="dot"></span>
          <div>Sin comprobantes</div>
          <small>Subí comprobantes para verlos acá.</small>
        </div>`;
      return;
    }
    listBox.innerHTML = items.map(it => `
      <a class="tile" href="../${it.Archivo || it.archivo}" target="_blank" rel="noopener">
        <div class="tile-title">${it.Tipo ?? 'Comprobante'}</div>
        <div class="tile-sub">
          ${it.Fecha ?? ''} · ${it.Monto!=null ? ('$ ' + it.Monto) : ''} · ${it.Estado ?? ''}
        </div>
      </a>
    `).join('');
  }

  async function load(){
    try {
      const data = await apiListar();
      renderList(data.items || []);
    } catch(e){
      console.error(e);
      renderList([]);
    }
  }

  form?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearMsg();

    if(!input?.files?.length){
      showMsg('Elegí un archivo para subir.');
      return;
    }

    const fd = new FormData();
    fd.append('archivo', input.files[0]);
    if(monto?.value) fd.append('monto', monto.value);
    if(notas?.value) fd.append('notas', notas.value);
        if (tipo?.value) fd.append('tipo', tipo.value);
    try {
      const r = await apiSubir(fd);
      if(r.ok){
        showMsg('Comprobante subido ✅', 'ok');
        form.reset();
        load();
      }else{
        showMsg(r.error || 'No se pudo subir.');
      }
    } catch(e){
      console.error(e);
      showMsg('Error subiendo comprobante.');
    }
  });

  load();
})();