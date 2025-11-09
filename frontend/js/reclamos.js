(() => {
  const $ = s => document.querySelector(s);

  const form  = $('#reclamoForm');
  const asunto= $('#asunto');
  const desc  = $('#descripcion');
  const btn   = $('#btnEnviar');
  const msg   = $('#reclamoMsg');
  const list  = $('#claimsList');

  const path = location.pathname;
  const ROOT = path.includes('/frontend/') ? path.split('/frontend/')[0] : '';
  const API  = (ROOT || '..') + '/backend/api/cooperativa.php';

  const flash = (ok, text) => {
    if (!msg) return;
    msg.style.display = 'block';
    msg.className = 'alert ' + (ok ? 'ok' : 'error');
    msg.textContent = text;
  };

  async function crear() {
    btn.disabled = true;
    flash(true,'Enviando…');

    const res = await fetch(API + '?action=reclamos_crear', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asunto: (asunto?.value || '').trim(),
        descripcion: (desc?.value || '').trim()
      })
    });

    const txt = await res.text();
    let data; try { data = JSON.parse(txt); } catch { data = { ok:false, error:txt }; }

    if (!res.ok || data.ok !== true) {
      flash(false, data.error || data.message || 'No se pudo enviar el reclamo.');
    } else {
      flash(true, 'Reclamo enviado.');
      form.reset();
      cargar();
    }
    btn.disabled = false;
  }

  async function cargar() {
    if (!list) return;
    list.innerHTML = '<div class="claim skeleton"></div>';
    const res = await fetch(API + '?action=reclamos_listar', { credentials: 'include' });
    const txt = await res.text();
    let data; try { data = JSON.parse(txt); } catch { data = { ok:false, error:txt }; }

    if (!res.ok || data.ok !== true) {
      list.innerHTML = '<div class="claim empty">Error cargando reclamos.</div>';
      return;
    }

    const items = data.items || [];
    list.innerHTML = items.length ? items.map(it => `
      <article class="claim">
        <div class="claim-head">
          <span class="status ${String(it.Estado||'').toLowerCase()}">${it.Estado || ''}</span>
          <time>${(it.Fecha||'').replace('T',' ').slice(0,16)}</time>
        </div>
        <p>${String(it.Descripcion||'').replace(/</g,'&lt;')}</p>
      </article>
    `).join('') : '<div class="claim empty">Sin reclamos</div>';
  }

  form?.addEventListener('submit', e => { e.preventDefault(); crear(); });
  cargar();

  // Botón Salir (borra cookie y storage)
  document.addEventListener('click', (e) => {
    if (e.target && e.target.matches('[data-logout]')) {
      document.cookie = 'fans_token=; Max-Age=0; path=/';
      try { localStorage.removeItem('fans:token'); } catch {}
      try { sessionStorage.clear(); } catch {}
      location.href = 'login.html';
    }
  });
})();