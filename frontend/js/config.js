// Minimal config: resolve ROOT and all API endpoints in one place.
(function(){
  const m = location.pathname.match(/^(.+?)\/frontend\//);
  const ROOT = (m ? m[1] : '').replace(/\/+$/,'');
  const API        = ROOT + '/backend/api/api.php';
  const API_COOP   = ROOT + '/backend/api/cooperativa.php';
  const API_USERS  = ROOT + '/backend/api/usuarios.php';
  async function urlExists(u){
    try { const r = await fetch(u + (u.includes('?') ? '&' : '?') + 'action=ping', { method: 'GET', cache: 'no-store' }); return r.ok; }
    catch { return false; }
  }
  if (!window.__FANS_CFG__) {
    window.__FANS_CFG__ = { ROOT, API, API_COOP, API_USERS };
    window.ROOT = ROOT; window.API = API; window.API_COOP = API_COOP; window.API_USUARIOS = API_USERS;
    (async function(){
      const coopOK = await urlExists(API_COOP);
      const userOK = await urlExists(API_USERS);
      if (!coopOK && !userOK) {
        window.API_COOPERATIVA = window.API;
        window.API_USUARIOS    = window.API;
      }
    })();
  }
})();