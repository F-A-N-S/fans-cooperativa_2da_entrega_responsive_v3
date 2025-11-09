/* App base: ROOT, endpoints, fetch con token, guards y logout */
(function () {
  const m = location.pathname.match(/^(.+)\/frontend\//);
  const ROOT = m ? m[1] : '';

  const API        = ROOT + '/backend/api/api.php';
  const API_COOP   = ROOT + '/backend/api/cooperativa.php';

  function authHeaders() {
    const t = localStorage.getItem('fans_token');
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  async function apiFetch(url, opt = {}) {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { ...authHeaders(), ...(opt.headers || {}) },
      ...opt
    });
    let data;
    try { data = await res.json(); } 
    catch { throw new Error('Respuesta no JSON'); }
    if (!data.ok) {
      const err = new Error(data.error || 'Error');
      err.data = data; err.status = res.status;
      throw err;
    }
    return data;
  }

  async function me() {
    try { return await apiFetch(API_COOP + '?action=me'); }
    catch { return null; }
  }

  function setToken(t) {
    try {
      localStorage.setItem('fans_token', t);
      document.cookie = 'fans_token=' + encodeURIComponent(t) + ';path=/';
    } catch (_) {}
  }
  function clearToken() {
    try {
      localStorage.removeItem('fans_token');
      document.cookie = 'fans_token=;Max-Age=0;path=/';
    } catch (_) {}
  }

  async function requireAdmin() {
    const d = await me();
    if (!d || !d.admin || d.admin.role !== 'admin') {
      location.replace('admin_login.html');
      throw new Error('no-admin');
    }
    return d.admin;
  }

  async function requireUser() {
    const d = await me();
    // Si tu /me devuelve {user:{...}} para residentes, ajustá esta línea si hace falta
    if (!d || d.admin) {
      location.replace('login.html');
      throw new Error('no-user');
    }
    return d.user || d.residente || d;
  }

  // Logout global por data-logout
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-logout]');
    if (!b) return;
    e.preventDefault();
    try { await fetch(API_COOP + '?action=logout', { credentials: 'include' }); } catch (_){}
    clearToken();
    if (location.pathname.includes('backoffice')) location.href = 'admin_login.html';
    else location.href = 'login.html';
  });

  // Exponer en window
  window.App = { ROOT, API, API_COOP, apiFetch, me, setToken, clearToken, requireAdmin, requireUser };
})();