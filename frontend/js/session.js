// Token helpers + whoAmI() that works with either API layout.
(function(){
  const KEY = 'fans_token';
  function getToken(){
    const qp = new URLSearchParams(location.search).get('token') || '';
    if (qp) try { localStorage.setItem(KEY, qp); } catch(_){}
    return localStorage.getItem(KEY) || '';
  }
  function setToken(t){ try { localStorage.setItem(KEY, t||''); } catch(_){ } }
  function clearToken(){ try { localStorage.removeItem(KEY); } catch(_){ } }
  function authHeaders(){
    const t = getToken();
    return t ? { Authorization: 'Bearer ' + t } : {};
  }
  async function meFrom(url){
    try {
      const r = await fetch(url + '?action=me', { credentials:'include', headers: authHeaders(), cache:'no-store' });
      const j = await r.json();
      if (j && j.ok) return j;
    } catch(_){}
    return null;
  }
  async function whoAmI(){
    const c1 = await meFrom(window.API_COOP || window.API_COOPERATIVA || window.API);
    if (c1) return c1;
    const c2 = await meFrom(window.API_USUARIOS || window.API);
    if (c2) return c2;
    const c3 = await meFrom(window.API);
    if (c3) return c3;
    return { ok:false };
  }
  async function logoutEverywhere(){
    const urls = [window.API_COOP, window.API_USUARIOS, window.API].filter(Boolean);
    await Promise.all(urls.map(u => fetch(u + '?action=logout', { credentials:'include' }).catch(()=>{})));
    clearToken();
  }
  window.FANS_SESSION = { getToken, setToken, clearToken, authHeaders, whoAmI, logoutEverywhere };

  document.addEventListener('click', async (e) => {
  const tgt = e.target;
  if (tgt && tgt.matches('[data-logout]')) {
    e.preventDefault();
    try {
      const path = location.pathname;
      const ROOT = path.includes('/frontend/') ? path.split('/frontend/')[0] : '';
      const USERS_API = (ROOT || '..') + '/backend/api/usuarios.php?action=logout';
      await fetch(USERS_API, { credentials: 'include' });
    } catch (_) {}
    // limpiar cookie local (por si acaso)
    document.cookie = 'fans_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    location.href = 'login.html';
  }
});

})();