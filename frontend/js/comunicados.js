// js/comunicados.js — robusto y compatible con tu HTML/API_URL actual
document.addEventListener('DOMContentLoaded', () => {
  var API_URL = window.API_URL || window.API || '/api/api.php';

  // Header de auth (usa tu getAuthHeader si existe)
  const H = (typeof window.fansAuthHeaders === 'function') ? window.fansAuthHeaders() : {};

  const box  = document.getElementById('annList');
  const form = null; // formulario deshabilitado en página pública

  // formatea fecha sin romper si viene con hora
  const fmt = (v) => {
    if (!v) return '—';
    try {
      // soporta "YYYY-MM-DD HH:MM:SS" y variantes
      const d = new Date(String(v).replace(' ', 'T'));
      if (!isNaN(d)) return d.toLocaleString();
    } catch (_) {}
    // fallback simple DD/MM/YYYY
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
  };

  // Mostrar el form solo si es admin (admin/administrador, case-insensitive)
  fetch(`${API_URL}?action=me`, { headers: H })
    .then(r => r.json())
    .then(d => {
      const role = (d?.user?.role || d?.user?.user_role || '').toString().toLowerCase();
      const isAdmin = role === 'admin' || role === 'administrador';
      if (isAdmin && form) form.style.display = '';
    })
    .catch(() => { /* noop */ });

  async function load() {
    try {
      const r = await fetch(`${API_URL}?action=list_announcements`, { headers: H });
      const d = await r.json();
      const items = Array.isArray(d?.items) ? d.items : [];

      if (!items.length) {
        box.innerHTML = '<p>No hay comunicados.</p>';
        return;
      }

      box.innerHTML = items.map(x => {
        // tolera distintos nombres de claves desde el backend
        const titulo = x.Titulo ?? x.titulo ?? x.title ?? '';
        const cuerpo = x.Cuerpo ?? x.cuerpo ?? x.body ?? '';
        const publicado = x.Publicado ?? x.created_at ?? x.Fecha ?? x.fecha ?? '';

        // Sanitiza: convierto saltos de línea a <br> y NO inserto HTML crudo del servidor
        const safeBody = String(cuerpo).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])).replace(/\n/g,'<br>');

        return `
          <article class="ann-card">
            <h3>${titulo}</h3>
            <time>${fmt(publicado)}</time>
            <p>${safeBody}</p>
          </article>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
      box.innerHTML = '<p>Error cargando comunicados.</p>';
    }
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);                         // titulo, cuerpo (como ya tenés)
    try {
      const r = await fetch(`${API_URL}?action=create_announcement`, {
        method: 'POST',
        headers: H,                                        // no fuerces Content-Type aquí
        body: fd
      });
      const d = await r.json();
      if (d?.ok) {
        form.reset();
        await load();
        alert('Comunicado publicado');
      } else {
        alert(d?.error || 'No se pudo publicar');
      }
    } catch {
      alert('Error de red');
    }
  });

  load();
});

// --- Handler único y robusto para publicar comunicado ---
document.addEventListener('DOMContentLoaded', () => {
  const form = null; // formulario deshabilitado en página pública
  if (!form) return;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    ev.stopImmediatePropagation();

    const H = (typeof window.fansAuthHeaders === 'function') ? window.fansAuthHeaders() : {};
    const title = (form.querySelector('[name=titulo]')?.value || form.querySelector('#annTitle')?.value || '').trim();
    const body  = (form.querySelector('[name=cuerpo]')?.value  || form.querySelector('#annBody')?.value  || '').trim();
    if (!title || !body) { alert('Completá título y cuerpo'); return; }

    try {
      const r = await fetch(`${window.API_URL || '/api/api.php'}?action=announce`, {
        method:'POST',
        headers: { 'Content-Type':'application/json', ...H },
        body: JSON.stringify({ title, body, titulo: title, cuerpo: body })
      });
      const d = await r.json();
      if (!d?.ok) throw new Error(d?.error || 'No autorizado');
      form.reset();
      if (typeof load === 'function') { await load(); }
      (window.showNotification ? showNotification('Comunicado publicado','success') : alert('Comunicado publicado'));
    } catch (e) {
      (window.showNotification ? showNotification(e.message || 'Error','error') : alert(e.message || 'Error'));
    }
  }, { capture: true });
});
